import {geoProjection as projection} from "d3-geo";
import {mollweideBromleyTheta} from "./mollweide.js";
import {abs, cos, epsilon, pi, quarterPi, sin, sqrt2} from "./math.js";

var k = 2.00276,
    w = 1.11072;

export function boggsRaw(lambda, phi) {
  var theta = mollweideBromleyTheta(pi, phi);
  return [k * lambda / (1 / cos(phi) + w / cos(theta)), (phi + sqrt2 * sin(theta)) / k];
}

boggsRaw.invert = function(x, y) {
  var ky = k * y, theta = y < 0 ? -quarterPi : quarterPi, i = 25, delta, phi;
  do {
    phi = ky - sqrt2 * sin(theta);
    theta -= delta = (sin(2 * theta) + 2 * theta - pi * sin(phi)) / (2 * cos(2 * theta) + 2 + pi * cos(phi) * sqrt2 * cos(theta));
  } while (abs(delta) > epsilon && --i > 0);
  phi = ky - sqrt2 * sin(theta);
  return [x * (1 / cos(phi) + w / cos(theta)) / k, phi];
};

export default function() {
  return projection(boggsRaw)
      .scale(160.857);
}
