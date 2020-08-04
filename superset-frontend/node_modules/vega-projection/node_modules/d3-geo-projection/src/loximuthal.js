import parallel1 from "./parallel1.js";
import {abs, cos, epsilon, halfPi, log, quarterPi, tan} from "./math.js";

export function loximuthalRaw(phi0) {
  var cosPhi0 = cos(phi0),
      tanPhi0 = tan(quarterPi + phi0 / 2);

  function forward(lambda, phi) {
    var y = phi - phi0,
        x = abs(y) < epsilon ? lambda * cosPhi0
            : abs(x = quarterPi + phi / 2) < epsilon || abs(abs(x) - halfPi) < epsilon
            ? 0 : lambda * y / log(tan(x) / tanPhi0);
    return [x, y];
  }

  forward.invert = function(x, y) {
    var lambda,
        phi = y + phi0;
    return [
      abs(y) < epsilon ? x / cosPhi0
          : (abs(lambda = quarterPi + phi / 2) < epsilon || abs(abs(lambda) - halfPi) < epsilon) ? 0
          : x * log(tan(lambda) / tanPhi0) / y,
      phi
    ];
  };

  return forward;
}

export default function() {
  return parallel1(loximuthalRaw)
      .parallel(40)
      .scale(158.837);
}
