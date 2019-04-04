import "projection";

function wiechel(λ, φ) {
  var cosφ = Math.cos(φ),
      sinφ = Math.cos(λ) * cosφ,
      sin1_φ = 1 - sinφ,
      cosλ = Math.cos(λ = Math.atan2(Math.sin(λ) * cosφ, -Math.sin(φ))),
      sinλ = Math.sin(λ);
  cosφ = asqrt(1 - sinφ * sinφ);
  return [
    sinλ * cosφ - cosλ * sin1_φ,
    -cosλ * cosφ - sinλ * sin1_φ
  ];
}

wiechel.invert = function(x, y) {
  var w = -.5 * (x * x + y * y),
      k = Math.sqrt(-w * (2 + w)),
      b = y * w + x * k,
      a = x * w - y * k,
      D = Math.sqrt(a * a + b * b);
  return [
    Math.atan2(k * b, D * (1 + w)),
    D ? -asin(k * a / D) : 0
  ];
};

(d3.geo.wiechel = function() { return projection(wiechel); }).raw = wiechel;
