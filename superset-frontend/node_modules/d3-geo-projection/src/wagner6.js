import "projection";

function wagner6(λ, φ) {
  return [
    λ * Math.sqrt(1 - 3 * φ * φ / (π * π)),
    φ
  ];
}

wagner6.invert = function(x, y) {
  return [
    x / Math.sqrt(1 - 3 * y * y / (π * π)),
    y
  ];
};

(d3.geo.wagner6 = function() { return projection(wagner6); }).raw = wagner6;
