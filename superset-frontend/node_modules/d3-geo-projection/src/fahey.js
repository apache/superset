import "projection";

function fahey(λ, φ) {
  var t = Math.tan(φ / 2);
  return [
    λ * faheyK * asqrt(1 - t * t),
    (1 + faheyK) * t
  ];
}

fahey.invert = function(x, y) {
  var t = y / (1 + faheyK);
  return [
    x ? x / (faheyK * asqrt(1 - t * t)) : 0,
    2 * Math.atan(t)
  ];
};

var faheyK = Math.cos(35 * radians);

(d3.geo.fahey = function() { return projection(fahey); }).raw = fahey;
