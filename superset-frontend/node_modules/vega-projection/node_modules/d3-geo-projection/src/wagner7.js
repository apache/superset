import {geoProjection as projection} from "d3-geo";
import {asin, atan2, cos, sin, sqrt, tan} from "./math.js";

export function wagner7Raw(lambda, phi) {
  var s = 0.90631 * sin(phi),
      c0 = sqrt(1 - s * s),
      c1 = sqrt(2 / (1 + c0 * cos(lambda /= 3)));
  return [
    2.66723 * c0 * c1 * sin(lambda),
    1.24104 * s * c1
  ];
}

wagner7Raw.invert = function(x, y) {
  var t1 = x / 2.66723,
      t2 = y / 1.24104,
      p = sqrt(t1 * t1 + t2 * t2),
      c = 2 * asin(p / 2);
  return [
    3 * atan2(x * tan(c), 2.66723 * p),
    p && asin(y * sin(c) / (1.24104 * 0.90631 * p))
  ];
};

export default function() {
  return projection(wagner7Raw)
      .scale(172.632);
}
