import "projection";

function eckert4(λ, φ) {
  var k = (2 + halfπ) * Math.sin(φ);
  φ /= 2;
  for (var i = 0, δ = Infinity; i < 10 && Math.abs(δ) > ε; i++) {
    var cosφ = Math.cos(φ);
    φ -= δ = (φ + Math.sin(φ) * (cosφ + 2) - k) / (2 * cosφ * (1 + cosφ));
  }
  return [
    2 / Math.sqrt(π * (4 + π)) * λ * (1 + Math.cos(φ)),
    2 * Math.sqrt(π / (4 + π)) * Math.sin(φ)
  ];
}

eckert4.invert = function(x, y) {
  var A = .5 * y * Math.sqrt((4 + π) / π),
      k = asin(A),
      c = Math.cos(k);
  return [
    x / (2 / Math.sqrt(π * (4 + π)) * (1 + c)),
    asin((k + A * (c + 2)) / (2 + halfπ))
  ];
};

(d3.geo.eckert4 = function() { return projection(eckert4); }).raw = eckert4;
