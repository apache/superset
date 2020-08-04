import "projection";

function miller(λ, φ) {
  return [
    λ,
    1.25 * Math.log(Math.tan(π / 4 + .4 * φ))
  ];
}

miller.invert = function(x, y) {
  return [
    x,
    2.5 * Math.atan(Math.exp(.8 * y)) - .625 * π
  ];
};

(d3.geo.miller = function() { return projection(miller); }).raw = miller;
