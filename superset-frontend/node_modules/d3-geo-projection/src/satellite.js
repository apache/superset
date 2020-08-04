import "projection";

function satelliteVertical(P) {
  function forward(λ, φ) {
    var cosφ = Math.cos(φ),
        k = (P - 1) / (P - cosφ * Math.cos(λ));
    return [
      k * cosφ * Math.sin(λ),
      k * Math.sin(φ)
    ];
  }

  forward.invert = function(x, y) {
    var ρ2 = x * x + y * y,
        ρ = Math.sqrt(ρ2),
        sinc = (P - Math.sqrt(1 - ρ2 * (P + 1) / (P - 1))) / ((P - 1) / ρ + ρ / (P - 1));
    return [
      Math.atan2(x * sinc, ρ * Math.sqrt(1 - sinc * sinc)),
      ρ ? asin(y * sinc / ρ) : 0
    ];
  };

  return forward;
}

function satellite(P, ω) {
  var vertical = satelliteVertical(P);
  if (!ω) return vertical;
  var cosω = Math.cos(ω),
      sinω = Math.sin(ω);

  function forward(λ, φ) {
    var coordinates = vertical(λ, φ),
        y = coordinates[1],
        A = y * sinω / (P - 1) + cosω;
    return [
      coordinates[0] * cosω / A,
      y / A
    ];
  }

  forward.invert = function(x, y) {
    var k = (P - 1) / (P - 1 - y * sinω);
    return vertical.invert(k * x, k * y * cosω);
  };

  return forward;
}

function satelliteProjection() {
  var P = 1.4,
      ω = 0,
      m = projectionMutator(satellite),
      p = m(P, ω);

  // As a multiple of radius.
  p.distance = function(_) {
    if (!arguments.length) return P;
    return m(P = +_, ω);
  };

  p.tilt = function(_) {
    if (!arguments.length) return ω * 180 / π;
    return m(P, ω = _ * π / 180);
  };

  return p;
}

(d3.geo.satellite = satelliteProjection).raw = satellite;
