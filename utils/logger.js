import fs from 'node:fs';
import path from 'node:path';

export function getLogFilePath() {
  return process.env.ATTENDANCE_LOG_PATH || path.join(process.cwd(), 'logs', 'attendance.log');
}

export function formatLogLine({ action = 'MARKED', rollNo, subject, date, status, markedBy = 'Faculty' }) {
  const timestamp = new Date().toISOString();
  const cleanRoll = String(rollNo || '').trim().toUpperCase();
  const cleanSubject = String(subject || '').trim();
  const cleanDate = String(date || '').trim();
  const cleanStatus = String(status || '').trim();
  const cleanFaculty = String(markedBy || 'Faculty').trim();
  return `${timestamp} | ${action} | ${cleanRoll} | ${cleanSubject} | ${cleanDate} | ${cleanStatus} | by ${cleanFaculty}\n`;
}

export function logAttendance(entry, customLogPath) {
  const logPath = customLogPath || getLogFilePath();
  const dir = path.dirname(logPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const line = formatLogLine(entry);

  return new Promise((resolve, reject) => {
    fs.appendFile(logPath, line, 'utf8', (err) => {
      if (err) {
        return reject(err);
      }
      resolve(line);
    });
  });
}

export function readAttendanceLogsForRoll(rollNo, customLogPath) {
  const logPath = customLogPath || getLogFilePath();
  if (!fs.existsSync(logPath)) {
    return [];
  }

  const normalizedRoll = String(rollNo || '').trim().toUpperCase();
  const content = fs.readFileSync(logPath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const parts = line.split('|').map((part) => part.trim());
      return parts.length >= 3 && parts[2].toUpperCase() === normalizedRoll;
    });
}
