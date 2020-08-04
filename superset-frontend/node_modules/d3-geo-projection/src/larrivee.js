import "projection";

function larrivee(λ, φ) {
  return [
    λ * (1 + Math.sqrt(Math.cos(φ))) / 2,
    φ / (Math.cos(φ / 2) * Math.cos(λ / 6))
  ];
}

larrivee.invert = function(x, y) {
  var x0 = Math.abs(x),
      y0 = Math.abs(y),
      π_sqrt2 = π / Math.SQRT2,
      λ = ε,
      φ = halfπ;
  if (y0 < π_sqrt2) φ *= y0 / π_sqrt2;
  else λ += 6 * acos(π_sqrt2 / y0);
  for (var i = 0; i < 25; i++) {
    var sinφ = Math.sin(φ),
        sqrtcosφ = asqrt(Math.cos(φ)),
        sinφ_2 = Math.sin(φ / 2),
        cosφ_2 = Math.cos(φ / 2),
        sinλ_6 = Math.sin(λ / 6),
        cosλ_6 = Math.cos(λ / 6),
        f0 = .5 * λ * (1 + sqrtcosφ) - x0,
        f1 = φ / (cosφ_2 * cosλ_6) - y0,
        df0dφ = sqrtcosφ ? -.25 * λ * sinφ / sqrtcosφ : 0,
        df0dλ = .5 * (1 + sqrtcosφ),
        df1dφ = (1 + .5 * φ * sinφ_2 / cosφ_2) / (cosφ_2 * cosλ_6),
        df1dλ = (φ / cosφ_2) * (sinλ_6 / 6) / (cosλ_6 * cosλ_6),
        denom = df0dφ * df1dλ - df1dφ * df0dλ,
        dφ = (f0 * df1dλ - f1 * df0dλ) / denom,
        dλ = (f1 * df0dφ - f0 * df1dφ) / denom;
    φ -= dφ;
    λ -= dλ;
    if (Math.abs(dφ) < ε && Math.abs(dλ) < ε) break;
  }
  return [x < 0 ? -λ : λ, y < 0 ? -φ : φ];
};

(d3.geo.larrivee = function() { return projection(larrivee); }).raw = larrivee;
