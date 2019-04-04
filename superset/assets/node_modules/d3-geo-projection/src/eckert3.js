import "projection";

function eckert3(λ, φ) {
  var k = Math.sqrt(π * (4 + π));
  return [
    2 / k * λ * (1 + Math.sqrt(1 - 4 * φ * φ / (π * π))),
    4 / k * φ
  ];
}

eckert3.invert = function(x, y) {
  var k = Math.sqrt(π * (4 + π)) / 2;
  return [
    x * k / (1 + asqrt(1 - y * y * (4 + π) / (4 * π))),
    y * k / 2
  ];
};

(d3.geo.eckert3 = function() { return projection(eckert3); }).raw = eckert3;
