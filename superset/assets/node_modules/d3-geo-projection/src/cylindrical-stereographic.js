import "projection";
import "parallel1";

function cylindricalStereographic(φ0) {
  var cosφ0 = Math.cos(φ0);

  function forward(λ, φ) {
    return [
      λ * cosφ0,
      (1 + cosφ0) * Math.tan(φ * .5)
    ];
  }

  forward.invert = function(x, y) {
    return [
      x / cosφ0,
      Math.atan(y / (1 + cosφ0)) * 2
    ];
  };

  return forward;
}

(d3.geo.cylindricalStereographic = function() { return parallel1Projection(cylindricalStereographic); }).raw = cylindricalStereographic;
