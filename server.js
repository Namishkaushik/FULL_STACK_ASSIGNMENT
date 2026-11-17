import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import { logAttendance } from './utils/logger.js';
import {
  calculateAttendanceSummary,
  isValidDateYYYYMMDD,
} from './utils/attendanceCalc.js';
import MemoryStore from './utils/memoryStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMongooseRepository() {
  return {
    mode: 'mongodb',

    async createStudent(payload) {
      const rollNo = String(payload.rollNo || '').trim().toUpperCase();
      const existing = await Student.findOne({ rollNo }).lean();
      if (existing) {
        const err = new Error(`Student with roll number ${rollNo} already exists`);
        err.status = 409;
        throw err;
      }

      const semesterNum = Number(payload.semester);
      const student = await Student.create({
        rollNo,
        name: payload.name,
        course: payload.course,
        semester: semesterNum,
        email: payload.email,
      });
      return student.toObject();
    },

    async listStudents({ q = '', semester = '' } = {}) {
      const filter = {};
      if (semester !== '' && semester !== undefined) {
        const semNum = Number(semester);
        if (!Number.isNaN(semNum)) {
          filter.semester = semNum;
        }
      }
      if (q && String(q).trim()) {
        const regex = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { rollNo: regex },
          { name: regex },
          { course: regex },
          { email: regex },
        ];
      }
      return Student.find(filter).sort({ rollNo: 1 }).lean();
    },

    async listAttendance({ subject = '', date = '' } = {}) {
      const filter = {};
      if (subject && String(subject).trim()) {
        filter.subject = String(subject).trim();
      }
      if (date && String(date).trim()) {
        filter.date = String(date).trim();
      }
      return Attendance.find(filter).sort({ date: -1, studentRollNo: 1 }).lean();
    },

    async markAttendance(payload) {
      const studentRollNo = String(payload.studentRollNo || '').trim().toUpperCase();
      const subject = String(payload.subject || '').trim();
      const date = String(payload.date || '').trim();
      const status = String(payload.status || '').trim();
      const markedBy = String(payload.markedBy || 'Faculty').trim() || 'Faculty';

      if (!studentRollNo) {
        const err = new Error('Student roll number is required');
        err.status = 400;
        throw err;
      }
      if (!subject) {
        const err = new Error('Subject is required');
        err.status = 400;
        throw err;
      }
      if (!isValidDateYYYYMMDD(date)) {
        const err = new Error('Date must be a valid YYYY-MM-DD value');
        err.status = 400;
        throw err;
      }
      if (!['Present', 'Absent'].includes(status)) {
        const err = new Error('Status must be either Present or Absent');
        err.status = 400;
        throw err;
      }

      const student = await Student.findOne({ rollNo: studentRollNo }).lean();
      if (!student) {
        const err = new Error(`Student with roll number ${studentRollNo} not found`);
        err.status = 404;
        throw err;
      }

      const existing = await Attendance.findOne({ studentRollNo, subject, date }).lean();
      if (existing) {
        const err = new Error(
          `Attendance already marked for ${studentRollNo} in ${subject} on ${date}`
        );
        err.status = 409;
        throw err;
      }

      const record = await Attendance.create({
        studentRollNo,
        subject,
        date,
        status,
        markedBy,
      });
      return record.toObject();
    },

    async getStudentAttendance(rollNo) {
      const normalized = String(rollNo || '').trim().toUpperCase();
      const student = await Student.findOne({ rollNo: normalized }).lean();
      if (!student) {
        const err = new Error(`Student with roll number ${normalized} not found`);
        err.status = 404;
        throw err;
      }

      const records = await Attendance.find({ studentRollNo: normalized })
        .sort({ date: -1, subject: 1 })
        .lean();

      const summary = calculateAttendanceSummary(records);
      return {
        rollNo: normalized,
        student,
        ...summary,
        records,
      };
    },

    async getStudentSubjectBreakdown(rollNo) {
      const normalized = String(rollNo || '').trim().toUpperCase();
      const student = await Student.findOne({ rollNo: normalized }).lean();
      if (!student) {
        const err = new Error(`Student with roll number ${normalized} not found`);
        err.status = 404;
        throw err;
      }

      const subjects = await Attendance.aggregate([
        { $match: { studentRollNo: normalized } },
        {
          $group: {
            _id: '$subject',
            total: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Present'] }, 1, 0],
              },
            },
            absent: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            subject: '$_id',
            total: 1,
            present: 1,
            absent: 1,
            percentage: {
              $cond: [
                { $eq: ['$total', 0] },
                0,
                {
                  $round: [
                    { $multiply: [{ $divide: ['$present', '$total'] }, 100] },
                    2,
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            subject: 1,
            total: 1,
            present: 1,
            absent: 1,
            percentage: 1,
            eligible: { $gte: ['$percentage', 75] },
          },
        },
        { $sort: { subject: 1 } },
      ]);

      return {
        rollNo: normalized,
        subjects,
      };
    },

    async updateAttendance(id, payload) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        const err = new Error(`Attendance record ${id} not found`);
        err.status = 404;
        throw err;
      }

      const status = String(payload.status || '').trim();
      if (!['Present', 'Absent'].includes(status)) {
        const err = new Error('Status must be either Present or Absent');
        err.status = 400;
        throw err;
      }

      const updateFields = { status };
      if (payload.markedBy && String(payload.markedBy).trim()) {
        updateFields.markedBy = String(payload.markedBy).trim();
      }

      const updated = await Attendance.findByIdAndUpdate(id, updateFields, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) {
        const err = new Error(`Attendance record ${id} not found`);
        err.status = 404;
        throw err;
      }
      return updated;
    },
  };
}

