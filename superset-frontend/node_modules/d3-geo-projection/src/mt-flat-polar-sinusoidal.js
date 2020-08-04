import "projection";

function mtFlatPolarSinusoidal(λ, φ) {
  var A = Math.sqrt(6 / (4 + π)),
      k = (1 + π / 4) * Math.sin(φ),
      θ = φ / 2;
  for (var i = 0, δ; i < 25; i++) {
    θ -= δ = (θ / 2 + Math.sin(θ) - k) / (.5 + Math.cos(θ));
    if (Math.abs(δ) < ε) break;
  }
  return [
    A * (.5 + Math.cos(θ)) * λ / 1.5,
    A * θ
  ];
}

mtFlatPolarSinusoidal.invert = function(x, y) {
  var A = Math.sqrt(6 / (4 + π)),
      θ = y / A;
  if (Math.abs(Math.abs(θ) - halfπ) < ε) θ = θ < 0 ? -halfπ : halfπ;
  return [
    1.5 * x / (A * (.5 + Math.cos(θ))),
    asin((θ / 2 + Math.sin(θ)) / (1 + π / 4))
  ];
};

(d3.geo.mtFlatPolarSinusoidal = function() { return projection(mtFlatPolarSinusoidal); }).raw = mtFlatPolarSinusoidal;
