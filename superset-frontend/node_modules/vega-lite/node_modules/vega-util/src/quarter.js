export function quarter(date) {
  return 1 + ~~(new Date(date).getMonth() / 3);
}

export function utcquarter(date) {
  return 1 + ~~(new Date(date).getUTCMonth() / 3);
}
