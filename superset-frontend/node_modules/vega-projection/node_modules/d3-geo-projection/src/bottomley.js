import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {atan2, cos, halfPi, sin, sqrt} from "./math.js";

export function bottomleyRaw(sinPsi) {

  function forward(lambda, phi) {
    var rho = halfPi - phi,
        eta = rho ? lambda * sinPsi * sin(rho) / rho : rho;
    return [rho * sin(eta) / sinPsi, halfPi - rho * cos(eta)];
  }

  forward.invert = function(x, y) {
    var x1 = x * sinPsi,
        y1 = halfPi - y,
        rho = sqrt(x1 * x1 + y1 * y1),
        eta = atan2(x1, y1);
    return [(rho ? rho / sin(rho) : 1) * eta / sinPsi, halfPi - rho];
  };

  return forward;
}

export default function() {
  var sinPsi = 0.5,
      m = projectionMutator(bottomleyRaw),
      p = m(sinPsi);

  p.fraction = function(_) {
    return arguments.length ? m(sinPsi = +_) : sinPsi;
  };

  return p
      .scale(158.837);
}
