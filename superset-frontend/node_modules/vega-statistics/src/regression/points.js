export function points(data, x, y, sort) {
  data = data.filter(d => {
    let u = x(d), v = y(d);
    return u != null && (u = +u) >= u && v != null && (v = +v) >= v;
  });

  if (sort) {
    data.sort((a, b) => x(a) - x(b));
  }

  const n = data.length,
        X = new Float64Array(n),
        Y = new Float64Array(n);

  // extract values, calculate means
  let i = 0, ux = 0, uy = 0, xv, yv, d;
  for (d of data) {
    X[i] = xv = +x(d);
    Y[i] = yv = +y(d);
    ++i;
    ux += (xv - ux) / i;
    uy += (yv - uy) / i;
  }

  // mean center the data
  for (i=0; i<n; ++i) {
    X[i] -= ux;
    Y[i] -= uy;
  }

  return [X, Y, ux, uy];
}

export function visitPoints(data, x, y, callback) {
  let i = -1, u, v;

  for (let d of data) {
    u = x(d);
    v = y(d);
    if (u != null && (u = +u) >= u && v != null && (v = +v) >= v) {
      callback(u, v, ++i);
    }
  }
}
