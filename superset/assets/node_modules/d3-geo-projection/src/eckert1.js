import "projection";

function eckert1(λ, φ) {
  var α = Math.sqrt(8 / (3 * π));
  return [
    α * λ * (1 - Math.abs(φ) / π),
    α * φ
  ];
}

eckert1.invert = function(x, y) {
  var α = Math.sqrt(8 / (3 * π)),
      φ = y / α;
  return [
    x / (α * (1 - Math.abs(φ) / π)),
    φ
  ];
};

(d3.geo.eckert1 = function() { return projection(eckert1); }).raw = eckert1;
