import {geoInterpolate as interpolate, geoProjection as projection, geoRotation as rotation} from "d3-geo";
import {asin, degrees, pi, sin, radians} from "./math.js";

// Compute the origin as the midpoint of the two reference points.
// Rotate one of the reference points by the origin.
// Apply the spherical law of sines to compute gamma rotation.
export default function(raw, p0, p1) {
  var i = interpolate(p0, p1),
      o = i(0.5),
      a = rotation([-o[0], -o[1]])(p0),
      b = i.distance / 2,
      y = -asin(sin(a[1] * radians) / sin(b)),
      R = [-o[0], -o[1], -(a[0] > 0 ? pi - y : y) * degrees],
      p = projection(raw(b)).rotate(R),
      r = rotation(R),
      center = p.center;

  delete p.rotate;

  p.center = function(_) {
    return arguments.length ? center(r(_)) : r.invert(center());
  };

  return p
      .clipAngle(90);
}
