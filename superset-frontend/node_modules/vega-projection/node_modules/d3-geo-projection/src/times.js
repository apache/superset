import {geoProjection as projection} from "d3-geo";
import {atan, quarterPi, sin, tan} from "./math.js";

export function timesRaw(lambda, phi) {
  var t = tan(phi / 2),
      s = sin(quarterPi * t);
  return [
    lambda * (0.74482 - 0.34588 * s * s),
    1.70711 * t
  ];
}

timesRaw.invert = function(x, y) {
  var t = y / 1.70711,
      s = sin(quarterPi * t);
  return [
    x / (0.74482 - 0.34588 * s * s),
    2 * atan(t)
  ];
};

export default function() {
  return projection(timesRaw)
      .scale(146.153);
}
