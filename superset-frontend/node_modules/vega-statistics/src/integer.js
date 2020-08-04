import {random} from './random';

export default function(min, max) {
  if (max == null) {
    max = min;
    min = 0;
  }

  var dist = {},
      a, b, d;

  dist.min = function(_) {
    if (arguments.length) {
      a = _ || 0;
      d = b - a;
      return dist;
    } else {
      return a;
    }
  };

  dist.max = function(_) {
    if (arguments.length) {
      b = _ || 0;
      d = b - a;
      return dist;
    } else {
      return b;
    }
  };

  dist.sample = function() {
    return a + Math.floor(d * random());
  };

  dist.pdf = function(x) {
    return (x === Math.floor(x) && x >= a && x < b) ? 1 / d : 0;
  };

  dist.cdf = function(x) {
    var v = Math.floor(x);
    return v < a ? 0 : v >= b ? 1 : (v - a + 1) / d;
  };

  dist.icdf = function(p) {
    return (p >= 0 && p <= 1) ? a - 1 + Math.floor(p * d) : NaN;
  };

  return dist.min(min).max(max);
}
