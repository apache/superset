import {geoProjection as projection} from "d3-geo";
import {abs, asin, atan2, cos, sign, epsilon, epsilon2, halfPi, pi, sin, sqrt} from "./math.js";
import squareRaw from "./square.js";

export function gringortenRaw(lambda, phi) {
  var sLambda = sign(lambda),
      sPhi = sign(phi),
      cosPhi = cos(phi),
      x = cos(lambda) * cosPhi,
      y = sin(lambda) * cosPhi,
      z = sin(sPhi * phi);
  lambda = abs(atan2(y, z));
  phi = asin(x);
  if (abs(lambda - halfPi) > epsilon) lambda %= halfPi;
  var point = gringortenHexadecant(lambda > pi / 4 ? halfPi - lambda : lambda, phi);
  if (lambda > pi / 4) z = point[0], point[0] = -point[1], point[1] = -z;
  return (point[0] *= sLambda, point[1] *= -sPhi, point);
}

gringortenRaw.invert = function(x, y) {
  if (abs(x) > 1) x = sign(x) * 2 - x;
  if (abs(y) > 1) y = sign(y) * 2 - y;
  var sx = sign(x),
      sy = sign(y),
      x0 = -sx * x,
      y0 = -sy * y,
      t = y0 / x0 < 1,
      p = gringortenHexadecantInvert(t ? y0 : x0, t ? x0 : y0),
      lambda = p[0],
      phi = p[1],
      cosPhi = cos(phi);
  if (t) lambda = -halfPi - lambda;
  return [sx * (atan2(sin(lambda) * cosPhi, -sin(phi)) + pi), sy * asin(cos(lambda) * cosPhi)];
};

function gringortenHexadecant(lambda, phi) {
  if (phi === halfPi) return [0, 0];

  var sinPhi = sin(phi),
      r = sinPhi * sinPhi,
      r2 = r * r,
      j = 1 + r2,
      k = 1 + 3 * r2,
      q = 1 - r2,
      z = asin(1 / sqrt(j)),
      v = q + r * j * z,
      p2 = (1 - sinPhi) / v,
      p = sqrt(p2),
      a2 = p2 * j,
      a = sqrt(a2),
      h = p * q,
      x,
      i;

  if (lambda === 0) return [0, -(h + r * a)];

  var cosPhi = cos(phi),
      secPhi = 1 / cosPhi,
      drdPhi = 2 * sinPhi * cosPhi,
      dvdPhi = (-3 * r + z * k) * drdPhi,
      dp2dPhi = (-v * cosPhi - (1 - sinPhi) * dvdPhi) / (v * v),
      dpdPhi = (0.5 * dp2dPhi) / p,
      dhdPhi = q * dpdPhi - 2 * r * p * drdPhi,
      dra2dPhi = r * j * dp2dPhi + p2 * k * drdPhi,
      mu = -secPhi * drdPhi,
      nu = -secPhi * dra2dPhi,
      zeta = -2 * secPhi * dhdPhi,
      lambda1 = 4 * lambda / pi,
      delta;

  // Slower but accurate bisection method.
  if (lambda > 0.222 * pi || phi < pi / 4 && lambda > 0.175 * pi) {
    x = (h + r * sqrt(a2 * (1 + r2) - h * h)) / (1 + r2);
    if (lambda > pi / 4) return [x, x];
    var x1 = x, x0 = 0.5 * x;
    x = 0.5 * (x0 + x1), i = 50;
    do {
      var g = sqrt(a2 - x * x),
          f = (x * (zeta + mu * g) + nu * asin(x / a)) - lambda1;
      if (!f) break;
      if (f < 0) x0 = x;
      else x1 = x;
      x = 0.5 * (x0 + x1);
    } while (abs(x1 - x0) > epsilon && --i > 0);
  }

  // Newton-Raphson.
  else {
    x = epsilon, i = 25;
    do {
      var x2 = x * x,
          g2 = sqrt(a2 - x2),
          zetaMug = zeta + mu * g2,
          f2 = x * zetaMug + nu * asin(x / a) - lambda1,
          df = zetaMug + (nu - mu * x2) / g2;
      x -= delta = g2 ? f2 / df : 0;
    } while (abs(delta) > epsilon && --i > 0);
  }

  return [x, -h - r * sqrt(a2 - x * x)];
}

function gringortenHexadecantInvert(x, y) {
  var x0 = 0,
      x1 = 1,
      r = 0.5,
      i = 50;

  while (true) {
    var r2 = r * r,
        sinPhi = sqrt(r),
        z = asin(1 / sqrt(1 + r2)),
        v = (1 - r2) + r * (1 + r2) * z,
        p2 = (1 - sinPhi) / v,
        p = sqrt(p2),
        a2 = p2 * (1 + r2),
        h = p * (1 - r2),
        g2 = a2 - x * x,
        g = sqrt(g2),
        y0 = y + h + r * g;
    if (abs(x1 - x0) < epsilon2 || --i === 0 || y0 === 0) break;
    if (y0 > 0) x0 = r;
    else x1 = r;
    r = 0.5 * (x0 + x1);
  }

  if (!i) return null;

  var phi = asin(sinPhi),
      cosPhi = cos(phi),
      secPhi = 1 / cosPhi,
      drdPhi = 2 * sinPhi * cosPhi,
      dvdPhi = (-3 * r + z * (1 + 3 * r2)) * drdPhi,
      dp2dPhi = (-v * cosPhi - (1 - sinPhi) * dvdPhi) / (v * v),
      dpdPhi = 0.5 * dp2dPhi / p,
      dhdPhi = (1 - r2) * dpdPhi - 2 * r * p * drdPhi,
      zeta = -2 * secPhi * dhdPhi,
      mu = -secPhi * drdPhi,
      nu = -secPhi * (r * (1 + r2) * dp2dPhi + p2 * (1 + 3 * r2) * drdPhi);

  return [pi / 4 * (x * (zeta + mu * g) + nu * asin(x / sqrt(a2))), phi];
}

export default function() {
  return projection(squareRaw(gringortenRaw))
      .scale(239.75);
}
