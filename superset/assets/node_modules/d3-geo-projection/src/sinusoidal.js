import "projection";

function sinusoidal(λ, φ) {
  return [
    λ * Math.cos(φ),
    φ
  ];
}

sinusoidal.invert = function(x, y) {
  return [
    x / Math.cos(y),
    y
  ];
};

(d3.geo.sinusoidal = function() { return projection(sinusoidal); }).raw = sinusoidal;
