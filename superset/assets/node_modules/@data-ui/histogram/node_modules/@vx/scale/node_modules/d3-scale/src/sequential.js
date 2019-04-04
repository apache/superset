import {identity} from "./continuous";
import {initInterpolator} from "./init";
import {linearish} from "./linear";
import {loggish} from "./log";
import {symlogish} from "./symlog";
import {powish} from "./pow";

function transformer() {
  var x0 = 0,
      x1 = 1,
      t0,
      t1,
      k10,
      transform,
      interpolator = identity,
      clamp = false,
      unknown;

  function scale(x) {
    return isNaN(x = +x) ? unknown : interpolator(k10 === 0 ? 0.5 : (x = (transform(x) - t0) * k10, clamp ? Math.max(0, Math.min(1, x)) : x));
  }

  scale.domain = function(_) {
    return arguments.length ? (t0 = transform(x0 = +_[0]), t1 = transform(x1 = +_[1]), k10 = t0 === t1 ? 0 : 1 / (t1 - t0), scale) : [x0, x1];
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = !!_, scale) : clamp;
  };

  scale.interpolator = function(_) {
    return arguments.length ? (interpolator = _, scale) : interpolator;
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t) {
    transform = t, t0 = t(x0), t1 = t(x1), k10 = t0 === t1 ? 0 : 1 / (t1 - t0);
    return scale;
  };
}

export function copy(source, target) {
  return target
      .domain(source.domain())
      .interpolator(source.interpolator())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

export default function sequential() {
  var scale = linearish(transformer()(identity));

  scale.copy = function() {
    return copy(scale, sequential());
  };

  return initInterpolator.apply(scale, arguments);
}

export function sequentialLog() {
  var scale = loggish(transformer()).domain([1, 10]);

  scale.copy = function() {
    return copy(scale, sequentialLog()).base(scale.base());
  };

  return initInterpolator.apply(scale, arguments);
}

export function sequentialSymlog() {
  var scale = symlogish(transformer());

  scale.copy = function() {
    return copy(scale, sequentialSymlog()).constant(scale.constant());
  };

  return initInterpolator.apply(scale, arguments);
}

export function sequentialPow() {
  var scale = powish(transformer());

  scale.copy = function() {
    return copy(scale, sequentialPow()).exponent(scale.exponent());
  };

  return initInterpolator.apply(scale, arguments);
}

export function sequentialSqrt() {
  return sequentialPow.apply(null, arguments).exponent(0.5);
}
