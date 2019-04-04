import "projection";

function eckert2(λ, φ) {
  var α = Math.sqrt(4 - 3 * Math.sin(Math.abs(φ)));
  return [
    2 / Math.sqrt(6 * π) * λ * α,
    sgn(φ) * Math.sqrt(2 * π / 3) * (2 - α)
  ];
}

eckert2.invert = function(x, y) {
  var α = 2 - Math.abs(y) / Math.sqrt(2 * π / 3);
  return [
    x * Math.sqrt(6 * π) / (2 * α),
    sgn(y) * asin((4 - α * α) / 3)
  ];
};

(d3.geo.eckert2 = function() { return projection(eckert2); }).raw = eckert2;
