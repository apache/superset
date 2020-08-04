import {geoProjection as projection} from "d3-geo";
import {acos, asin, cos, sign, sin, tan, sqrt, sqrt1_2} from "./math.js";

export function littrowRaw(lambda, phi) {
  return [
    sin(lambda) / cos(phi),
    tan(phi) * cos(lambda)
  ];
}

littrowRaw.invert = function(x, y) {
  var x2 = x * x,
      y2 = y * y,
      y2_1 = y2 + 1,
      x2_y2_1 = x2 + y2_1,
      cosPhi = x
          ? sqrt1_2 * sqrt((x2_y2_1 - sqrt(x2_y2_1 * x2_y2_1 - 4 * x2)) / x2)
          : 1 / sqrt(y2_1);
  return [
    asin(x * cosPhi),
    sign(y) * acos(cosPhi)
  ];
};

export default function() {
  return projection(littrowRaw)
      .scale(144.049)
      .clipAngle(90 - 1e-3);
}
