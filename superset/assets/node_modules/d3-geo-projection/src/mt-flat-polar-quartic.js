import "projection";

function mtFlatPolarQuartic(λ, φ) {
  var k = (1 + Math.SQRT1_2) * Math.sin(φ),
      θ = φ;
  for (var i = 0, δ; i < 25; i++) {
    θ -= δ = (Math.sin(θ / 2) + Math.sin(θ) - k) / (.5 * Math.cos(θ / 2) + Math.cos(θ));
    if (Math.abs(δ) < ε) break;
  }
  return [
    λ * (1 + 2 * Math.cos(θ) / Math.cos(θ / 2)) / (3 * Math.SQRT2),
    2 * Math.sqrt(3) * Math.sin(θ / 2) / Math.sqrt(2 + Math.SQRT2)
  ];
}

mtFlatPolarQuartic.invert = function(x, y) {
  var sinθ_2 = y * Math.sqrt(2 + Math.SQRT2) / (2 * Math.sqrt(3)),
      θ = 2 * asin(sinθ_2);
  return [
    3 * Math.SQRT2 * x / (1 + 2 * Math.cos(θ) / Math.cos(θ / 2)),
    asin((sinθ_2 + Math.sin(θ)) / (1 + Math.SQRT1_2))
  ];
};

(d3.geo.mtFlatPolarQuartic = function() { return projection(mtFlatPolarQuartic); }).raw = mtFlatPolarQuartic;
