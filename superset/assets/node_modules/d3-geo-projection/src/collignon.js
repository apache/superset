import "projection";

function collignon(λ, φ) {
  var α = asqrt(1 - Math.sin(φ));
  return [
    (2 / sqrtπ) * λ * α,
    sqrtπ * (1 - α)
  ];
}

collignon.invert = function(x, y) {
  var λ = (λ = y / sqrtπ - 1) * λ;
  return [
    λ > 0 ? x * Math.sqrt(π / λ) / 2 : 0,
    asin(1 - λ)
  ];
};

(d3.geo.collignon = function() { return projection(collignon); }).raw = collignon;
