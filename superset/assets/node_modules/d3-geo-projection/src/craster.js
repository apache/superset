import "projection";

function craster(λ, φ) {
  var sqrt3 = Math.sqrt(3);
  return [
    sqrt3 * λ * (2 * Math.cos(2 * φ / 3) - 1) / sqrtπ,
    sqrt3 * sqrtπ * Math.sin(φ / 3)
  ];
}

craster.invert = function(x, y) {
  var sqrt3 = Math.sqrt(3),
      φ = 3 * asin(y / (sqrt3 * sqrtπ));
  return [
    sqrtπ * x / (sqrt3 * (2 * Math.cos(2 * φ / 3) - 1)),
    φ
  ];
};

(d3.geo.craster = function() { return projection(craster); }).raw = craster;
