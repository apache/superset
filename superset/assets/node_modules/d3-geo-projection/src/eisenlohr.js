import "projection";
import "august";

function eisenlohr(λ, φ) {
  var s0 = Math.sin(λ /= 2),
      c0 = Math.cos(λ),
      k = Math.sqrt(Math.cos(φ)),
      c1 = Math.cos(φ /= 2),
      t = Math.sin(φ) / (c1 + Math.SQRT2 * c0 * k),
      c = Math.sqrt(2 / (1 + t * t)),
      v = Math.sqrt((Math.SQRT2 * c1 + (c0 + s0) * k) / (Math.SQRT2 * c1 + (c0 - s0) * k));
  return [
    eisenlohrK * (c * (v - 1 / v) - 2 * Math.log(v)),
    eisenlohrK * (c * t * (v + 1 / v) - 2 * Math.atan(t))
  ];
}

eisenlohr.invert = function(x, y) {
  var p = d3.geo.august.raw.invert(x / 1.2, y * 1.065);
  if (!p) return null;
  var λ = p[0],
      φ = p[1],
      i = 20;
  x /= eisenlohrK, y /= eisenlohrK;
  do {
    var _0 = λ / 2,
        _1 = φ / 2,
        s0 = Math.sin(_0),
        c0 = Math.cos(_0),
        s1 = Math.sin(_1),
        c1 = Math.cos(_1),
        cos1 = Math.cos(φ),

        k = Math.sqrt(cos1),
        t = s1 / (c1 + Math.SQRT2 * c0 * k),
        t2 = t * t,
        c = Math.sqrt(2 / (1 + t2)),
        v0 = (Math.SQRT2 * c1 + (c0 + s0) * k),
        v1 = (Math.SQRT2 * c1 + (c0 - s0) * k),
        v2 = v0 / v1,
        v = Math.sqrt(v2),
        vm1v = v - 1 / v,
        vp1v = v + 1 / v,

        fx = c * vm1v - 2 * Math.log(v) - x,
        fy = c * t * vp1v - 2 * Math.atan(t) - y,

        δtδλ = s1 && Math.SQRT1_2 * k * s0 * t2 / s1,
        δtδφ = (Math.SQRT2 * c0 * c1 + k) / (2 * (c1 + Math.SQRT2 * c0 * k) * (c1 + Math.SQRT2 * c0 * k) * k),

        δcδt = -.5 * t * c * c * c,
        δcδλ = δcδt * δtδλ,
        δcδφ = δcδt * δtδφ,

        A = (A = 2 * c1 + Math.SQRT2 * k * (c0 - s0)) * A * v,
        δvδλ = (Math.SQRT2 * c0 * c1 * k + cos1) / A,
        δvδφ = -(Math.SQRT2 * s0 * s1) / (k * A),

        δxδλ = vm1v * δcδλ - 2 * δvδλ / v + c * (δvδλ + δvδλ / v2),
        δxδφ = vm1v * δcδφ - 2 * δvδφ / v + c * (δvδφ + δvδφ / v2),
        δyδλ = t * vp1v * δcδλ - 2 * δtδλ / (1 + t2) + c * vp1v * δtδλ + c * t * (δvδλ - δvδλ / v2),
        δyδφ = t * vp1v * δcδφ - 2 * δtδφ / (1 + t2) + c * vp1v * δtδφ + c * t * (δvδφ - δvδφ / v2),

        denominator = δxδφ * δyδλ - δyδφ * δxδλ;
    if (!denominator) break;
    var δλ = (fy * δxδφ - fx * δyδφ) / denominator,
        δφ = (fx * δyδλ - fy * δxδλ) / denominator;
    λ -= δλ;
    φ = Math.max(-halfπ, Math.min(halfπ, φ - δφ));
  } while ((Math.abs(δλ) > ε || Math.abs(δφ) > ε) && --i > 0);
  return Math.abs(Math.abs(φ) - halfπ) < ε
      ? [0, φ]
      : i && [λ, φ];
};

var eisenlohrK = 3 + 2 * Math.SQRT2;

(d3.geo.eisenlohr = function() { return projection(eisenlohr); }).raw = eisenlohr;
