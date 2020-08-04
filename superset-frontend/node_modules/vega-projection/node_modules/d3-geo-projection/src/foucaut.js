import {geoProjection as projection} from "d3-geo";
import {atan, cos, sqrtPi, tan} from "./math.js";

export function foucautRaw(lambda, phi) {
  var k = phi / 2, cosk = cos(k);
  return [ 2 * lambda / sqrtPi * cos(phi) * cosk * cosk, sqrtPi * tan(k)];
}

foucautRaw.invert = function(x, y) {
  var k = atan(y / sqrtPi), cosk = cos(k), phi = 2 * k;
  return [x * sqrtPi / 2 / (cos(phi) * cosk * cosk), phi];
};

export default function() {
  return projection(foucautRaw)
      .scale(135.264);
}
