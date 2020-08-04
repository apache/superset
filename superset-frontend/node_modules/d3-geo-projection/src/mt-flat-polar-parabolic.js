import "projection";

function mtFlatPolarParabolic(λ, φ) {
  var sqrt6 = Math.sqrt(6),
      sqrt7 = Math.sqrt(7),
      θ = Math.asin(7 * Math.sin(φ) / (3 * sqrt6));
  return [
    sqrt6 * λ * (2 * Math.cos(2 * θ / 3) - 1) / sqrt7,
    9 * Math.sin(θ / 3) / sqrt7
  ];
}

mtFlatPolarParabolic.invert = function(x, y) {
  var sqrt6 = Math.sqrt(6),
      sqrt7 = Math.sqrt(7),
      θ = 3 * asin(y * sqrt7 / 9);
  return [
    x * sqrt7 / (sqrt6 * (2 * Math.cos(2 * θ / 3) - 1)),
    asin(Math.sin(θ) * 3 * sqrt6 / 7)
  ];
};

(d3.geo.mtFlatPolarParabolic = function() { return projection(mtFlatPolarParabolic); }).raw = mtFlatPolarParabolic;
