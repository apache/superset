import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {abs, atan2, cos, degrees, epsilon, radians, sin, tan} from "./math.js";

export function armadilloRaw(phi0) {
  var sinPhi0 = sin(phi0),
      cosPhi0 = cos(phi0),
      sPhi0 = phi0 >= 0 ? 1 : -1,
      tanPhi0 = tan(sPhi0 * phi0),
      k = (1 + sinPhi0 - cosPhi0) / 2;

  function forward(lambda, phi) {
    var cosPhi = cos(phi),
        cosLambda = cos(lambda /= 2);
    return [
      (1 + cosPhi) * sin(lambda),
      (sPhi0 * phi > -atan2(cosLambda, tanPhi0) - 1e-3 ? 0 : -sPhi0 * 10) + k + sin(phi) * cosPhi0 - (1 + cosPhi) * sinPhi0 * cosLambda // TODO D3 core should allow null or [NaN, NaN] to be returned.
    ];
  }

  forward.invert = function(x, y) {
    var lambda = 0,
        phi = 0,
        i = 50;
    do {
      var cosLambda = cos(lambda),
          sinLambda = sin(lambda),
          cosPhi = cos(phi),
          sinPhi = sin(phi),
          A = 1 + cosPhi,
          fx = A * sinLambda - x,
          fy = k + sinPhi * cosPhi0 - A * sinPhi0 * cosLambda - y,
          dxdLambda = A * cosLambda / 2,
          dxdPhi = -sinLambda * sinPhi,
          dydLambda = sinPhi0 * A * sinLambda / 2,
          dydPhi = cosPhi0 * cosPhi + sinPhi0 * cosLambda * sinPhi,
          denominator = dxdPhi * dydLambda - dydPhi * dxdLambda,
          dLambda = (fy * dxdPhi - fx * dydPhi) / denominator / 2,
          dPhi = (fx * dydLambda - fy * dxdLambda) / denominator;
      if (abs(dPhi) > 2) dPhi /= 2;
      lambda -= dLambda, phi -= dPhi;
    } while ((abs(dLambda) > epsilon || abs(dPhi) > epsilon) && --i > 0);
    return sPhi0 * phi > -atan2(cos(lambda), tanPhi0) - 1e-3 ? [lambda * 2, phi] : null;
  };

  return forward;
}

export default function() {
  var phi0 = 20 * radians,
      sPhi0 = phi0 >= 0 ? 1 : -1,
      tanPhi0 = tan(sPhi0 * phi0),
      m = projectionMutator(armadilloRaw),
      p = m(phi0),
      stream_ = p.stream;

  p.parallel = function(_) {
    if (!arguments.length) return phi0 * degrees;
    tanPhi0 = tan((sPhi0 = (phi0 = _ * radians) >= 0 ? 1 : -1) * phi0);
    return m(phi0);
  };

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (p.rotate([0, 0]), stream_(stream)),
        precision = p.precision();
    p.rotate(rotate);
    rotateStream.sphere = function() {
      sphereStream.polygonStart(), sphereStream.lineStart();
      for (var lambda = sPhi0 * -180; sPhi0 * lambda < 180; lambda += sPhi0 * 90)
        sphereStream.point(lambda, sPhi0 * 90);
      if (phi0) while (sPhi0 * (lambda -= 3 * sPhi0 * precision) >= -180) {
        sphereStream.point(lambda, sPhi0 * -atan2(cos(lambda * radians / 2), tanPhi0) * degrees);
      }
      sphereStream.lineEnd(), sphereStream.polygonEnd();
    };
    return rotateStream;
  };

  return p
      .scale(218.695)
      .center([0, 28.0974]);
}
