import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {abs, asin, atan2, cos, degrees, epsilon, halfPi, log, radians, sin, sqrt, tan} from "./math.js";

export function airyRaw(beta) {
  var tanBeta_2 = tan(beta / 2),
      b = 2 * log(cos(beta / 2)) / (tanBeta_2 * tanBeta_2);

  function forward(x, y) {
    var cosx = cos(x),
        cosy = cos(y),
        siny = sin(y),
        cosz = cosy * cosx,
        k = -((1 - cosz ? log((1 + cosz) / 2) / (1 - cosz) : -0.5) + b / (1 + cosz));
    return [k * cosy * sin(x), k * siny];
  }

  forward.invert = function(x, y) {
    var r = sqrt(x * x + y * y),
        z = -beta / 2,
        i = 50, delta;
    if (!r) return [0, 0];
    do {
      var z_2 = z / 2,
          cosz_2 = cos(z_2),
          sinz_2 = sin(z_2),
          tanz_2 = sinz_2 / cosz_2,
          lnsecz_2 = -log(abs(cosz_2));
      z -= delta = (2 / tanz_2 * lnsecz_2 - b * tanz_2 - r) / (-lnsecz_2 / (sinz_2 * sinz_2) + 1 - b / (2 * cosz_2 * cosz_2)) * (cosz_2 < 0 ? 0.7 : 1);
    } while (abs(delta) > epsilon && --i > 0);
    var sinz = sin(z);
    return [atan2(x * sinz, r * cos(z)), asin(y * sinz / r)];
  };

  return forward;
}

export default function() {
  var beta = halfPi,
      m = projectionMutator(airyRaw),
      p = m(beta);

  p.radius = function(_) {
    return arguments.length ? m(beta = _ * radians) : beta * degrees;
  };

  return p
      .scale(179.976)
      .clipAngle(147);
}
