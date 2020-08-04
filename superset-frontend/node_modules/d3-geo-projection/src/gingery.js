import "projection";

var gingeryAzimuthalEquidistant = d3.geo.azimuthalEquidistant.raw;

function gingery(ρ, n) {
  var k = 2 * π / n,
      ρ2 = ρ * ρ;

  function forward(λ, φ) {
    var p = gingeryAzimuthalEquidistant(λ, φ),
        x = p[0],
        y = p[1],
        r2 = x * x + y * y;

    if (r2 > ρ2) {
      var r = Math.sqrt(r2),
          θ = Math.atan2(y, x),
          θ0 = k * Math.round(θ / k),
          α = θ - θ0,
          ρcosα = ρ * Math.cos(α),
          k_ = (ρ * Math.sin(α) - α * Math.sin(ρcosα)) / (halfπ - ρcosα),
          s_ = arcLength_(α, k_),
          e = (π - ρ) / gingeryIntegrate(s_, ρcosα, π);

      x = r;
      var i = 50, δ;
      do {
        x -= δ = (ρ + gingeryIntegrate(s_, ρcosα, x) * e - r) / (s_(x) * e);
      } while (Math.abs(δ) > ε && --i > 0);

      y = α * Math.sin(x);
      if (x < halfπ) y -= k_ * (x - halfπ);

      var s = Math.sin(θ0),
          c = Math.cos(θ0);
      p[0] = x * c - y * s;
      p[1] = x * s + y * c;
    }
    return p;
  }

  forward.invert = function(x, y) {
    var r2 = x * x + y * y;
    if (r2 > ρ2) {
      var r = Math.sqrt(r2),
          θ = Math.atan2(y, x),
          θ0 = k * Math.round(θ / k),
          dθ = θ - θ0,

      x = r * Math.cos(dθ);
      y = r * Math.sin(dθ);

      var x_halfπ = x - halfπ,
          sinx = Math.sin(x),
          α = y / sinx,
          δ = x < halfπ ? Infinity : 0,
          i = 10;

      while (true) {
        var ρsinα = ρ * Math.sin(α),
            ρcosα = ρ * Math.cos(α),
            sinρcosα = Math.sin(ρcosα),
            halfπ_ρcosα = halfπ - ρcosα,
            k_ = (ρsinα - α * sinρcosα) / halfπ_ρcosα,
            s_ = arcLength_(α, k_);

        if (Math.abs(δ) < ε2 || !--i) break;

        α -= δ = (α * sinx - k_ * x_halfπ - y) / (
          sinx - x_halfπ * 2 * (
            halfπ_ρcosα * (ρcosα + α * ρsinα * Math.cos(ρcosα) - sinρcosα) -
            ρsinα * (ρsinα - α * sinρcosα)
          ) / (halfπ_ρcosα * halfπ_ρcosα));
      }
      r = ρ + gingeryIntegrate(s_, ρcosα, x) * (π - ρ) / gingeryIntegrate(s_, ρcosα, π);
      θ = θ0 + α;
      x = r * Math.cos(θ);
      y = r * Math.sin(θ);
    }
    return gingeryAzimuthalEquidistant.invert(x, y);
  };

  return forward;
}

function arcLength_(α, k) {
  return function(x) {
    var y_ = α * Math.cos(x);
    if (x < halfπ) y_ -= k;
    return Math.sqrt(1 + y_ * y_);
  };
}

function gingeryProjection() {
  var n = 6,
      ρ = 30 * radians,
      cρ = Math.cos(ρ),
      sρ = Math.sin(ρ),
      m = projectionMutator(gingery),
      p = m(ρ, n),
      stream_ = p.stream,
      ε = 1e-2,
      cr = -Math.cos(ε * radians),
      sr = Math.sin(ε * radians);

  p.radius = function(_) {
    if (!arguments.length) return ρ * degrees;
    cρ = Math.cos(ρ = _ * radians);
    sρ = Math.sin(ρ);
    return m(ρ, n);
  };

  p.lobes = function(_) {
    if (!arguments.length) return n;
    return m(ρ, n = +_);
  };

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (p.rotate([0, 0]), stream_(stream));
    p.rotate(rotate);
    rotateStream.sphere = function() {
      sphereStream.polygonStart(), sphereStream.lineStart();
      for (var i = 0, δ = 2 * π / n, φ = 0; i < n; ++i, φ -= δ) {
        sphereStream.point(Math.atan2(sr * Math.cos(φ), cr) * degrees, Math.asin(sr * Math.sin(φ)) * degrees);
        sphereStream.point(Math.atan2(sρ * Math.cos(φ - δ / 2), cρ) * degrees, Math.asin(sρ * Math.sin(φ - δ / 2)) * degrees);
      }
      sphereStream.lineEnd(), sphereStream.polygonEnd();
    };
    return rotateStream;
  };

  return p;
}

// Numerical integration: trapezoidal rule.
function gingeryIntegrate(f, a, b) {
  var n = 50,
      h = (b - a) / n,
      s = f(a) + f(b);
  for (var i = 1, x = a; i < n; ++i) s += 2 * f(x += h);
  return s * .5 * h;
}

(d3.geo.gingery = gingeryProjection).raw = gingery;
