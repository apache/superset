import {geoProjection as projection} from "d3-geo";
import {atan, cos, radians, sqrt, tan} from "./math.js";

var faheyK = cos(35 * radians);

export function faheyRaw(lambda, phi) {
  var t = tan(phi / 2);
  return [lambda * faheyK * sqrt(1 - t * t), (1 + faheyK) * t];
}

faheyRaw.invert = function(x, y) {
  var t = y / (1 + faheyK);
  return [x && x / (faheyK * sqrt(1 - t * t)), 2 * atan(t)];
};

export default function() {
  return projection(faheyRaw)
      .scale(137.152);
}
