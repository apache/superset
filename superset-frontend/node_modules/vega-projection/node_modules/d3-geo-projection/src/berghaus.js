import {geoProjectionMutator as projectionMutator, geoAzimuthalEquidistantRaw as azimuthalEquidistantRaw} from "d3-geo";
import {abs, acos, asin, atan, atan2, cos, degrees, halfPi, pi, radians, round, sin, sqrt, tan} from "./math.js";

export function berghausRaw(lobes) {
  var k = 2 * pi / lobes;

  function forward(lambda, phi) {
    var p = azimuthalEquidistantRaw(lambda, phi);
    if (abs(lambda) > halfPi) { // back hemisphere
      var theta = atan2(p[1], p[0]),
          r = sqrt(p[0] * p[0] + p[1] * p[1]),
          theta0 = k * round((theta - halfPi) / k) + halfPi,
          alpha = atan2(sin(theta -= theta0), 2 - cos(theta)); // angle relative to lobe end
      theta = theta0 + asin(pi / r * sin(alpha)) - alpha;
      p[0] = r * cos(theta);
      p[1] = r * sin(theta);
    }
    return p;
  }

  forward.invert = function(x, y) {
    var r = sqrt(x * x + y * y);
    if (r > halfPi) {
      var theta = atan2(y, x),
          theta0 = k * round((theta - halfPi) / k) + halfPi,
          s = theta > theta0 ? -1 : 1,
          A = r * cos(theta0 - theta),
          cotAlpha = 1 / tan(s * acos((A - pi) / sqrt(pi * (pi - 2 * A) + r * r)));
      theta = theta0 + 2 * atan((cotAlpha + s * sqrt(cotAlpha * cotAlpha - 3)) / 3);
      x = r * cos(theta), y = r * sin(theta);
    }
    return azimuthalEquidistantRaw.invert(x, y);
  };

  return forward;
}

export default function() {
  var lobes = 5,
      m = projectionMutator(berghausRaw),
      p = m(lobes),
      projectionStream = p.stream,
      epsilon = 1e-2,
      cr = -cos(epsilon * radians),
      sr = sin(epsilon * radians);

  p.lobes = function(_) {
    return arguments.length ? m(lobes = +_) : lobes;
  };

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = projectionStream(stream),
        sphereStream = (p.rotate([0, 0]), projectionStream(stream));
    p.rotate(rotate);
    rotateStream.sphere = function() {
      sphereStream.polygonStart(), sphereStream.lineStart();
      for (var i = 0, delta = 360 / lobes, delta0 = 2 * pi / lobes, phi = 90 - 180 / lobes, phi0 = halfPi; i < lobes; ++i, phi -= delta, phi0 -= delta0) {
        sphereStream.point(atan2(sr * cos(phi0), cr) * degrees, asin(sr * sin(phi0)) * degrees);
        if (phi < -90) {
          sphereStream.point(-90, -180 - phi - epsilon);
          sphereStream.point(-90, -180 - phi + epsilon);
        } else {
          sphereStream.point(90, phi + epsilon);
          sphereStream.point(90, phi - epsilon);
        }
      }
      sphereStream.lineEnd(), sphereStream.polygonEnd();
    };
    return rotateStream;
  };

  return p
      .scale(87.8076)
      .center([0, 17.1875])
      .clipAngle(180 - 1e-3);
}
