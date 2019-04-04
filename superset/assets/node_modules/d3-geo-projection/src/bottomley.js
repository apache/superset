import "projection";

function bottomleyRaw(ψ) {
  var sinψ = Math.sin(ψ);

  function forward(λ, φ) {
    var ρ = halfπ - φ,
        η = ρ ? λ * sinψ * Math.sin(ρ) / ρ : ρ;
    return [
      ρ * Math.sin(η) / sinψ,
      halfπ - ρ * Math.cos(η)
    ];
  }

  forward.invert = function(x, y) {
    var x1 = x * sinψ,
        y1 = halfπ - y,
        ρ = Math.sqrt(x1 * x1 + y1 * y1),
        η = Math.atan2(x1, y1);
    return [
      (ρ ? ρ / Math.sin(ρ) : 1) * η / sinψ,
      halfπ - ρ
    ];
  };

  return forward;
}

(d3.geo.bottomley = function() {
  var ψ = π / 6,
      mutate = d3.geo.projectionMutator(bottomleyRaw),
      projection = mutate(ψ);

  projection.variant = function(_) {
    return arguments.length ? mutate(ψ = +_) : ψ;
  };

  return projection;
}).raw = bottomleyRaw;
