import "projection";

function hill(K) {
  var L = 1 + K,
      sinβ = Math.sin(1 / L),
      β = asin(sinβ),
      A = 2 * Math.sqrt(π / (B = π + 4 * β * L)),
      B,
      ρ0 = .5 * A * (L + Math.sqrt(K * (2 + K))),
      K2 = K * K,
      L2 = L * L;

  function forward(λ, φ) {
    var t = 1 - Math.sin(φ),
        ρ,
        ω;
    if (t && t < 2) {
      var θ = halfπ - φ, i = 25, δ;
      do {
        var sinθ = Math.sin(θ),
            cosθ = Math.cos(θ),
            β_β1 = β + Math.atan2(sinθ, L - cosθ),
            C = 1 + L2 - 2 * L * cosθ;
        θ -= δ = (θ - K2 * β - L * sinθ + C * β_β1 - .5 * t * B) / (2 * L * sinθ * β_β1);
      } while (Math.abs(δ) > ε2 && --i > 0);
      ρ = A * Math.sqrt(C);
      ω = λ * β_β1 / π;
    } else {
      ρ = A * (K + t);
      ω = λ * β / π;
    }
    return [
      ρ * Math.sin(ω),
      ρ0 - ρ * Math.cos(ω)
    ];
  };

  forward.invert = function(x, y) {
    var ρ2 = x * x + (y -= ρ0) * y,
        cosθ = (1 + L2 - ρ2 / (A * A)) / (2 * L),
        θ = acos(cosθ),
        sinθ = Math.sin(θ),
        β_β1 = β + Math.atan2(sinθ, L - cosθ);
    return [
      asin(x / Math.sqrt(ρ2)) * π / β_β1,
      asin(1 - 2 * (θ - K2 * β - L * sinθ + (1 + L2 - 2 * L * cosθ) * β_β1) / B)
    ];
  };

  return forward;
}

function hillProjection() {
  var K = 1,
      m = projectionMutator(hill),
      p = m(K);

  p.ratio = function(_) {
    if (!arguments.length) return K;
    return m(K = +_);
  };

  return p;
}

(d3.geo.hill = hillProjection).raw = hill;
