import {geoAzimuthalEquidistantRaw as azimuthalEquidistantRaw, geoProjectionMutator as projectionMutator} from "d3-geo";
import {abs, asin, atan2, cos, degrees, epsilon, epsilon2, halfPi, pi, radians, round, sin, sqrt} from "./math.js";

export function gingeryRaw(rho, n) {
  var k = 2 * pi / n,
      rho2 = rho * rho;

  function forward(lambda, phi) {
    var p = azimuthalEquidistantRaw(lambda, phi),
        x = p[0],
        y = p[1],
        r2 = x * x + y * y;

    if (r2 > rho2) {
      var r = sqrt(r2),
          theta = atan2(y, x),
          theta0 = k * round(theta / k),
          alpha = theta - theta0,
          rhoCosAlpha = rho * cos(alpha),
          k_ = (rho * sin(alpha) - alpha * sin(rhoCosAlpha)) / (halfPi - rhoCosAlpha),
          s_ = gingeryLength(alpha, k_),
          e = (pi - rho) / gingeryIntegrate(s_, rhoCosAlpha, pi);

      x = r;
      var i = 50, delta;
      do {
        x -= delta = (rho + gingeryIntegrate(s_, rhoCosAlpha, x) * e - r) / (s_(x) * e);
      } while (abs(delta) > epsilon && --i > 0);

      y = alpha * sin(x);
      if (x < halfPi) y -= k_ * (x - halfPi);

      var s = sin(theta0),
          c = cos(theta0);
      p[0] = x * c - y * s;
      p[1] = x * s + y * c;
    }
    return p;
  }

  forward.invert = function(x, y) {
    var r2 = x * x + y * y;
    if (r2 > rho2) {
      var r = sqrt(r2),
          theta = atan2(y, x),
          theta0 = k * round(theta / k),
          dTheta = theta - theta0;

      x = r * cos(dTheta);
      y = r * sin(dTheta);

      var x_halfPi = x - halfPi,
          sinx = sin(x),
          alpha = y / sinx,
          delta = x < halfPi ? Infinity : 0,
          i = 10;

      while (true) {
        var rhosinAlpha = rho * sin(alpha),
            rhoCosAlpha = rho * cos(alpha),
            sinRhoCosAlpha = sin(rhoCosAlpha),
            halfPi_RhoCosAlpha = halfPi - rhoCosAlpha,
            k_ = (rhosinAlpha - alpha * sinRhoCosAlpha) / halfPi_RhoCosAlpha,
            s_ = gingeryLength(alpha, k_);

        if (abs(delta) < epsilon2 || !--i) break;

        alpha -= delta = (alpha * sinx - k_ * x_halfPi - y) / (
          sinx - x_halfPi * 2 * (
            halfPi_RhoCosAlpha * (rhoCosAlpha + alpha * rhosinAlpha * cos(rhoCosAlpha) - sinRhoCosAlpha) -
            rhosinAlpha * (rhosinAlpha - alpha * sinRhoCosAlpha)
          ) / (halfPi_RhoCosAlpha * halfPi_RhoCosAlpha));
      }
      r = rho + gingeryIntegrate(s_, rhoCosAlpha, x) * (pi - rho) / gingeryIntegrate(s_, rhoCosAlpha, pi);
      theta = theta0 + alpha;
      x = r * cos(theta);
      y = r * sin(theta);
    }
    return azimuthalEquidistantRaw.invert(x, y);
  };

  return forward;
}

function gingeryLength(alpha, k) {
  return function(x) {
    var y_ = alpha * cos(x);
    if (x < halfPi) y_ -= k;
    return sqrt(1 + y_ * y_);
  };
}

// Numerical integration: trapezoidal rule.
function gingeryIntegrate(f, a, b) {
  var n = 50,
      h = (b - a) / n,
      s = f(a) + f(b);
  for (var i = 1, x = a; i < n; ++i) s += 2 * f(x += h);
  return s * 0.5 * h;
}

export default function() {
  var n = 6,
      rho = 30 * radians,
      cRho = cos(rho),
      sRho = sin(rho),
      m = projectionMutator(gingeryRaw),
      p = m(rho, n),
      stream_ = p.stream,
      epsilon = 1e-2,
      cr = -cos(epsilon * radians),
      sr = sin(epsilon * radians);

  p.radius = function(_) {
    if (!arguments.length) return rho * degrees;
    cRho = cos(rho = _ * radians);
    sRho = sin(rho);
    return m(rho, n);
  };

  p.lobes = function(_) {
    if (!arguments.length) return n;
    return m(rho, n = +_);
  };

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (p.rotate([0, 0]), stream_(stream));
    p.rotate(rotate);
    rotateStream.sphere = function() {
      sphereStream.polygonStart(), sphereStream.lineStart();
      for (var i = 0, delta = 2 * pi / n, phi = 0; i < n; ++i, phi -= delta) {
        sphereStream.point(atan2(sr * cos(phi), cr) * degrees, asin(sr * sin(phi)) * degrees);
        sphereStream.point(atan2(sRho * cos(phi - delta / 2), cRho) * degrees, asin(sRho * sin(phi - delta / 2)) * degrees);
      }
      sphereStream.lineEnd(), sphereStream.polygonEnd();
    };
    return rotateStream;
  };

  return p
      .rotate([90, -40])
      .scale(91.7095)
      .clipAngle(180 - 1e-3);
}
