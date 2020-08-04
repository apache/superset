import parallel1 from "./parallel1.js";
import {atan2, cos, sin, sqrt, tan} from "./math.js";
import {sinusoidalRaw} from "./sinusoidal.js";

export function bonneRaw(phi0) {
  if (!phi0) return sinusoidalRaw;
  var cotPhi0 = 1 / tan(phi0);

  function forward(lambda, phi) {
    var rho = cotPhi0 + phi0 - phi,
        e = rho ? lambda * cos(phi) / rho : rho;
    return [rho * sin(e), cotPhi0 - rho * cos(e)];
  }

  forward.invert = function(x, y) {
    var rho = sqrt(x * x + (y = cotPhi0 - y) * y),
        phi = cotPhi0 + phi0 - rho;
    return [rho / cos(phi) * atan2(x, y), phi];
  };

  return forward;
}

export default function() {
  return parallel1(bonneRaw)
      .scale(123.082)
      .center([0, 26.1441])
      .parallel(45);
}
