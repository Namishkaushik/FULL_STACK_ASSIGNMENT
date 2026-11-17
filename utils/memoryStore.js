import {
  calculateAttendanceSummary,
  calculateSubjectBreakdown,
  isValidDateYYYYMMDD,
} from './attendanceCalc.js';

export const SAMPLE_STUDENTS = [
  {
    rollNo: 'CS2024001',
    name: 'Aarav Sharma',
    course: 'B.Tech Computer Science',
    semester: 4,
    email: 'aarav.sharma@university.edu',
  },
  {
    rollNo: 'CS2024002',
    name: 'Priya Nair',
    course: 'B.Tech Computer Science',
    semester: 4,
    email: 'priya.nair@university.edu',
  },
  {
    rollNo: 'DS2024014',
    name: 'Rohan Kulkarni',
    course: 'B.Tech Data Science',
    semester: 6,
    email: 'rohan.kulkarni@university.edu',
  },
  {
    rollNo: 'EC2024008',
    name: 'Meera Iyer',
    course: 'B.Tech Electronics & Comm.',
    semester: 4,
    email: 'meera.iyer@university.edu',
  },
  {
    rollNo: 'CS2024019',
    name: 'Kabir Verma',
    course: 'B.Tech Computer Science',
    semester: 2,
    email: 'kabir.verma@university.edu',
  },
];

