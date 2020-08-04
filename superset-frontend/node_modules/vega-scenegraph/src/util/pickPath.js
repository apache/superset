export function pickArea(a, p) {
  var v = a[0].orient === 'horizontal' ? p[1] : p[0],
      z = a[0].orient === 'horizontal' ? 'y' : 'x',
      i = a.length,
      min = +Infinity, hit, d;

  while (--i >= 0) {
    if (a[i].defined === false) continue;
    d = Math.abs(a[i][z] - v);
    if (d < min) {
      min = d;
      hit = a[i];
    }
  }

  return hit;
}

export function pickLine(a, p) {
  var t = Math.pow(a[0].strokeWidth || 1, 2),
      i = a.length, dx, dy, dd;

  while (--i >= 0) {
    if (a[i].defined === false) continue;
    dx = a[i].x - p[0];
    dy = a[i].y - p[1];
    dd = dx * dx + dy * dy;
    if (dd < t) return a[i];
  }

  return null;
}

export function pickTrail(a, p) {
  var i = a.length, dx, dy, dd;

  while (--i >= 0) {
    if (a[i].defined === false) continue;
    dx = a[i].x - p[0];
    dy = a[i].y - p[1];
    dd = dx * dx + dy * dy;
    dx = a[i].size || 1;
    if (dd < dx*dx) return a[i];
  }

  return null;
}
