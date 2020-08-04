import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {abs, acos, asin, atan2, cos, epsilon2, halfPi, pi, sin, sqrt} from "./math.js";

export function hillRaw(K) {
  var L = 1 + K,
      sinBt = sin(1 / L),
      Bt = asin(sinBt),
      A = 2 * sqrt(pi / (B = pi + 4 * Bt * L)),
      B,
      rho0 = 0.5 * A * (L + sqrt(K * (2 + K))),
      K2 = K * K,
      L2 = L * L;

  function forward(lambda, phi) {
    var t = 1 - sin(phi),
        rho,
        omega;
    if (t && t < 2) {
      var theta = halfPi - phi, i = 25, delta;
      do {
        var sinTheta = sin(theta),
            cosTheta = cos(theta),
            Bt_Bt1 = Bt + atan2(sinTheta, L - cosTheta),
            C = 1 + L2 - 2 * L * cosTheta;
        theta -= delta = (theta - K2 * Bt - L * sinTheta + C * Bt_Bt1 -0.5 * t * B) / (2 * L * sinTheta * Bt_Bt1);
      } while (abs(delta) > epsilon2 && --i > 0);
      rho = A * sqrt(C);
      omega = lambda * Bt_Bt1 / pi;
    } else {
      rho = A * (K + t);
      omega = lambda * Bt / pi;
    }
    return [
      rho * sin(omega),
      rho0 - rho * cos(omega)
    ];
  }

  forward.invert = function(x, y) {
    var rho2 = x * x + (y -= rho0) * y,
        cosTheta = (1 + L2 - rho2 / (A * A)) / (2 * L),
        theta = acos(cosTheta),
        sinTheta = sin(theta),
        Bt_Bt1 = Bt + atan2(sinTheta, L - cosTheta);
    return [
      asin(x / sqrt(rho2)) * pi / Bt_Bt1,
      asin(1 - 2 * (theta - K2 * Bt - L * sinTheta + (1 + L2 - 2 * L * cosTheta) * Bt_Bt1) / B)
    ];
  };

  return forward;
}

export default function() {
  var K = 1,
      m = projectionMutator(hillRaw),
      p = m(K);

  p.ratio = function(_) {
    return arguments.length ? m(K = +_) : K;
  };

  return p
      .scale(167.774)
      .center([0, 18.67]);
}
