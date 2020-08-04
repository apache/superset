import {geoAzimuthalEquidistantRaw as azimuthalEquidistantRaw} from "d3-geo";
import {acos, atan2, cos, sin, sqrt, tan} from "./math.js";
import twoPoint from "./twoPoint.js";

// TODO clip to ellipse
export function twoPointEquidistantRaw(z0) {
  if (!(z0 *= 2)) return azimuthalEquidistantRaw;
  var lambdaa = -z0 / 2,
      lambdab = -lambdaa,
      z02 = z0 * z0,
      tanLambda0 = tan(lambdab),
      S = 0.5 / sin(lambdab);

  function forward(lambda, phi) {
    var za = acos(cos(phi) * cos(lambda - lambdaa)),
        zb = acos(cos(phi) * cos(lambda - lambdab)),
        ys = phi < 0 ? -1 : 1;
    za *= za, zb *= zb;
    return [
      (za - zb) / (2 * z0),
      ys * sqrt(4 * z02 * zb - (z02 - za + zb) * (z02 - za + zb)) / (2 * z0)
    ];
  }

  forward.invert = function(x, y) {
    var y2 = y * y,
        cosza = cos(sqrt(y2 + (t = x + lambdaa) * t)),
        coszb = cos(sqrt(y2 + (t = x + lambdab) * t)),
        t,
        d;
    return [
      atan2(d = cosza - coszb, t = (cosza + coszb) * tanLambda0),
      (y < 0 ? -1 : 1) * acos(sqrt(t * t + d * d) * S)
    ];
  };

  return forward;
}

export function twoPointEquidistantUsa() {
  return twoPointEquidistant([-158, 21.5], [-77, 39])
      .clipAngle(130)
      .scale(122.571);
}

export default function twoPointEquidistant(p0, p1) {
  return twoPoint(twoPointEquidistantRaw, p0, p1);
}
