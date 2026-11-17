import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../server.js';
import MemoryStore from '../utils/memoryStore.js';
import {
  calculateAttendanceSummary,
  calculateSubjectBreakdown,
} from '../utils/attendanceCalc.js';
import { readAttendanceLogsForRoll } from '../utils/logger.js';

describe('Attendance percentage & eligibility calculations', () => {
  test('returns 0% and ineligible when there are no classes', () => {
    const summary = calculateAttendanceSummary([]);
    expect(summary).toEqual({
      total: 0,
      present: 0,
      absent: 0,
      percentage: 0,
      eligible: false,
    });
  });

  test('marks exactly 75% as eligible', () => {
    const records = [
      { status: 'Present' },
      { status: 'Present' },
      { status: 'Present' },
      { status: 'Absent' },
    ];
    const summary = calculateAttendanceSummary(records);
    expect(summary.total).toBe(4);
    expect(summary.present).toBe(3);
    expect(summary.percentage).toBe(75);
    expect(summary.eligible).toBe(true);
  });

  test('marks below 75% as ineligible and rounds to 2 decimals', () => {
    const records = [
      { status: 'Present' },
      { status: 'Present' },
      { status: 'Absent' },
    ];
    const summary = calculateAttendanceSummary(records);
    expect(summary.percentage).toBe(66.67);
    expect(summary.eligible).toBe(false);
  });

  test('computes subject-wise breakdown sorted alphabetically', () => {
    const breakdown = calculateSubjectBreakdown([
      { subject: 'Operating Systems', status: 'Present' },
      { subject: 'Data Structures', status: 'Present' },
      { subject: 'Data Structures', status: 'Absent' },
    ]);
    expect(breakdown).toEqual([
      {
        subject: 'Data Structures',
        total: 2,
        present: 1,
        absent: 1,
        percentage: 50,
        eligible: false,
      },
      {
        subject: 'Operating Systems',
        total: 1,
        present: 1,
        absent: 0,
        percentage: 100,
        eligible: true,
      },
    ]);
  });
});

describe('Student & Attendance API endpoints', () => {
  let app;
  let store;
  let tempDir;
  let logPath;

  beforeEach(() => {
    store = new MemoryStore({ seed: false });
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unitrack-test-'));
    logPath = path.join(tempDir, 'attendance.log');
    app = createApp({ repository: store, logPath });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('POST /api/students creates a student (201) and rejects duplicate rollNo (409)', async () => {
    const payload = {
      rollNo: 'CS2025001',
      name: 'Neha Patel',
      course: 'B.Tech Computer Science',
      semester: 3,
      email: 'neha.patel@university.edu',
    };

    const created = await request(app).post('/api/students').send(payload);
    expect(created.status).toBe(201);
    expect(created.body.rollNo).toBe('CS2025001');

    const duplicate = await request(app).post('/api/students').send(payload);
    expect(duplicate.status).toBe(409);
  });

  test('POST /api/students returns 400 on invalid semester or email', async () => {
    const bad = await request(app).post('/api/students').send({
      rollNo: 'CS2025002',
      name: 'Bad Input',
      course: 'CSE',
      semester: 10,
      email: 'not-an-email',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBeDefined();
  });

  test('POST /api/attendance returns 404 when student does not exist', async () => {
    const res = await request(app).post('/api/attendance').send({
      studentRollNo: 'UNKNOWN999',
      subject: 'Algorithms',
      date: '2026-11-17',
      status: 'Present',
      markedBy: 'Dr. Rao',
    });
    expect(res.status).toBe(404);
  });

  test('POST /api/attendance marks attendance (201), writes log, and returns 409 on duplicate', async () => {
    await request(app).post('/api/students').send({
      rollNo: 'CS2025003',
      name: 'Arjun Mehta',
      course: 'B.Tech CSE',
      semester: 5,
      email: 'arjun.mehta@university.edu',
    });

    const markRes = await request(app).post('/api/attendance').send({
      studentRollNo: 'CS2025003',
      subject: 'Algorithms',
      date: '2026-11-17',
      status: 'Present',
      markedBy: 'Dr. Rao',
    });
    expect(markRes.status).toBe(201);
    expect(markRes.body.status).toBe('Present');

    const logs = readAttendanceLogsForRoll('CS2025003', logPath);
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('MARKED | CS2025003 | Algorithms | 2026-11-17 | Present | by Dr. Rao');

    const dupRes = await request(app).post('/api/attendance').send({
      studentRollNo: 'CS2025003',
      subject: 'Algorithms',
      date: '2026-11-17',
      status: 'Absent',
      markedBy: 'Dr. Rao',
    });
    expect(dupRes.status).toBe(409);
  });

  test('GET /api/attendance/:rollNo and PUT /api/attendance/:id recalculate percentage and log update', async () => {
    await request(app).post('/api/students').send({
      rollNo: 'CS2025004',
      name: 'Diya Sen',
      course: 'B.Tech CSE',
      semester: 4,
      email: 'diya.sen@university.edu',
    });

    const first = await request(app).post('/api/attendance').send({
      studentRollNo: 'CS2025004',
      subject: 'Networks',
      date: '2026-11-10',
      status: 'Present',
      markedBy: 'Prof. Menon',
    });
    const second = await request(app).post('/api/attendance').send({
      studentRollNo: 'CS2025004',
      subject: 'Networks',
      date: '2026-11-11',
      status: 'Absent',
      markedBy: 'Prof. Menon',
    });

    const reportBefore = await request(app).get('/api/attendance/CS2025004');
    expect(reportBefore.status).toBe(200);
    expect(reportBefore.body.total).toBe(2);
    expect(reportBefore.body.present).toBe(1);
    expect(reportBefore.body.percentage).toBe(50);
    expect(reportBefore.body.eligible).toBe(false);

    const updated = await request(app)
      .put(`/api/attendance/${second.body._id}`)
      .send({ status: 'Present', markedBy: 'Prof. Menon' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('Present');

    const reportAfter = await request(app).get('/api/attendance/CS2025004');
    expect(reportAfter.status).toBe(200);
    expect(reportAfter.body.percentage).toBe(100);
    expect(reportAfter.body.eligible).toBe(true);

    const subjectRes = await request(app).get('/api/attendance/CS2025004/subjects');
    expect(subjectRes.status).toBe(200);
    expect(subjectRes.body.subjects[0].subject).toBe('Networks');
    expect(subjectRes.body.subjects[0].percentage).toBe(100);

    const logs = readAttendanceLogsForRoll('CS2025004', logPath);
    expect(logs.length).toBe(3);
    expect(logs[2]).toContain('UPDATED | CS2025004 | Networks | 2026-11-11 | Present | by Prof. Menon');
  });
});
