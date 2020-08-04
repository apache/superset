import "projection";

function vanDerGrinten3(λ, φ) {
  if (Math.abs(φ) < ε) return [λ, 0];
  var sinθ = φ / halfπ,
      θ = asin(sinθ);
  if (Math.abs(λ) < ε || Math.abs(Math.abs(φ) - halfπ) < ε) return [0, π * Math.tan(θ / 2)];
  var A = (π / λ - λ / π) / 2,
      y1 = sinθ / (1 + Math.cos(θ));
  return [
    π * (sgn(λ) * asqrt(A * A + 1 - y1 * y1) - A),
    π * y1
  ];
}

vanDerGrinten3.invert = function(x, y) {
  if (!y) return [x, 0];
  var y1 = y / π,
      A = (π * π * (1 - y1 * y1) - x * x) / (2 * π * x);
  return [
    x ? π * (sgn(x) * Math.sqrt(A * A + 1) - A) : 0,
    halfπ * Math.sin(2 * Math.atan(y1))
  ];
};

(d3.geo.vanDerGrinten3 = function() { return projection(vanDerGrinten3); }).raw = vanDerGrinten3;
