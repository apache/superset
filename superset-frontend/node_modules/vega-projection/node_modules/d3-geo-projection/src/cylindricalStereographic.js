import {atan, cos, tan} from "./math.js";
import parallel1 from "./parallel1.js";

export function cylindricalStereographicRaw(phi0) {
  var cosPhi0 = cos(phi0);

  function forward(lambda, phi) {
    return [lambda * cosPhi0, (1 + cosPhi0) * tan(phi / 2)];
  }

  forward.invert = function(x, y) {
    return [x / cosPhi0, atan(y / (1 + cosPhi0)) * 2];
  };

  return forward;
}

export default function() {
  return parallel1(cylindricalStereographicRaw)
      .scale(124.75);
}
