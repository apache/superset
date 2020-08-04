import {geoProjection as projection} from "d3-geo";
import {abs, atan, cos, epsilon2, exp, halfPi, log, quarterPi, sign, sin, sqrt, sqrt2, tan} from "./math.js";

var sqrt8 = sqrt(8),
    phi0 = log(1 + sqrt2);

export function bakerRaw(lambda, phi) {
  var phi0 = abs(phi);
  return phi0 < quarterPi
      ? [lambda, log(tan(quarterPi + phi / 2))]
      : [lambda * cos(phi0) * (2 * sqrt2 - 1 / sin(phi0)), sign(phi) * (2 * sqrt2 * (phi0 - quarterPi) - log(tan(phi0 / 2)))];
}

bakerRaw.invert = function(x, y) {
  if ((y0 = abs(y)) < phi0) return [x, 2 * atan(exp(y)) - halfPi];
  var phi = quarterPi, i = 25, delta, y0;
  do {
    var cosPhi_2 = cos(phi / 2), tanPhi_2 = tan(phi / 2);
    phi -= delta = (sqrt8 * (phi - quarterPi) - log(tanPhi_2) - y0) / (sqrt8 - cosPhi_2 * cosPhi_2 / (2 * tanPhi_2));
  } while (abs(delta) > epsilon2 && --i > 0);
  return [x / (cos(phi) * (sqrt8 - 1 / sin(phi))), sign(y) * phi];
};

export default function() {
  return projection(bakerRaw)
      .scale(112.314);
}
