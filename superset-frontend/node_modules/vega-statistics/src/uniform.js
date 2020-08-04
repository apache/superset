import {random} from './random';

export function sampleUniform(min, max) {
  if (max == null) {
    max = (min == null ? 1 : min);
    min = 0;
  }
  return min + (max - min) * random();
}

export function densityUniform(value, min, max) {
  if (max == null) {
    max = (min == null ? 1 : min);
    min = 0;
  }
  return (value >= min && value <= max) ? 1 / (max - min) : 0;
}

export function cumulativeUniform(value, min, max) {
  if (max == null) {
    max = (min == null ? 1 : min);
    min = 0;
  }
  return value < min ? 0 : value > max ? 1 : (value - min) / (max - min);
}

export function quantileUniform(p, min, max) {
  if (max == null) {
    max = (min == null ? 1 : min);
    min = 0;
  }
  return (p >= 0 && p <= 1) ? min + p * (max - min) : NaN;
}

export default function(min, max) {
  var a, b,
      dist = {
        min: function(_) {
          if (arguments.length) {
            a = _ || 0;
            return dist;
          } else {
            return a;
          }
        },
        max: function(_) {
          if (arguments.length) {
            b = _ == null ? 1 : _;
            return dist;
          } else {
            return b;
          }
        },
        sample: () => sampleUniform(a, b),
        pdf: value => densityUniform(value, a, b),
        cdf: value => cumulativeUniform(value, a, b),
        icdf: p => quantileUniform(p, a, b)
      };

  if (max == null) {
    max = (min == null ? 1 : min);
    min = 0;
  }
  return dist.min(min).max(max);
}
