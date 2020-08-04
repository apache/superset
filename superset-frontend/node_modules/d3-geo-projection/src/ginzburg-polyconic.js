import "math";

function ginzburgPolyconic(a, b, c, d, e, f, g, h) {
  if (arguments.length < 8) h = 0;

  function forward(λ, φ) {
    if (!φ) return [a * λ / π, 0];
    var φ2 = φ * φ,
        xB = a + φ2 * (b + φ2 * (c + φ2 * d)),
        yB = φ * (e - 1 + φ2 * (f - h + φ2 * g)),
        m = (xB * xB + yB * yB) / (2 * yB),
        α = λ * Math.asin(xB / m) / π;
    return [m * Math.sin(α), φ * (1 + φ2 * h) + m * (1 - Math.cos(α))];
  }

  forward.invert = function(x, y) {
    var λ = π * x / a,
        φ = y,
        δλ, δφ, i = 50;
    do {
      var φ2 = φ * φ,
          xB = a + φ2 * (b + φ2 * (c + φ2 * d)),
          yB = φ * (e - 1 + φ2 * (f - h + φ2 * g)),
          p = xB * xB + yB * yB,
          q = 2 * yB,
          m = p / q,
          m2 = m * m,
          dαdλ = Math.asin(xB / m) / π,
          α = λ * dαdλ;
          xB2 = xB * xB,
          dxBdφ = (2 * b + φ2 * (4 * c + φ2 * 6 * d)) * φ,
          dyBdφ = e + φ2 * (3 * f + φ2 * 5 * g),
          dpdφ = 2 * (xB * dxBdφ + yB * (dyBdφ - 1)),
          dqdφ = 2 * (dyBdφ - 1),
          dmdφ = (dpdφ * q - p * dqdφ) / (q * q),
          cosα = Math.cos(α),
          sinα = Math.sin(α),
          mcosα = m * cosα,
          msinα = m * sinα,
          dαdφ = ((λ / π) * (1 / asqrt(1 - xB2 / m2)) * (dxBdφ * m - xB * dmdφ)) / m2,
          fx = msinα - x,
          fy = φ * (1 + φ2 * h) + m - mcosα - y,
          δxδφ = dmdφ * sinα + mcosα * dαdφ,
          δxδλ = mcosα * dαdλ,
          δyδφ = 1 + dmdφ - (dmdφ * cosα - msinα * dαdφ),
          δyδλ = msinα * dαdλ,
          denominator = δxδφ * δyδλ - δyδφ * δxδλ;
      if (!denominator) break;
      λ -= δλ = (fy * δxδφ - fx * δyδφ) / denominator;
      φ -= δφ = (fx * δyδλ - fy * δxδλ) / denominator;
    } while ((Math.abs(δλ) > ε || Math.abs(δφ) > ε) && --i > 0);
    return [λ, φ];
  };

  return forward;
}
