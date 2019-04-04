import "projection";

function armadillo(φ0) {
  var sinφ0 = Math.sin(φ0),
      cosφ0 = Math.cos(φ0),
      sφ0 = φ0 > 0 ? 1 : -1,
      tanφ0 = Math.tan(sφ0 * φ0),
      k = (1 + sinφ0 - cosφ0) / 2;

  function forward(λ, φ) {
    var cosφ = Math.cos(φ),
        cosλ = Math.cos(λ /= 2);
    return [
      (1 + cosφ) * Math.sin(λ),
      // TODO D3 core should allow null or [NaN, NaN] to be returned.
      (sφ0 * φ > -Math.atan2(cosλ, tanφ0) - 1e-3 ? 0 : -sφ0 * 10) +
        k + Math.sin(φ) * cosφ0 - (1 + cosφ) * sinφ0 * cosλ
    ];
  }

  forward.invert = function(x, y) {
    var λ = 0,
        φ = 0,
        i = 50;
    do {
      var cosλ = Math.cos(λ),
          sinλ = Math.sin(λ),
          cosφ = Math.cos(φ),
          sinφ = Math.sin(φ),
          A = 1 + cosφ,
          fx = A * sinλ - x,
          fy = k + sinφ * cosφ0 - A * sinφ0 * cosλ - y,
          δxδλ = .5 * A * cosλ,
          δxδφ = -sinλ * sinφ,
          δyδλ = .5 * sinφ0 * A * sinλ,
          δyδφ = cosφ0 * cosφ + sinφ0 * cosλ * sinφ,
          denominator = δxδφ * δyδλ - δyδφ * δxδλ,
          δλ = .5 * (fy * δxδφ - fx * δyδφ) / denominator,
          δφ = (fx * δyδλ - fy * δxδλ) / denominator;
      λ -= δλ, φ -= δφ;
    } while ((Math.abs(δλ) > ε || Math.abs(δφ) > ε) && --i > 0);
    return sφ0 * φ > -Math.atan2(Math.cos(λ), tanφ0) - 1e-3 ? [λ * 2, φ] : null;
  };

  return forward;
}

function armadilloProjection() {
  var φ0 = π / 9, // 20°
      sφ0 = φ0 > 0 ? 1 : -1,
      tanφ0 = Math.tan(sφ0 * φ0),
      m = projectionMutator(armadillo),
      p = m(φ0),
      stream_ = p.stream;

  p.parallel = function(_) {
    if (!arguments.length) return φ0 / π * 180;
    tanφ0 = Math.tan((sφ0 = (φ0 = _ * π / 180) > 0 ? 1 : -1) * φ0);
    return m(φ0);
  };

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (p.rotate([0, 0]), stream_(stream));
    p.rotate(rotate);
    rotateStream.sphere = function() {
      sphereStream.polygonStart(), sphereStream.lineStart();
      for (var λ = sφ0 * -180; sφ0 * λ < 180; λ += sφ0 * 90) sphereStream.point(λ, sφ0 * 90);
      while (sφ0 * (λ -= φ0) >= -180) { // TODO precision?
        sphereStream.point(λ, sφ0 * -Math.atan2(Math.cos(λ * radians / 2), tanφ0) * degrees);
      }
      sphereStream.lineEnd(), sphereStream.polygonEnd();
    };
    return rotateStream;
  };

  return p;
}

(d3.geo.armadillo = armadilloProjection).raw = armadillo;
