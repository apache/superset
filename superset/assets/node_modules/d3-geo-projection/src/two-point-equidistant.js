import "projection";

// TODO clip to ellipse

function twoPointEquidistant(z0) {
  if (!z0) return d3.geo.azimuthalEquidistant.raw;
  var λa = -z0 / 2,
      λb = -λa,
      z02 = z0 * z0,
      tanλ0 = Math.tan(λb),
      S = .5 / Math.sin(λb);

  function forward(λ, φ) {
    var za = acos(Math.cos(φ) * Math.cos(λ - λa)),
        zb = acos(Math.cos(φ) * Math.cos(λ - λb)),
        ys = φ < 0 ? -1 : 1;
    za *= za, zb *= zb;
    return [
      (za - zb) / (2 * z0),
      ys * asqrt(4 * z02 * zb - (z02 - za + zb) * (z02 - za + zb)) / (2 * z0)
    ];
  }

  forward.invert = function(x, y) {
    var y2 = y * y,
        cosza = Math.cos(Math.sqrt(y2 + (t = x + λa) * t)),
        coszb = Math.cos(Math.sqrt(y2 + (t = x + λb) * t)),
        t,
        d;
    return [
      Math.atan2(d = cosza - coszb, t = (cosza + coszb) * tanλ0),
      (y < 0 ? -1 : 1) * acos(Math.sqrt(t * t + d * d) * S)
    ];
  };

  return forward;
}

function twoPointEquidistantProjection() {
  var points = [[0, 0], [0, 0]],
      m = projectionMutator(twoPointEquidistant),
      p = m(0),
      rotate = p.rotate;

  delete p.rotate;

  p.points = function(_) {
    if (!arguments.length) return points;
    points = _;

    // Compute the origin as the midpoint of the two reference points.
    // Rotate one of the reference points by the origin.
    // Apply the spherical law of sines to compute γ rotation.
    var interpolate = d3.geo.interpolate(_[0], _[1]),
        origin = interpolate(.5),
        p = d3.geo.rotation([-origin[0], -origin[1]])(_[0]),
        b = interpolate.distance * .5,
        γ = -asin(Math.sin(p[1] * radians) / Math.sin(b));
    if (p[0] > 0) γ = π - γ;

    rotate.call(p, [-origin[0], -origin[1], -γ * degrees]);

    return m(b * 2);
  };

  return p;
}

(d3.geo.twoPointEquidistant = twoPointEquidistantProjection).raw = twoPointEquidistant;
