import "projection";

function eckert5(λ, φ) {
  return [
    λ * (1 + Math.cos(φ)) / Math.sqrt(2 + π),
    2 * φ / Math.sqrt(2 + π)
  ];
}

eckert5.invert = function(x, y) {
  var k = Math.sqrt(2 + π),
      φ = y * k / 2;
  return [
    k * x / (1 + Math.cos(φ)),
    φ
  ];
};

(d3.geo.eckert5 = function() { return projection(eckert5); }).raw = eckert5;
