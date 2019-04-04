import "projection";

function times(λ, φ) {
  var t = Math.tan(φ / 2),
      s = Math.sin(π / 4 * t);
  return [
    λ * (.74482 - .34588 * s * s),
    1.70711 * t
  ];
}

times.invert = function(x, y) {
  var t = y / 1.70711,
      s = Math.sin(π / 4 * t);
  return [
    x / (.74482 - .34588 * s * s),
    2 * Math.atan(t)
  ];
};

(d3.geo.times = function() { return projection(times); }).raw = times;
