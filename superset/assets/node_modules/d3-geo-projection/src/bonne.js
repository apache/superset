import "projection";
import "parallel1";
import "sinusoidal";

function bonne(φ0) {
  if (!φ0) return sinusoidal;
  var cotφ0 = 1 / Math.tan(φ0);

  function forward(λ, φ) {
    var ρ = cotφ0 + φ0 - φ,
        E = ρ ? λ * Math.cos(φ) / ρ : ρ;
    return [
      ρ * Math.sin(E),
      cotφ0 - ρ * Math.cos(E)
    ];
  }

  forward.invert = function(x, y) {
    var ρ = Math.sqrt(x * x + (y = cotφ0 - y) * y),
        φ = cotφ0 + φ0 - ρ;
    return [
      ρ / Math.cos(φ) * Math.atan2(x, y),
      φ
    ];
  };

  return forward;
}

(d3.geo.bonne = function() { return parallel1Projection(bonne).parallel(45); }).raw = bonne;
