import "projection";

function polyconic(λ, φ) {
  if (Math.abs(φ) < ε) return [λ, 0];
  var tanφ = Math.tan(φ),
      k = λ * Math.sin(φ);
  return [
    Math.sin(k) / tanφ,
    φ + (1 - Math.cos(k)) / tanφ
  ];
}

polyconic.invert = function(x, y) {
  if (Math.abs(y) < ε) return [x, 0];
  var k = x * x + y * y,
      φ = y * .5,
      i = 10, δ;
  do {
    var tanφ = Math.tan(φ),
        secφ = 1 / Math.cos(φ),
        j = k - 2 * y * φ + φ * φ;
    φ -= δ = (tanφ * j + 2 * (φ - y)) / (2 + j * secφ * secφ + 2 * (φ - y) * tanφ);
  } while (Math.abs(δ) > ε && --i > 0);
  tanφ = Math.tan(φ);
  return [
    (Math.abs(y) < Math.abs(φ + 1 / tanφ) ? asin(x * tanφ) : sgn(x) * (acos(Math.abs(x * tanφ)) + halfπ)) / Math.sin(φ),
    φ
  ];
};

(d3.geo.polyconic = function() { return projection(polyconic); }).raw = polyconic;
