export default function createTime(
  mode: 'local' | 'utc',
  year: number,
  month: number = 0,
  date: number = 1,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0,
): Date {
  const args = [year, month, date, hours, minutes, seconds, milliseconds] as const;
  return mode === 'local' ? new Date(...args) : new Date(Date.UTC(...args));
}
