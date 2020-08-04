import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {abs, asin, pi, pow, sign, sin} from "./math.js";
import {integrate} from "./integrate.js";

export function hyperellipticalRaw(alpha, k, gamma) {

  function elliptic (f) {
    return alpha + (1 - alpha) * pow(1 - pow(f, k), 1 / k);
  }

  function z(f) {
    return integrate(elliptic, 0, f, 1e-4);
  }

  var G = 1 / z(1),
      n = 1000,
      m = (1 + 1e-8) * G,
      approx = [];
  for (var i = 0; i <= n; i++)
      approx.push(z(i / n) * m);

  function Y(sinphi) {
    var rmin = 0, rmax = n, r = n >> 1;
    do {
      if (approx[r] > sinphi) rmax = r; else rmin = r;
      r = (rmin + rmax) >> 1;
    } while (r > rmin);
    var u = approx[r + 1] - approx[r];
    if (u) u = (sinphi - approx[r + 1]) / u;
    return (r + 1 + u) / n;
  }

  var ratio = 2 * Y(1) / pi * G / gamma;

  var forward = function(lambda, phi) {
    var y = Y(abs(sin(phi))),
        x = elliptic(y) * lambda;
    y /= ratio;
    return [ x, (phi >= 0) ? y : -y ];
  };

  forward.invert = function(x, y) {
    var phi;
    y *= ratio;
    if (abs(y) < 1) phi = sign(y) * asin(z(abs(y)) * G);
    return [ x / elliptic(abs(y)), phi ];
  };

  return forward;
}

export default function() {
  var alpha = 0,
      k = 2.5,
      gamma = 1.183136, // affine = sqrt(2 * gamma / pi) = 0.8679
      m = projectionMutator(hyperellipticalRaw),
      p = m(alpha, k, gamma);

  p.alpha = function(_) {
    return arguments.length ? m(alpha = +_, k, gamma) : alpha;
  };

  p.k = function(_) {
    return arguments.length ? m(alpha, k = +_, gamma) : k;
  };

  p.gamma = function(_) {
    return arguments.length ? m(alpha, k, gamma = +_) : gamma;
  };

  return p
      .scale(152.63);
}
