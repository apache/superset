import "projection";

function airy(β) {
  var tanβ_2 = Math.tan(.5 * β),
      B = 2 * Math.log(Math.cos(.5 * β)) / (tanβ_2 * tanβ_2);

  function forward(λ, φ) {
    var cosλ = Math.cos(λ),
        cosφ = Math.cos(φ),
        sinφ = Math.sin(φ),
        cosz = cosφ * cosλ,
        K = -((1 - cosz ? Math.log(.5 * (1 + cosz)) / (1 - cosz) : -.5) + B / (1 + cosz));
    return [
      K * cosφ * Math.sin(λ),
      K * sinφ
    ];
  }

  forward.invert = function(x, y) {
    var ρ = Math.sqrt(x * x + y * y),
        z = β * -.5,
        i = 50, δ;
    if (!ρ) return [0, 0];
    do {
      var z_2 = .5 * z,
          cosz_2 = Math.cos(z_2),
          sinz_2 = Math.sin(z_2),
          tanz_2 = Math.tan(z_2),
          lnsecz_2 = Math.log(1 / cosz_2);
      z -= δ = (2 / tanz_2 * lnsecz_2 - B * tanz_2 - ρ) / (-lnsecz_2 / (sinz_2 * sinz_2) + 1 - B / (2 * cosz_2 * cosz_2));
    } while (Math.abs(δ) > ε && --i > 0);
    var sinz = Math.sin(z);
    return [
      Math.atan2(x * sinz, ρ * Math.cos(z)),
      asin(y * sinz / ρ)
    ];
  };

  return forward;
}

function airyProjection() {
  var β = halfπ,
      m = projectionMutator(airy),
      p = m(β);

  p.radius = function(_) {
    if (!arguments.length) return β / π * 180;
    return m(β = _ * π / 180);
  };

  return p;
}

(d3.geo.airy = airyProjection).raw = airy;
