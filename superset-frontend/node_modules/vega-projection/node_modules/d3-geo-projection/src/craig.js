import {asin, atan2, cos, sin, sqrt, tan} from "./math.js";
import parallel1 from "./parallel1.js";

export function craigRaw(phi0) {
  var tanPhi0 = tan(phi0);

  function forward(lambda, phi) {
    return [lambda, (lambda ? lambda / sin(lambda) : 1) * (sin(phi) * cos(lambda) - tanPhi0 * cos(phi))];
  }

  forward.invert = tanPhi0 ? function(x, y) {
    if (x) y *= sin(x) / x;
    var cosLambda = cos(x);
    return [x, 2 * atan2(sqrt(cosLambda * cosLambda + tanPhi0 * tanPhi0 - y * y) - cosLambda, tanPhi0 - y)];
  } : function(x, y) {
    return [x, asin(x ? y * tan(x) / x : y)];
  };

  return forward;
}

export default function() {
  return parallel1(craigRaw)
      .scale(249.828)
      .clipAngle(90);
}
