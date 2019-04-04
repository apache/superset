import "projection";

var bakerφ = Math.log(1 + Math.SQRT2);

function baker(λ, φ) {
  var φ0 = Math.abs(φ);
  return φ0 < π / 4
      ? [λ, Math.log(Math.tan(π / 4 + φ / 2))]
      : [
        λ * Math.cos(φ0) * (2 * Math.SQRT2 - 1 / Math.sin(φ0)),
        sgn(φ) * (2 * Math.SQRT2 * (φ0 - π / 4) - Math.log(Math.tan(φ0 / 2)))
      ];
}

baker.invert = function(x, y) {
  if ((y0 = Math.abs(y)) < bakerφ) return [x, 2 * Math.atan(Math.exp(y)) - halfπ];
  var sqrt8 = Math.sqrt(8),
      φ = π / 4, i = 25, δ, y0;
  do {
    var cosφ_2 = Math.cos(φ / 2),
        tanφ_2 = Math.tan(φ / 2);
    φ -= δ = (sqrt8 * (φ - π / 4) - Math.log(tanφ_2) - y0) / (sqrt8 - .5 * cosφ_2 * cosφ_2 / tanφ_2);
  } while (Math.abs(δ) > ε2 && --i > 0);
  return [
    x / (Math.cos(φ) * (sqrt8 - 1 / Math.sin(φ))),
    sgn(y) * φ
  ];
};

(d3.geo.baker = function() { return projection(baker); }).raw = baker;
