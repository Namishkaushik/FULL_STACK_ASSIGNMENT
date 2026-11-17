import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    studentRollNo: {
      type: String,
      required: [true, 'Student roll number is required'],
      index: true,
      trim: true,
      uppercase: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    status: {
      type: String,
      required: [true, 'Attendance status is required'],
      enum: {
        values: ['Present', 'Absent'],
        message: 'Status must be either Present or Absent',
      },
    },
    markedBy: {
      type: String,
      required: [true, 'Faculty identifier is required'],
      trim: true,
      default: 'Faculty',
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ studentRollNo: 1, subject: 1, date: 1 }, { unique: true });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export default Attendance;
