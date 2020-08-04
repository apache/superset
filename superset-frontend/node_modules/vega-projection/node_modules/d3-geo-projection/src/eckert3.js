import {geoProjection as projection} from "d3-geo";
import {pi, sqrt} from "./math.js";

export function eckert3Raw(lambda, phi) {
  var k = sqrt(pi * (4 + pi));
  return [
    2 / k * lambda * (1 + sqrt(1 - 4 * phi * phi / (pi * pi))),
    4 / k * phi
  ];
}

eckert3Raw.invert = function(x, y) {
  var k = sqrt(pi * (4 + pi)) / 2;
  return [
    x * k / (1 + sqrt(1 - y * y * (4 + pi) / (4 * pi))),
    y * k / 2
  ];
};

export default function() {
  return projection(eckert3Raw)
      .scale(180.739);
}
