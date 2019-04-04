import "projection";

function ginzburg8(λ, φ) {
  var λ2 = λ * λ,
      φ2 = φ * φ;
  return [
    λ * (1 - .162388 * φ2) * (.87 - .000952426 * λ2 * λ2),
    φ * (1 + φ2 / 12)
  ];
}

ginzburg8.invert = function(x, y) {
  var λ = x,
      φ = y,
      i = 50, δ;
  do {
    var φ2 = φ * φ;
    φ -= δ = (φ * (1 + φ2 / 12) - y) / (1 + φ2 / 4);
  } while (Math.abs(δ) > ε && --i > 0);
  i = 50;
  x /= 1 - .162388 * φ2;
  do {
    var λ4 = (λ4 = λ * λ) * λ4;
    λ -= δ = (λ * (.87 - .000952426 * λ4) - x) / (.87 - .00476213 * λ4);
  } while (Math.abs(δ) > ε && --i > 0);
  return [λ, φ];
};

(d3.geo.ginzburg8 = function() { return projection(ginzburg8); }).raw = ginzburg8;
