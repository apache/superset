import "projection";

function littrow(λ, φ) {
  return [
    Math.sin(λ) / Math.cos(φ),
    Math.tan(φ) * Math.cos(λ)
  ];
}

littrow.invert = function(x, y) {
  var x2 = x * x,
      y2 = y * y,
      y2_1 = y2 + 1,
      cosφ = x
        ? Math.SQRT1_2 * Math.sqrt((y2_1 - Math.sqrt(x2 * x2 + 2 * x2 * (y2 - 1) + y2_1 * y2_1)) / x2 + 1)
        : 1 / Math.sqrt(y2_1);
  return [
    asin(x * cosφ),
    sgn(y) * acos(cosφ)
  ];
};

(d3.geo.littrow = function() { return projection(littrow); }).raw = littrow;