export const SAMPLE_ATTENDANCE = [
  // CS2024001 - Aarav Sharma (83.33% - Eligible)
  { studentRollNo: 'CS2024001', subject: 'Data Structures', date: '2026-11-02', status: 'Present', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024001', subject: 'Data Structures', date: '2026-11-05', status: 'Present', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024001', subject: 'Data Structures', date: '2026-11-09', status: 'Present', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024001', subject: 'Database Systems', date: '2026-11-03', status: 'Present', markedBy: 'Prof. Vikram Menon' },
  { studentRollNo: 'CS2024001', subject: 'Database Systems', date: '2026-11-06', status: 'Absent', markedBy: 'Prof. Vikram Menon' },
  { studentRollNo: 'CS2024001', subject: 'Operating Systems', date: '2026-11-04', status: 'Present', markedBy: 'Dr. S. Krishnan' },

  // CS2024002 - Priya Nair (50% - Shortage < 75%)
  { studentRollNo: 'CS2024002', subject: 'Data Structures', date: '2026-11-02', status: 'Present', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024002', subject: 'Data Structures', date: '2026-11-05', status: 'Absent', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024002', subject: 'Data Structures', date: '2026-11-09', status: 'Absent', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024002', subject: 'Database Systems', date: '2026-11-03', status: 'Present', markedBy: 'Prof. Vikram Menon' },
  { studentRollNo: 'CS2024002', subject: 'Database Systems', date: '2026-11-06', status: 'Absent', markedBy: 'Prof. Vikram Menon' },
  { studentRollNo: 'CS2024002', subject: 'Operating Systems', date: '2026-11-04', status: 'Present', markedBy: 'Dr. S. Krishnan' },

  // DS2024014 - Rohan Kulkarni (100% - Eligible)
  { studentRollNo: 'DS2024014', subject: 'Machine Learning', date: '2026-11-02', status: 'Present', markedBy: 'Dr. Kavita Joshi' },
  { studentRollNo: 'DS2024014', subject: 'Machine Learning', date: '2026-11-05', status: 'Present', markedBy: 'Dr. Kavita Joshi' },
  { studentRollNo: 'DS2024014', subject: 'Database Systems', date: '2026-11-03', status: 'Present', markedBy: 'Prof. Vikram Menon' },
  { studentRollNo: 'DS2024014', subject: 'Computer Networks', date: '2026-11-07', status: 'Present', markedBy: 'Prof. R. Deshmukh' },

  // EC2024008 - Meera Iyer (75% - Eligible exact boundary)
  { studentRollNo: 'EC2024008', subject: 'Digital Signal Processing', date: '2026-11-02', status: 'Present', markedBy: 'Dr. N. Subramanian' },
  { studentRollNo: 'EC2024008', subject: 'Digital Signal Processing', date: '2026-11-05', status: 'Present', markedBy: 'Dr. N. Subramanian' },
  { studentRollNo: 'EC2024008', subject: 'Computer Networks', date: '2026-11-07', status: 'Present', markedBy: 'Prof. R. Deshmukh' },
  { studentRollNo: 'EC2024008', subject: 'Computer Networks', date: '2026-11-10', status: 'Absent', markedBy: 'Prof. R. Deshmukh' },

  // CS2024019 - Kabir Verma (66.67% - Shortage)
  { studentRollNo: 'CS2024019', subject: 'Data Structures', date: '2026-11-02', status: 'Present', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024019', subject: 'Data Structures', date: '2026-11-05', status: 'Absent', markedBy: 'Dr. Ananya Rao' },
  { studentRollNo: 'CS2024019', subject: 'Operating Systems', date: '2026-11-04', status: 'Present', markedBy: 'Dr. S. Krishnan' },
];

class MemoryStore {
  constructor({ seed = true } = {}) {
    this.students = [];
    this.attendance = [];
    this.seq = 1;
    if (seed) {
      this.seedDefaults();
    }
  }

  reset({ seed = false } = {}) {
    this.students = [];
    this.attendance = [];
    this.seq = 1;
    if (seed) {
      this.seedDefaults();
    }
  }

  seedDefaults() {
    const now = new Date().toISOString();
    for (const s of SAMPLE_STUDENTS) {
      this.students.push({
        _id: `stu_${this.seq++}`,
        ...s,
        rollNo: s.rollNo.toUpperCase(),
        email: s.email.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const a of SAMPLE_ATTENDANCE) {
      this.attendance.push({
        _id: `att_${this.seq++}`,
        ...a,
        studentRollNo: a.studentRollNo.toUpperCase(),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  createValidationError(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
  }

  createConflictError(message) {
    const err = new Error(message);
    err.status = 409;
    return err;
  }

  createNotFoundError(message) {
    const err = new Error(message);
    err.status = 404;
    return err;
  }

  async createStudent(payload) {
    const rollNo = String(payload.rollNo || '').trim().toUpperCase();
    const name = String(payload.name || '').trim();
    const course = String(payload.course || '').trim();
    const semester = Number(payload.semester);
    const email = String(payload.email || '').trim().toLowerCase();

    if (!rollNo) throw this.createValidationError('Roll number is required');
    if (!name || name.length < 2) throw this.createValidationError('Student name must be at least 2 characters');
    if (!course) throw this.createValidationError('Course is required');
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      throw this.createValidationError('Semester must be a whole number between 1 and 8');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw this.createValidationError('Please provide a valid university email address');
    }

    if (this.students.some((s) => s.rollNo === rollNo)) {
      throw this.createConflictError(`Student with roll number ${rollNo} already exists`);
    }

    const now = new Date().toISOString();
    const doc = {
      _id: `stu_${this.seq++}`,
      rollNo,
      name,
      course,
      semester,
      email,
      createdAt: now,
      updatedAt: now,
    };
    this.students.push(doc);
    return { ...doc };
  }

  async listStudents({ q = '', semester = '' } = {}) {
    const query = String(q).trim().toLowerCase();
    const semFilter = semester !== '' && semester !== undefined ? Number(semester) : null;

    return this.students
      .filter((s) => {
        if (semFilter !== null && !Number.isNaN(semFilter) && s.semester !== semFilter) {
          return false;
        }
        if (!query) return true;
        return (
          s.rollNo.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.course.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo))
      .map((s) => ({ ...s }));
  }

  async findStudentByRollNo(rollNo) {
    const normalized = String(rollNo || '').trim().toUpperCase();
    const found = this.students.find((s) => s.rollNo === normalized);
    return found ? { ...found } : null;
  }

  async listAttendance({ subject = '', date = '' } = {}) {
    const subj = String(subject).trim().toLowerCase();
    const dt = String(date).trim();

    return this.attendance
      .filter((r) => {
        if (subj && r.subject.toLowerCase() !== subj) return false;
        if (dt && r.date !== dt) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.studentRollNo.localeCompare(b.studentRollNo))
      .map((r) => ({ ...r }));
  }

  async markAttendance(payload) {
    const studentRollNo = String(payload.studentRollNo || '').trim().toUpperCase();
    const subject = String(payload.subject || '').trim();
    const date = String(payload.date || '').trim();
    const status = String(payload.status || '').trim();
    const markedBy = String(payload.markedBy || 'Faculty').trim() || 'Faculty';

    if (!studentRollNo) throw this.createValidationError('Student roll number is required');
    if (!subject) throw this.createValidationError('Subject is required');
    if (!isValidDateYYYYMMDD(date)) throw this.createValidationError('Date must be a valid YYYY-MM-DD value');
    if (!['Present', 'Absent'].includes(status)) {
      throw this.createValidationError('Status must be either Present or Absent');
    }

    const student = await this.findStudentByRollNo(studentRollNo);
    if (!student) {
      throw this.createNotFoundError(`Student with roll number ${studentRollNo} not found`);
    }

    const duplicate = this.attendance.find(
      (r) =>
        r.studentRollNo === studentRollNo &&
        r.subject.toLowerCase() === subject.toLowerCase() &&
        r.date === date
    );

    if (duplicate) {
      throw this.createConflictError(
        `Attendance already marked for ${studentRollNo} in ${subject} on ${date}`
      );
    }

    const now = new Date().toISOString();
    const doc = {
      _id: `att_${this.seq++}`,
      studentRollNo,
      subject,
      date,
      status,
      markedBy,
      createdAt: now,
      updatedAt: now,
    };
    this.attendance.push(doc);
    return { ...doc };
  }

  async getStudentAttendance(rollNo) {
    const normalized = String(rollNo || '').trim().toUpperCase();
    const student = await this.findStudentByRollNo(normalized);
    if (!student) {
      throw this.createNotFoundError(`Student with roll number ${normalized} not found`);
    }

    const records = this.attendance
      .filter((r) => r.studentRollNo === normalized)
      .sort((a, b) => b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject))
      .map((r) => ({ ...r }));

    const summary = calculateAttendanceSummary(records);

    return {
      rollNo: normalized,
      student,
      ...summary,
      records,
    };
  }

  async getStudentSubjectBreakdown(rollNo) {
    const normalized = String(rollNo || '').trim().toUpperCase();
    const student = await this.findStudentByRollNo(normalized);
    if (!student) {
      throw this.createNotFoundError(`Student with roll number ${normalized} not found`);
    }

    const records = this.attendance.filter((r) => r.studentRollNo === normalized);
    return {
      rollNo: normalized,
      subjects: calculateSubjectBreakdown(records),
    };
  }

  async updateAttendance(id, payload) {
    const record = this.attendance.find((r) => r._id === id);
    if (!record) {
      throw this.createNotFoundError(`Attendance record ${id} not found`);
    }

    const status = String(payload.status || '').trim();
    if (!['Present', 'Absent'].includes(status)) {
      throw this.createValidationError('Status must be either Present or Absent');
    }

    record.status = status;
    if (payload.markedBy && String(payload.markedBy).trim()) {
      record.markedBy = String(payload.markedBy).trim();
    }
    record.updatedAt = new Date().toISOString();

    return { ...record };
  }
}

export default MemoryStore;
