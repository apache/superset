import "projection";

function wagner7(λ, φ) {
  var s = .90631 * Math.sin(φ),
      c0 = Math.sqrt(1 - s * s),
      c1 = Math.sqrt(2 / (1 + c0 * Math.cos(λ /= 3)));
  return [
    2.66723 * c0 * c1 * Math.sin(λ),
    1.24104 * s * c1
  ];
}

wagner7.invert = function(x, y) {
  var t1 = x / 2.66723,
      t2 = y / 1.24104,
      p = Math.sqrt(t1 * t1 + t2 * t2),
      c = 2 * asin(p / 2);
  return [
    3 * Math.atan2(x * Math.tan(c), 2.66723 * p),
    p && asin(y * Math.sin(c) / (1.24104 * 0.90631 * p))
  ];
};

(d3.geo.wagner7 = function() { return projection(wagner7); }).raw = wagner7;
