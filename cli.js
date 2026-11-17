#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { getTodayDateString, isValidDateYYYYMMDD } from './utils/attendanceCalc.js';
import { logAttendance, readAttendanceLogsForRoll, getLogFilePath } from './utils/logger.js';

const parser = yargs(hideBin(process.argv))
  .scriptName('attendance-cli')
  .usage('Usage: $0 <command> [options]')
  .command(
    'mark',
    'Mark attendance for a student and append an entry to logs/attendance.log',
    (y) =>
      y
        .option('roll', {
          type: 'string',
          demandOption: true,
          describe: 'Student roll number (e.g. CS2024001)',
        })
        .option('subject', {
          type: 'string',
          demandOption: true,
          describe: 'Subject name (e.g. "Data Structures")',
        })
        .option('status', {
          type: 'string',
          demandOption: true,
          choices: ['Present', 'Absent'],
          describe: 'Attendance status',
        })
        .option('date', {
          type: 'string',
          default: getTodayDateString(),
          describe: 'Date in YYYY-MM-DD format (defaults to today)',
        })
        .option('by', {
          type: 'string',
          default: 'CLI-Faculty',
          describe: 'Faculty name marking the attendance',
        }),
    async (argv) => {
      if (!isValidDateYYYYMMDD(argv.date)) {
        console.error(`Error: Invalid date "${argv.date}". Expected YYYY-MM-DD.`);
        process.exitCode = 1;
        return;
      }

      const line = await logAttendance({
        action: 'MARKED',
        rollNo: argv.roll,
        subject: argv.subject,
        date: argv.date,
        status: argv.status,
        markedBy: argv.by,
      });

      console.log(`Logged to ${getLogFilePath()}:`);
      console.log(line.trim());
    }
  )
  .command(
    'report',
    'Print attendance audit log lines for a given student roll number',
    (y) =>
      y.option('roll', {
        type: 'string',
        demandOption: true,
        describe: 'Student roll number to inspect',
      }),
    (argv) => {
      const roll = String(argv.roll).trim().toUpperCase();
      const lines = readAttendanceLogsForRoll(roll);

      if (lines.length === 0) {
        console.log(`No attendance log entries found for roll number ${roll}.`);
        return;
      }

      console.log(`Attendance audit log for ${roll} (${lines.length} entries):`);
      console.log('-'.repeat(72));
      for (const line of lines) {
        console.log(line);
      }
    }
  )
  .demandCommand(1, 'Please specify a command: "mark" or "report".')
  .strict()
  .help()
  .alias('h', 'help');

parser.parse();
