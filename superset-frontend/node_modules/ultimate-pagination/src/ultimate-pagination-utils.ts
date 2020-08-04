export function createRange(start: number, end: number): number[] {
  let range: number[] = [];
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  return range;
}
