import {geoProjection as projection} from "d3-geo";
import {atan, exp, log, quarterPi, pi, tan} from "./math.js";

export function millerRaw(lambda, phi) {
  return [lambda, 1.25 * log(tan(quarterPi + 0.4 * phi))];
}

millerRaw.invert = function(x, y) {
  return [x, 2.5 * atan(exp(0.8 * y)) - 0.625 * pi];
};

export default function() {
  return projection(millerRaw)
      .scale(108.318);
}
