import "projection";

function lagrange(n) {
  function forward(λ, φ) {
    if (Math.abs(Math.abs(φ) - halfπ) < ε) return [0, φ < 0 ? -2 : 2];
    var sinφ = Math.sin(φ),
        v = Math.pow((1 + sinφ) / (1 - sinφ), n / 2),
        c = .5 * (v + 1 / v) + Math.cos(λ *= n);
    return [
      2 * Math.sin(λ) / c,
      (v - 1 / v) / c
    ];
  }

  forward.invert = function(x, y) {
    var y0 = Math.abs(y);
    if (Math.abs(y0 - 2) < ε) return x ? null : [0, sgn(y) * halfπ];
    if (y0 > 2) return null;

    x /= 2, y /= 2;
    var x2 = x * x,
        y2 = y * y,
        t = 2 * y / (1 + x2 + y2); // tanh(nφ)
    t = Math.pow((1 + t) / (1 - t), 1 / n);
    return [
      Math.atan2(2 * x, 1 - x2 - y2) / n,
      asin((t - 1) / (t + 1))
    ];
  };

  return forward;
}

function lagrangeProjection() {
  var n = .5,
      m = projectionMutator(lagrange),
      p = m(n);

  p.spacing = function(_) {
    if (!arguments.length) return n;
    return m(n = +_);
  };

  return p;
}

(d3.geo.lagrange = lagrangeProjection).raw = lagrange;
