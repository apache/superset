export default function stringifyTimeInput(
  value: Date | number | undefined | null,
  fn: (time: Date) => string,
) {
  if (value === null || value === undefined) {
    return `${value}`;
  }

  return fn(value instanceof Date ? value : new Date(value));
}
