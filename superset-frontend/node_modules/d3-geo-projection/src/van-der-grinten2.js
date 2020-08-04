import "projection";

function vanDerGrinten2(λ, φ) {
  if (Math.abs(φ) < ε) return [λ, 0];
  var sinθ = Math.abs(φ / halfπ),
      θ = asin(sinθ);
  if (Math.abs(λ) < ε || Math.abs(Math.abs(φ) - halfπ) < ε) return [0, sgn(φ) * π * Math.tan(θ / 2)];
  var cosθ = Math.cos(θ),
      A = Math.abs(π / λ - λ / π) / 2,
      A2 = A * A,
      x1 = cosθ * (Math.sqrt(1 + A2) - A * cosθ) / (1 + A2 * sinθ * sinθ);
  return [
    sgn(λ) * π * x1,
    sgn(φ) * π * asqrt(1 - x1 * (2 * A + x1))
  ];
}

vanDerGrinten2.invert = function(x, y) {
  if (!x) return [0, halfπ * Math.sin(2 * Math.atan(y / π))];
  var x1 = Math.abs(x / π),
      A = (1 - x1 * x1 - (y /= π) * y) / (2 * x1),
      A2 = A * A,
      B = Math.sqrt(A2 + 1);
  return [
    sgn(x) * π * (B - A),
    sgn(y) * halfπ * Math.sin(2 * Math.atan2(Math.sqrt((1 - 2 * A * x1) * (A + B) - x1), Math.sqrt(B + A + x1)))
  ];
};

(d3.geo.vanDerGrinten2 = function() { return projection(vanDerGrinten2); }).raw = vanDerGrinten2;
