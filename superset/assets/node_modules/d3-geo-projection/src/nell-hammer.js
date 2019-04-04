import "projection";

function nellHammer(λ, φ) {
  return [
    λ * (1 + Math.cos(φ)) / 2,
    2 * (φ - Math.tan(φ / 2))
  ];
}

nellHammer.invert = function(x, y) {
  var p = y / 2;
  for (var i = 0, δ = Infinity; i < 10 && Math.abs(δ) > ε; i++) {
    var c = Math.cos(y / 2);
    y -= δ = (y - Math.tan(y / 2) - p) / (1 - .5 / (c * c));
  }
  return [
    2 * x / (1 + Math.cos(y)),
    y
  ];
};

(d3.geo.nellHammer = function() { return projection(nellHammer); }).raw = nellHammer;
