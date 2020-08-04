import {geoProjection as projection} from "d3-geo";
import {abs, halfPi, pi, sign, sqrt1_2} from "../math.js";

export default function(project) {
  var dx = project(halfPi, 0)[0] - project(-halfPi, 0)[0];

  function projectQuincuncial(lambda, phi) {
    var t = abs(lambda) < halfPi,
        p = project(t ? lambda : lambda > 0 ? lambda - pi : lambda + pi, phi),
        x = (p[0] - p[1]) * sqrt1_2,
        y = (p[0] + p[1]) * sqrt1_2;
    if (t) return [x, y];
    var d = dx * sqrt1_2,
        s = x > 0 ^ y > 0 ? -1 : 1;
    return [s * x - sign(y) * d, s * y - sign(x) * d];
  }

  if (project.invert) projectQuincuncial.invert = function(x0, y0) {
    var x = (x0 + y0) * sqrt1_2,
        y = (y0 - x0) * sqrt1_2,
        t = abs(x) < 0.5 * dx && abs(y) < 0.5 * dx;

    if (!t) {
      var d = dx * sqrt1_2,
          s = x > 0 ^ y > 0 ? -1 : 1,
          x1 = -s * x0 + (y > 0 ? 1 : -1) * d,
          y1 = -s * y0 + (x > 0 ? 1 : -1) * d;
      x = (-x1 - y1) * sqrt1_2;
      y = (x1 - y1) * sqrt1_2;
    }

    var p = project.invert(x, y);
    if (!t) p[0] += x > 0 ? pi : -pi;
    return p;
  };

  return projection(projectQuincuncial)
      .rotate([-90, -90, 45])
      .clipAngle(180 - 1e-3);
}
