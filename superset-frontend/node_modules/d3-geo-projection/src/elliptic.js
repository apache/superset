import "math";
import "hyperbolic";

// Returns [sn, cn, dn](u + iv|m).
function ellipticJi(u, v, m) {
  if (!u) {
    var b = ellipticJ(v, 1 - m);
    return [
      [0, b[0] / b[1]],
      [1 / b[1], 0],
      [b[2] / b[1], 0]
    ];
  }
  var a = ellipticJ(u, m);
  if (!v) return [[a[0], 0], [a[1], 0], [a[2], 0]];
  var b = ellipticJ(v, 1 - m),
      denominator = b[1] * b[1] + m * a[0] * a[0] * b[0] * b[0];
  return [
    [a[0] * b[2] / denominator, a[1] * a[2] * b[0] * b[1] / denominator],
    [a[1] * b[1] / denominator, -a[0] * a[2] * b[0] * b[2] / denominator],
    [a[2] * b[1] * b[2] / denominator, -m * a[0] * a[1] * b[0] / denominator]
  ];
}

// Returns [sn, cn, dn, ph](u|m).
function ellipticJ(u, m) {
  var ai, b, φ, t, twon;
  if (m < ε) {
    t = Math.sin(u);
    b = Math.cos(u);
    ai = .25 * m * (u - t * b);
    return [
      t - ai * b,
      b + ai * t,
      1 - .5 * m * t * t,
      u - ai
    ];
  }
  if (m >= 1 - ε) {
    ai = .25 * (1 - m);
    b = cosh(u);
    t = tanh(u);
    φ = 1 / b;
    twon = b * sinh(u);
    return [
      t + ai * (twon - u) / (b * b),
      φ - ai * t * φ * (twon - u),
      φ + ai * t * φ * (twon + u),
      2 * Math.atan(Math.exp(u)) - halfπ + ai * (twon - u) / b
    ];
  }

  var a = [1, 0, 0, 0, 0, 0, 0, 0, 0],
      c = [Math.sqrt(m), 0, 0, 0, 0, 0, 0, 0, 0],
      i = 0;
  b = Math.sqrt(1 - m);
  twon = 1;

  while (Math.abs(c[i] / a[i]) > ε && i < 8) {
    ai = a[i++];
    c[i] = .5 * (ai - b);
    a[i] = .5 * (ai + b);
    b = asqrt(ai * b);
    twon *= 2;
  }

  φ = twon * a[i] * u;
  do {
    t = c[i] * Math.sin(b = φ) / a[i];
    φ = .5 * (asin(t) + φ);
  } while (--i);

  return [Math.sin(φ), t = Math.cos(φ), t / Math.cos(φ - b), φ];
}

// Calculate F(φ+iψ|m).
// See Abramowitz and Stegun, 17.4.11.
function ellipticFi(φ, ψ, m) {
  var r = Math.abs(φ),
      i = Math.abs(ψ),
      sinhψ = sinh(i);
  if (r) {
    var cscφ = 1 / Math.sin(r),
        cotφ2 = 1 / (Math.tan(r) * Math.tan(r)),
        b = -(cotφ2 + m * (sinhψ * sinhψ * cscφ * cscφ) - 1 + m),
        c = (m - 1) * cotφ2,
        cotλ2 = .5 * (-b + Math.sqrt(b * b - 4 * c));
    return [
      ellipticF(Math.atan(1 / Math.sqrt(cotλ2)), m) * sgn(φ),
      ellipticF(Math.atan(asqrt((cotλ2 / cotφ2 - 1) / m)), 1 - m) * sgn(ψ)
    ];
  }
  return [
    0,
    ellipticF(Math.atan(sinhψ), 1 - m) * sgn(ψ)
  ];
}

// Calculate F(φ|m) where m = k² = sin²α.
// See Abramowitz and Stegun, 17.6.7.
function ellipticF(φ, m) {
  if (!m) return φ;
  if (m === 1) return Math.log(Math.tan(φ / 2 + π / 4));
  var a = 1,
      b = Math.sqrt(1 - m),
      c = Math.sqrt(m);
  for (var i = 0; Math.abs(c) > ε; i++) {
    if (φ % π) {
      var dφ = Math.atan(b * Math.tan(φ) / a);
      if (dφ < 0) dφ += π;
      φ += dφ + ~~(φ / π) * π;
    } else φ += φ;
    c = (a + b) / 2;
    b = Math.sqrt(a * b);
    c = ((a = c) - b) / 2;
  }
  return φ / (Math.pow(2, i) * a);
}
