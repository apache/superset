import {abs, epsilon, epsilon2} from "./math.js";

// Approximate Newton-Raphson
// Solve f(x) = y, start from x
export function solve(f, y, x) {
  var steps = 100, delta, f0, f1;
  x = x === undefined ? 0 : +x;
  y = +y;
  do {
    f0 = f(x);
    f1 = f(x + epsilon);
    if (f0 === f1) f1 = f0 + epsilon;
    x -= delta = (-1 * epsilon * (f0 - y)) / (f0 - f1);
  } while (steps-- > 0 && abs(delta) > epsilon);
  return steps < 0 ? NaN : x;
}

// Approximate Newton-Raphson in 2D
// Solve f(a,b) = [x,y]
export function solve2d(f, MAX_ITERATIONS, eps) {
  if (MAX_ITERATIONS === undefined) MAX_ITERATIONS = 40;
  if (eps === undefined) eps = epsilon2;
  return function(x, y, a, b) {
    var err2, da, db;
    a = a === undefined ? 0 : +a;
    b = b === undefined ? 0 : +b;
    for (var i = 0; i < MAX_ITERATIONS; i++) {
      var p = f(a, b),
        // diffs
        tx = p[0] - x,
        ty = p[1] - y;
      if (abs(tx) < eps && abs(ty) < eps) break; // we're there!

      // backtrack if we overshot
      var h = tx * tx + ty * ty;
      if (h > err2) {
        a -= da /= 2;
        b -= db /= 2;
        continue;
      }
      err2 = h;

      // partial derivatives
      var ea = (a > 0 ? -1 : 1) * eps,
        eb = (b > 0 ? -1 : 1) * eps,
        pa = f(a + ea, b),
        pb = f(a, b + eb),
        dxa = (pa[0] - p[0]) / ea,
        dya = (pa[1] - p[1]) / ea,
        dxb = (pb[0] - p[0]) / eb,
        dyb = (pb[1] - p[1]) / eb,
        // determinant
        D = dyb * dxa - dya * dxb,
        // newton step — or half-step for small D
        l = (abs(D) < 0.5 ? 0.5 : 1) / D;
      da = (ty * dxb - tx * dyb) * l;
      db = (tx * dya - ty * dxa) * l;
      a += da;
      b += db;
      if (abs(da) < eps && abs(db) < eps) break; // we're crawling
    }
    return [a, b];
  };
}