function handleRouteError(res, err) {
  if (err?.status) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate record already exists' });
  }
  if (err?.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ error: messages[0] || 'Validation failed' });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid input format' });
  }
  return res.status(500).json({ error: err?.message || 'Internal server error' });
}

export function createApp({ repository, logPath } = {}) {
  const app = express();
  const repo = repository || new MemoryStore({ seed: true });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      storage: repo.mode || 'memory',
    });
  });

  app.post('/api/students', async (req, res) => {
    try {
      const student = await repo.createStudent(req.body || {});
      return res.status(201).json(student);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.get('/api/students', async (req, res) => {
    try {
      const students = await repo.listStudents({
        q: req.query.q,
        semester: req.query.semester,
      });
      return res.status(200).json(students);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.get('/api/attendance', async (req, res) => {
    try {
      const records = await repo.listAttendance({
        subject: req.query.subject,
        date: req.query.date,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.post('/api/attendance', async (req, res) => {
    try {
      const record = await repo.markAttendance(req.body || {});
      await logAttendance(
        {
          action: 'MARKED',
          rollNo: record.studentRollNo,
          subject: record.subject,
          date: record.date,
          status: record.status,
          markedBy: record.markedBy,
        },
        logPath
      );
      return res.status(201).json(record);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.get('/api/attendance/:rollNo/subjects', async (req, res) => {
    try {
      const breakdown = await repo.getStudentSubjectBreakdown(req.params.rollNo);
      return res.status(200).json(breakdown);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.get('/api/attendance/:rollNo', async (req, res) => {
    try {
      const summary = await repo.getStudentAttendance(req.params.rollNo);
      return res.status(200).json(summary);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.put('/api/attendance/:id', async (req, res) => {
    try {
      const updated = await repo.updateAttendance(req.params.id, req.body || {});
      await logAttendance(
        {
          action: 'UPDATED',
          rollNo: updated.studentRollNo,
          subject: updated.subject,
          date: updated.date,
          status: updated.status,
          markedBy: updated.markedBy,
        },
        logPath
      );
      return res.status(200).json(updated);
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

export async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const mongoUri = process.env.MONGO_URI && process.env.MONGO_URI.trim();
  let repository;

  if (mongoUri) {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB via Mongoose');
    repository = createMongooseRepository();
  } else {
    console.log('MONGO_URI not set — running with seeded in-memory store');
    repository = new MemoryStore({ seed: true });
    repository.mode = 'memory';
  }

  const app = createApp({ repository });
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
  return { app, server };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
