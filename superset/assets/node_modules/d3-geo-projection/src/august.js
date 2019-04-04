import "projection";
import "hyperbolic";

function august(λ, φ) {
  var tanφ = Math.tan(φ / 2),
      k = asqrt(1 - tanφ * tanφ),
      c = 1 + k * Math.cos(λ /= 2),
      x = Math.sin(λ) * k / c,
      y = tanφ / c,
      x2 = x * x,
      y2 = y * y;
  return [
    4 / 3 * x * (3 + x2 - 3 * y2),
    4 / 3 * y * (3 + 3 * x2 - y2)
  ];
}

august.invert = function(x, y) {
  x *= 3 / 8, y *= 3 / 8;
  if (!x && Math.abs(y) > 1) return null;
  var x2 = x * x,
      y2 = y * y,
      s = 1 + x2 + y2,
      sin3η = Math.sqrt(.5 * (s - Math.sqrt(s * s - 4 * y * y))),
      η = asin(sin3η) / 3,
      ξ = sin3η ? arcosh(Math.abs(y / sin3η)) / 3 : arsinh(Math.abs(x)) / 3,
      cosη = Math.cos(η),
      coshξ = cosh(ξ),
      d = coshξ * coshξ - cosη * cosη;
  return [
    sgn(x) * 2 * Math.atan2(sinh(ξ) * cosη, .25 - d),
    sgn(y) * 2 * Math.atan2(coshξ * Math.sin(η), .25 + d)
  ];
};

(d3.geo.august = function() { return projection(august); }).raw = august;
