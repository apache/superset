import "projection";
import "parallel1";

function craig(φ0) {
  var tanφ0 = Math.tan(φ0);

  function forward(λ, φ) {
    return [
      λ,
      (λ ? λ / Math.sin(λ) : 1) * (Math.sin(φ) * Math.cos(λ) - tanφ0 * Math.cos(φ))
    ];
  }

  forward.invert = tanφ0 ? function(x, y) {
    if (x) y *= Math.sin(x) / x;
    var cosλ = Math.cos(x);
    return [
      x,
      2 * Math.atan2(Math.sqrt(cosλ * cosλ + tanφ0 * tanφ0 - y * y) - cosλ, tanφ0 - y)
    ];
  } : function(x, y) {
    return [
      x,
      asin(x ? y * Math.tan(x) / x : y)
    ];
  };

  return forward;
}

(d3.geo.craig = function() { return parallel1Projection(craig); }).raw = craig;
