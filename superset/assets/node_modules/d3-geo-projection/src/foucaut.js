import "projection";

function foucaut(λ, φ) {
  var k = φ / 2,
      cosk = Math.cos(k);
  return [
    2 * λ / sqrtπ * Math.cos(φ) * cosk * cosk,
    sqrtπ * Math.tan(k)
  ];
}

foucaut.invert = function(x, y) {
  var k = Math.atan(y / sqrtπ),
      cosk = Math.cos(k),
      φ = 2 * k;
  return [
    x * sqrtπ * .5 / (Math.cos(φ) * cosk * cosk),
    φ
  ];
};

(d3.geo.foucaut = function() { return projection(foucaut); }).raw = foucaut;
