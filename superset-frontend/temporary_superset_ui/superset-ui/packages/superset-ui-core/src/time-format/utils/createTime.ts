export default function createTime(
  mode: 'local' | 'utc',
  year: number,
  month = 0,
  date = 1,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): Date {
  const args = [year, month, date, hours, minutes, seconds, milliseconds] as const;
  return mode === 'local' ? new Date(...args) : new Date(Date.UTC(...args));
}
