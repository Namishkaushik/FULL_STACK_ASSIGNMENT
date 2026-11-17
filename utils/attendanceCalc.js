export function calculateAttendanceSummary(records = []) {
  const total = Array.isArray(records) ? records.length : 0;
  const present = Array.isArray(records)
    ? records.filter((r) => r.status === 'Present').length
    : 0;
  const absent = total - present;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100;
  const eligible = percentage >= 75;

  return {
    total,
    present,
    absent,
    percentage,
    eligible,
  };
}

export function calculateSubjectBreakdown(records = []) {
  const map = new Map();

  for (const record of records) {
    const subject = String(record.subject || '').trim();
    if (!subject) continue;
    if (!map.has(subject)) {
      map.set(subject, { subject, total: 0, present: 0, absent: 0 });
    }
    const entry = map.get(subject);
    entry.total += 1;
    if (record.status === 'Present') {
      entry.present += 1;
    } else {
      entry.absent += 1;
    }
  }

  return Array.from(map.values())
    .map((item) => {
      const percentage =
        item.total === 0 ? 0 : Math.round((item.present / item.total) * 10000) / 100;
      return {
        ...item,
        percentage,
        eligible: percentage >= 75,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export function isValidDateYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}
