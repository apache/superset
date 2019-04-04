import "projection";

function hammerRetroazimuthal(φ0) {
  var sinφ0 = Math.sin(φ0),
      cosφ0 = Math.cos(φ0),
      rotate = hammerRetroazimuthalRotation(φ0);
  rotate.invert = hammerRetroazimuthalRotation(-φ0);

  function forward(λ, φ) {
    var p = rotate(λ, φ);
    λ = p[0], φ = p[1];
    var sinφ = Math.sin(φ),
        cosφ = Math.cos(φ),
        cosλ = Math.cos(λ),
        z = acos(sinφ0 * sinφ + cosφ0 * cosφ * cosλ),
        sinz = Math.sin(z),
        K = Math.abs(sinz) > ε ? z / sinz : 1;
    return [
      K * cosφ0 * Math.sin(λ),
      (Math.abs(λ) > halfπ ? K : -K) // rotate for back hemisphere
        * (sinφ0 * cosφ - cosφ0 * sinφ * cosλ)
    ];
  }

  forward.invert = function(x, y) {
    var ρ = Math.sqrt(x * x + y * y),
        sinz = -Math.sin(ρ),
        cosz = Math.cos(ρ),
        a = ρ * cosz,
        b = -y * sinz,
        c = ρ * sinφ0,
        d = asqrt(a * a + b * b - c * c),
        φ = Math.atan2(a * c + b * d, b * c - a * d),
        λ = (ρ > halfπ ? -1 : 1) * Math.atan2(x * sinz, ρ * Math.cos(φ) * cosz + y * Math.sin(φ) * sinz);
    return rotate.invert(λ, φ);
  };

  return forward;
}

// Latitudinal rotation by φ0.
// Temporary hack until D3 supports arbitrary small-circle clipping origins.
function hammerRetroazimuthalRotation(φ0) {
  var sinφ0 = Math.sin(φ0),
      cosφ0 = Math.cos(φ0);

  return function(λ, φ) {
    var cosφ = Math.cos(φ),
        x = Math.cos(λ) * cosφ,
        y = Math.sin(λ) * cosφ,
        z = Math.sin(φ);
    return [
      Math.atan2(y, x * cosφ0 - z * sinφ0),
      asin(z * cosφ0 + x * sinφ0)
    ];
  };
}

function hammerRetroazimuthalProjection() {
  var φ0 = 0,
      m = projectionMutator(hammerRetroazimuthal),
      p = m(φ0),
      rotate_ = p.rotate,
      stream_ = p.stream,
      circle = d3.geo.circle();

  p.parallel = function(_) {
    if (!arguments.length) return φ0 / π * 180;
    var r = p.rotate();
    return m(φ0 = _ * π / 180).rotate(r);
  };

  // Temporary hack; see hammerRetroazimuthalRotation.
  p.rotate = function(_) {
    if (!arguments.length) return (_ = rotate_.call(p), _[1] += φ0 / π * 180, _);
    rotate_.call(p, [_[0], _[1] - φ0 / π * 180]);
    circle.origin([-_[0], -_[1]]);
    return p;
  };

  p.stream = function(stream) {
    stream = stream_(stream);
    stream.sphere = function() {
      stream.polygonStart();
      var ε = 1e-2,
          ring = circle.angle(90 - ε)().coordinates[0],
          n = ring.length - 1,
          i = -1,
          p;
      stream.lineStart();
      while (++i < n) stream.point((p = ring[i])[0], p[1]);
      stream.lineEnd();
      ring = circle.angle(90 + ε)().coordinates[0];
      n = ring.length - 1;
      stream.lineStart();
      while (--i >= 0) stream.point((p = ring[i])[0], p[1]);
      stream.lineEnd();
      stream.polygonEnd();
    };
    return stream;
  };

  return p;
}

(d3.geo.hammerRetroazimuthal = hammerRetroazimuthalProjection).raw = hammerRetroazimuthal;
