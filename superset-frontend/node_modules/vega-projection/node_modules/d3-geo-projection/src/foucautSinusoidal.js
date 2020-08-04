import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {cos, halfPi, pi, sin, sqrt} from "./math.js";
import {solve} from "./newton.js";

export function foucautSinusoidalRaw(alpha) {
  var beta = 1 - alpha,
      equatorial = raw(pi, 0)[0] - raw(-pi, 0)[0],
      polar = raw(0, halfPi)[1] - raw(0, -halfPi)[1],
      ratio = sqrt(2 * polar / equatorial);

  function raw(lambda, phi) {
    var cosphi = cos(phi),
        sinphi = sin(phi);
    return [
      cosphi / (beta + alpha * cosphi) * lambda,
      beta * phi + alpha * sinphi
    ];
  }

  function forward(lambda, phi) {
    var p = raw(lambda, phi);
    return [p[0] * ratio, p[1] / ratio];
  }

  function forwardMeridian(phi) {
    return forward(0, phi)[1];
  }

  forward.invert = function(x, y) {
    var phi = solve(forwardMeridian, y),
        lambda = x / ratio * (alpha + beta / cos(phi));
    return [lambda, phi];
  };

  return forward;
}

export default function() {
  var alpha = 0.5,
      m = projectionMutator(foucautSinusoidalRaw),
      p = m(alpha);

  p.alpha = function(_) {
    return arguments.length ? m(alpha = +_) : alpha;
  };

  return p
      .scale(168.725);
}
