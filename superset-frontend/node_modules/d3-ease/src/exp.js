export function expIn(t) {
  return Math.pow(2, 10 * t - 10);
}

export function expOut(t) {
  return 1 - Math.pow(2, -10 * t);
}

export function expInOut(t) {
  return ((t *= 2) <= 1 ? Math.pow(2, 10 * t - 10) : 2 - Math.pow(2, 10 - 10 * t)) / 2;
}
