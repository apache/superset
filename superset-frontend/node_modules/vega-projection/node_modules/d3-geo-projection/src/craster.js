import {geoProjection as projection} from "d3-geo";
import {asin, cos, sin, sqrt, sqrtPi} from "./math.js";

var sqrt3 = sqrt(3);

export function crasterRaw(lambda, phi) {
  return [sqrt3 * lambda * (2 * cos(2 * phi / 3) - 1) / sqrtPi, sqrt3 * sqrtPi * sin(phi / 3)];
}

crasterRaw.invert = function(x, y) {
  var phi = 3 * asin(y / (sqrt3 * sqrtPi));
  return [sqrtPi * x / (sqrt3 * (2 * cos(2 * phi / 3) - 1)), phi];
};

export default function() {
  return projection(crasterRaw)
      .scale(156.19);
}
