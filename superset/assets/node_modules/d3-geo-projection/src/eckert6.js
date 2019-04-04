import "projection";

function eckert6(λ, φ) {
  var k = (1 + halfπ) * Math.sin(φ);
  for (var i = 0, δ = Infinity; i < 10 && Math.abs(δ) > ε; i++) {
    φ -= δ = (φ + Math.sin(φ) - k) / (1 + Math.cos(φ));
  }
  k = Math.sqrt(2 + π);
  return [
    λ * (1 + Math.cos(φ)) / k,
    2 * φ / k
  ];
}

eckert6.invert = function(x, y) {
  var j = 1 + halfπ,
      k = Math.sqrt(j / 2);
  return [
    x * 2 * k / (1 + Math.cos(y *= k)),
    asin((y + Math.sin(y)) / j)
  ];
};

(d3.geo.eckert6 = function() { return projection(eckert6); }).raw = eckert6;
