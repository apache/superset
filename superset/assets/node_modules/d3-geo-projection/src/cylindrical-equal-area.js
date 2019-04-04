import "projection";
import "parallel1";

function cylindricalEqualArea(φ0) {
  var cosφ0 = Math.cos(φ0);

  function forward(λ, φ) {
    return [
      λ * cosφ0,
      Math.sin(φ) / cosφ0
    ];
  }

  forward.invert = function(x, y) {
    return [
      x / cosφ0,
      asin(y * cosφ0)
    ];
  };

  return forward;
}

(d3.geo.cylindricalEqualArea = function() { return parallel1Projection(cylindricalEqualArea); }).raw = cylindricalEqualArea;
