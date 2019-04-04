import "projection";
import "quincuncial";

function gringorten(λ, φ) {
  var sλ = sgn(λ),
      sφ = sgn(φ),
      cosφ = Math.cos(φ),
      x = Math.cos(λ) * cosφ,
      y = Math.sin(λ) * cosφ,
      z = Math.sin(sφ * φ);

  λ = Math.abs(Math.atan2(y, z));
  φ = asin(x);

  if (Math.abs(λ - halfπ) > ε) λ %= halfπ;
  var point = gringortenHexadecant(λ > π / 4 ? halfπ - λ : λ, φ);

  if (λ > π / 4) z = point[0], point[0] = -point[1], point[1] = -z;

  return (point[0] *= sλ, point[1] *= -sφ, point);
}

gringorten.invert = function(x, y) {
  var sx = sgn(x),
      sy = sgn(y),
      x0 = -sx * x,
      y0 = -sy * y,
      t = y0 / x0 < 1,
      p = gringortenHexadecantInvert(t ? y0 : x0, t ? x0 : y0),
      λ = p[0],
      φ = p[1];

  if (t) λ = -halfπ - λ;

  var cosφ = Math.cos(φ),
      x = Math.cos(λ) * cosφ,
      y = Math.sin(λ) * cosφ,
      z = Math.sin(φ);

  return [sx * (Math.atan2(y, -z) + π), sy * asin(x)];
};

function gringortenHexadecant(λ, φ) {
  if (φ === halfπ) return [0, 0];

  var sinφ = Math.sin(φ),
      r = sinφ * sinφ,
      r2 = r * r,
      j = 1 + r2,
      k = 1 + 3 * r2,
      q = 1 - r2,
      z = asin(1 / Math.sqrt(j)),
      v = q + r * j * z,
      p2 = (1 - sinφ) / v,
      p = Math.sqrt(p2),
      a2 = p2 * j,
      a = Math.sqrt(a2),
      h = p * q;
  if (λ === 0) return [0, -(h + r * a)];

  var cosφ = Math.cos(φ),
      secφ = 1 / cosφ,
      drdφ = 2 * sinφ * cosφ,
      dvdφ = (-3 * r + z * k) * drdφ,
      dp2dφ = (-v * cosφ - (1 - sinφ) * dvdφ) / (v * v),
      dpdφ = (.5 * dp2dφ) / p,
      dhdφ = q * dpdφ - 2 * r * p * drdφ,
      dra2dφ = r * j * dp2dφ + p2 * k * drdφ,
      μ = -secφ * drdφ,
      ν = -secφ * dra2dφ,
      ζ = -2 * secφ * dhdφ,
      Λ = 4 * λ / π;

  if (λ > .222 * π || φ < π / 4 && λ > .175 * π) {
    // Slower but accurate bisection method.
    var x = (h + r * asqrt(a2 * (1 + r2) - h * h)) / (1 + r2);
    if (λ > π / 4) return [x, x];

    var x1 = x,
        x0 = .5 * x,
        i = 50;
    x = .5 * (x0 + x1);
    do {
      var g = Math.sqrt(a2 - x * x),
          f = (x * (ζ + μ * g) + ν * asin(x / a)) - Λ;
      if (!f) break;
      if (f < 0) x0 = x;
      else x1 = x;
      x = .5 * (x0 + x1);
    } while (Math.abs(x1 - x0) > ε && --i > 0);
  } else {
    // Newton-Raphson.
    var x = ε, i = 25, δ;
    do {
      var x2 = x * x,
          g = asqrt(a2 - x2),
          ζμg = ζ + μ * g,
          f = x * ζμg + ν * asin(x / a) - Λ,
          df = ζμg + (ν - μ * x2) / g;
      x -= δ = g ? f / df : 0;
    } while (Math.abs(δ) > ε && --i > 0);
  }
  return [x, -h - r * asqrt(a2 - x * x)];
}

function gringortenHexadecantInvert(x, y) {
  var x0 = 0,
      x1 = 1,
      r = .5,
      i = 50;

  while (true) {
    var r2 = r * r,
        sinφ = Math.sqrt(r),
        z = Math.asin(1 / Math.sqrt(1 + r2)),
        v = (1 - r2) + r * (1 + r2) * z,
        p2 = (1 - sinφ) / v,
        p = Math.sqrt(p2),
        a2 = p2 * (1 + r2),
        h = p * (1 - r2),
        g2 = a2 - x * x,
        g = Math.sqrt(g2),
        y0 = y + h + r * g;

    if (Math.abs(x1 - x0) < ε2 || --i === 0 || y0 === 0) break;

    if (y0 > 0) x0 = r;
    else x1 = r;

    r = .5 * (x0 + x1);
  }

  if (!i) return null;

  var φ = Math.asin(sinφ),
      cosφ = Math.cos(φ),
      secφ = 1 / cosφ,
      drdφ = 2 * sinφ * cosφ,
      dvdφ = (-3 * r + z * (1 + 3 * r2)) * drdφ,
      dp2dφ = (-v * cosφ - (1 - sinφ) * dvdφ) / (v * v),
      dpdφ = .5 * dp2dφ / p,
      dhdφ = (1 - r2) * dpdφ - 2 * r * p * drdφ,
      ζ = -2 * secφ * dhdφ,
      μ = -secφ * drdφ,
      ν = -secφ * (r * (1 + r2) * dp2dφ + p2 * (1 + 3 * r2) * drdφ);

  return [π / 4 * (x * (ζ + μ * g) + ν * Math.asin(x / Math.sqrt(a2))), φ];
}

d3.geo.gringorten = quincuncialProjection(gringorten);
