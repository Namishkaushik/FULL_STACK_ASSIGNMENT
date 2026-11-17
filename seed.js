import 'dotenv/config';
import mongoose from 'mongoose';
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import { SAMPLE_STUDENTS, SAMPLE_ATTENDANCE } from './utils/memoryStore.js';
import { logAttendance } from './utils/logger.js';

async function seedDatabase() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendance';
  console.log(`Connecting to MongoDB at ${mongoUri}...`);

  await mongoose.connect(mongoUri);

  try {
    await Student.deleteMany({});
    await Attendance.deleteMany({});

    const insertedStudents = await Student.insertMany(SAMPLE_STUDENTS);
    const insertedAttendance = await Attendance.insertMany(SAMPLE_ATTENDANCE);

    for (const entry of insertedAttendance) {
      await logAttendance({
        action: 'MARKED',
        rollNo: entry.studentRollNo,
        subject: entry.subject,
        date: entry.date,
        status: entry.status,
        markedBy: entry.markedBy,
      });
    }

    console.log(
      `Seeded ${insertedStudents.length} students and ${insertedAttendance.length} attendance records.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
