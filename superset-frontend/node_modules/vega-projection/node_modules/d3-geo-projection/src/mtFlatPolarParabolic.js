import {geoProjection as projection} from "d3-geo";
import {asin, cos, sin, sqrt} from "./math.js";

var sqrt6 = sqrt(6),
    sqrt7 = sqrt(7);

export function mtFlatPolarParabolicRaw(lambda, phi) {
  var theta = asin(7 * sin(phi) / (3 * sqrt6));
  return [
    sqrt6 * lambda * (2 * cos(2 * theta / 3) - 1) / sqrt7,
    9 * sin(theta / 3) / sqrt7
  ];
}

mtFlatPolarParabolicRaw.invert = function(x, y) {
  var theta = 3 * asin(y * sqrt7 / 9);
  return [
    x * sqrt7 / (sqrt6 * (2 * cos(2 * theta / 3) - 1)),
    asin(sin(theta) * 3 * sqrt6 / 7)
  ];
};

export default function() {
  return projection(mtFlatPolarParabolicRaw)
      .scale(164.859);
}
