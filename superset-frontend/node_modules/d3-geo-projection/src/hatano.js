import "projection";

function hatano(λ, φ) {
  var c = Math.sin(φ) * (φ < 0 ? 2.43763 : 2.67595);
  for (var i = 0, δ; i < 20; i++) {
    φ -= δ = (φ + Math.sin(φ) - c) / (1 + Math.cos(φ));
    if (Math.abs(δ) < ε) break;
  }
  return [
    .85 * λ * Math.cos(φ *= .5),
    Math.sin(φ) * (φ < 0 ? 1.93052 : 1.75859)
  ];
}

hatano.invert = function(x, y) {
  var θ = Math.abs(θ = y * (y < 0 ? .51799515156538134803 : .56863737426006061674)) > 1 - ε
      ? θ > 0 ? halfπ : -halfπ
      : asin(θ);
  return [
    1.17647058823529411764 * x / Math.cos(θ),
    Math.abs(θ = ((θ += θ) + Math.sin(θ)) * (y < 0 ? .41023453108141924738 : .37369906014686373063)) > 1 - ε
      ? θ > 0 ? halfπ : -halfπ
      : asin(θ)
  ];
};

(d3.geo.hatano = function() { return projection(hatano); }).raw = hatano;
