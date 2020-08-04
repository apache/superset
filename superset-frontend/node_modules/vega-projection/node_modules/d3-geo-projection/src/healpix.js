import {range} from "d3-array";
import {geoStream, geoProjectionMutator as projectionMutator} from "d3-geo";
import {collignonRaw} from "./collignon.js";
import {cylindricalEqualAreaRaw} from "./cylindricalEqualArea.js";
import {abs, asin, degrees, epsilon, floor, max, min, pi, radians, sqrtPi, tau} from "./math.js";

var K = 3,
    healpixParallel = asin(1 - 1 / K) * degrees,
    healpixLambert = cylindricalEqualAreaRaw(0);

export function healpixRaw(H) {
  var phi0 = healpixParallel * radians,
      dx = collignonRaw(pi, phi0)[0] - collignonRaw(-pi, phi0)[0],
      y0 = healpixLambert(0, phi0)[1],
      y1 = collignonRaw(0, phi0)[1],
      dy1 = sqrtPi - y1,
      k = tau / H,
      w = 4 / tau,
      h = y0 + (dy1 * dy1 * 4) / tau;

  function forward(lambda, phi) {
    var point,
        phi2 = abs(phi);
    if (phi2 > phi0) {
      var i = min(H - 1, max(0, floor((lambda + pi) / k)));
      lambda += pi * (H - 1) / H - i * k;
      point = collignonRaw(lambda, phi2);
      point[0] = point[0] * tau / dx - tau * (H - 1) / (2 * H) + i * tau / H;
      point[1] = y0 + (point[1] - y1) * 4 * dy1 / tau;
      if (phi < 0) point[1] = -point[1];
    } else {
      point = healpixLambert(lambda, phi);
    }
    point[0] *= w, point[1] /= h;
    return point;
  }

  forward.invert = function(x, y) {
    x /= w, y *= h;
    var y2 = abs(y);
    if (y2 > y0) {
      var i = min(H - 1, max(0, floor((x + pi) / k)));
      x = (x + pi * (H - 1) / H - i * k) * dx / tau;
      var point = collignonRaw.invert(x, 0.25 * (y2 - y0) * tau / dy1 + y1);
      point[0] -= pi * (H - 1) / H - i * k;
      if (y < 0) point[1] = -point[1];
      return point;
    }
    return healpixLambert.invert(x, y);
  };

  return forward;
}

function sphereTop(x, i) {
  return [x, i & 1 ? 90 - epsilon : healpixParallel];
}

function sphereBottom(x, i) {
  return [x, i & 1 ? -90 + epsilon : -healpixParallel];
}

function sphereNudge(d) {
  return [d[0] * (1 - epsilon), d[1]];
}

function sphere(step) {
  var c = [].concat(
    range(-180, 180 + step / 2, step).map(sphereTop),
    range(180, -180 - step / 2, -step).map(sphereBottom)
  );
  return {
    type: "Polygon",
    coordinates: [step === 180 ? c.map(sphereNudge) : c]
  };
}

export default function() {
  var H = 4,
      m = projectionMutator(healpixRaw),
      p = m(H),
      stream_ = p.stream;

  p.lobes = function(_) {
    return arguments.length ? m(H = +_) : H;
  };

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (p.rotate([0, 0]), stream_(stream));
    p.rotate(rotate);
    rotateStream.sphere = function() { geoStream(sphere(180 / H), sphereStream); };
    return rotateStream;
  };

  return p
      .scale(239.75);
}
