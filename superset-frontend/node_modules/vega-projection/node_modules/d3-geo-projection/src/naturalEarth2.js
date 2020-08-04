import {geoProjection as projection} from "d3-geo";
import {abs, epsilon2} from "./math.js";

export function naturalEarth2Raw(lambda, phi) {
  var phi2 = phi * phi, phi4 = phi2 * phi2, phi6 = phi2 * phi4;
  return [
    lambda * (0.84719 - 0.13063 * phi2 + phi6 * phi6 * (-0.04515 + 0.05494 * phi2 - 0.02326 * phi4 + 0.00331 * phi6)),
    phi * (1.01183 + phi4 * phi4 * (-0.02625 + 0.01926 * phi2 - 0.00396 * phi4))
  ];
}

naturalEarth2Raw.invert = function(x, y) {
  var phi = y, i = 25, delta, phi2, phi4, phi6;
  do {
    phi2 = phi * phi; phi4 = phi2 * phi2;
    phi -= delta = ((phi * (1.01183 + phi4 * phi4 * (-0.02625 + 0.01926 * phi2 - 0.00396 * phi4))) - y) /
      (1.01183 + phi4 * phi4 * ((9 * -0.02625) + (11 * 0.01926) * phi2 + (13 * -0.00396) * phi4));
  } while (abs(delta) > epsilon2 && --i > 0);
  phi2 = phi * phi; phi4 = phi2 * phi2; phi6 = phi2 * phi4;
  return [
    x / (0.84719 - 0.13063 * phi2 + phi6 * phi6 * (-0.04515 + 0.05494 * phi2 - 0.02326 * phi4 + 0.00331 * phi6)),
    phi
  ];
};

export default function() {
  return projection(naturalEarth2Raw)
      .scale(175.295);
}
