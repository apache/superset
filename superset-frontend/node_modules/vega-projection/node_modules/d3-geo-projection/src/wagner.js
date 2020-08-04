import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {acos, asin, atan2, cos, degrees, epsilon, halfPi, max, min, pi, radians, sin, sqrt, tan} from "./math.js";

function wagnerFormula(cx, cy, m1, m2, n) {
  function forward(lambda, phi) {
    var s = m1 * sin(m2 * phi),
        c0 = sqrt(1 - s * s),
        c1 = sqrt(2 / (1 + c0 * cos(lambda *= n)));
    return [
      cx * c0 * c1 * sin(lambda),
      cy * s * c1
    ];
  }

  forward.invert = function(x, y) {
    var t1 = x / cx,
        t2 = y / cy,
        p = sqrt(t1 * t1 + t2 * t2),
        c = 2 * asin(p / 2);
    return [
      atan2(x * tan(c), cx * p) / n,
      p && asin(y * sin(c) / (cy * m1 * p)) / m2
    ];
  };

  return forward;
}

export function wagnerRaw(poleline, parallels, inflation, ratio) {
  // 60 is always used as reference parallel
  var phi1 = pi / 3;

  // sanitizing the input values
  // poleline and parallels may approximate but never equal 0
  poleline = max(poleline, epsilon);
  parallels = max(parallels, epsilon);
  // poleline must be <= 90; parallels may approximate but never equal 180
  poleline = min(poleline, halfPi);
  parallels = min(parallels, pi - epsilon);
  // 0 <= inflation <= 99.999
  inflation = max(inflation, 0);
  inflation = min(inflation, 100 - epsilon);
  // ratio > 0.
  // sensible values, i.e. something that renders a map which still can be
  // recognized as world map, are e.g. 20 <= ratio <= 1000.
  ratio = max(ratio, epsilon);

  // convert values from boehm notation
  // areal inflation e.g. from 0 to 1 or 20 to 1.2:
  var vinflation = inflation/100 + 1;
  // axial ratio e.g. from 200 to 2:
  var vratio  = ratio / 100;
  // the other ones are a bit more complicated...
  var m2 = acos(vinflation * cos(phi1)) / phi1,
      m1 = sin(poleline) / sin(m2 * halfPi),
      n = parallels / pi,
      k = sqrt(vratio * sin(poleline / 2) / sin(parallels / 2)),
      cx = k / sqrt(n * m1 * m2),
      cy = 1 / (k * sqrt(n * m1 * m2));

  return wagnerFormula(cx, cy, m1, m2, n);
}

export default function wagner() {
  // default values generate wagner8
  var poleline = 65 * radians,
      parallels = 60 * radians,
      inflation = 20,
      ratio = 200,
      mutate = projectionMutator(wagnerRaw),
      projection = mutate(poleline, parallels, inflation, ratio);

  projection.poleline = function(_) {
    return arguments.length ? mutate(poleline = +_ * radians, parallels, inflation, ratio) : poleline * degrees;
  };

  projection.parallels = function(_) {
    return arguments.length ? mutate(poleline, parallels = +_ * radians, inflation, ratio) : parallels * degrees;
  };
  projection.inflation = function(_) {
    return arguments.length ? mutate(poleline, parallels, inflation = +_, ratio) : inflation;
  };
  projection.ratio = function(_) {
    return arguments.length ? mutate(poleline, parallels, inflation, ratio = +_) : ratio;
  };

  return projection
    .scale(163.775);
}

export function wagner7() {
  return wagner()
      .poleline(65)
      .parallels(60)
      .inflation(0)
      .ratio(200)
      .scale(172.633);
}
