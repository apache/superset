import {geoProjection as projection} from "d3-geo";
import {pi, sqrt, tau} from "./math.js";

export function kavrayskiy7Raw(lambda, phi) {
  return [3 / tau * lambda * sqrt(pi * pi / 3 - phi * phi), phi];
}

kavrayskiy7Raw.invert = function(x, y) {
  return [tau / 3 * x / sqrt(pi * pi / 3 - y * y), y];
};

export default function() {
  return projection(kavrayskiy7Raw)
      .scale(158.837);
}
