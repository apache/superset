import "projection";

function mollweideBromleyθ(Cp) {
  return function(θ) {
    var Cpsinθ = Cp * Math.sin(θ),
        i = 30, δ;
    do θ -= δ = (θ + Math.sin(θ) - Cpsinθ) / (1 + Math.cos(θ));
    while (Math.abs(δ) > ε && --i > 0);
    return θ / 2;
  };
}

function mollweideBromley(Cx, Cy, Cp) {
  var θ = mollweideBromleyθ(Cp);

  function forward(λ, φ) {
    return [
      Cx * λ * Math.cos(φ = θ(φ)),
      Cy * Math.sin(φ)
    ];
  }

  forward.invert = function(x, y) {
    var θ = asin(y / Cy);
    return [
      x / (Cx * Math.cos(θ)),
      asin((2 * θ + Math.sin(2 * θ)) / Cp)
    ];
  };

  return forward;
}

var mollweideθ = mollweideBromleyθ(π),
    mollweide = mollweideBromley(Math.SQRT2 / halfπ, Math.SQRT2, π);

(d3.geo.mollweide = function() { return projection(mollweide); }).raw = mollweide;
