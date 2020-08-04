import "projection";

function kavrayskiy7(λ, φ) {
  return [
    3 * λ / (2 * π) * Math.sqrt(π * π / 3 - φ * φ),
    φ
  ];
}

kavrayskiy7.invert = function(x, y) {
  return [
    2 / 3 * π * x / Math.sqrt(π * π / 3 - y * y),
    y
  ];
};

(d3.geo.kavrayskiy7 = function() { return projection(kavrayskiy7); }).raw = kavrayskiy7;
