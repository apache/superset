import {cumulativeNormal, quantileNormal, sampleNormal} from './normal';
import {SQRT2PI} from './constants';

export function sampleLogNormal(mean, stdev) {
  mean = mean || 0;
  stdev = stdev == null ? 1 : stdev;
  return Math.exp(mean + sampleNormal() * stdev);
}

export function densityLogNormal(value, mean, stdev) {
  if (value <= 0) return 0;
  mean = mean || 0;
  stdev = stdev == null ? 1 : stdev;
  const z = (Math.log(value) - mean) / stdev;
  return Math.exp(-0.5 * z * z) / (stdev * SQRT2PI * value);
}

export function cumulativeLogNormal(value, mean, stdev) {
  return cumulativeNormal(Math.log(value), mean, stdev);
}

export function quantileLogNormal(p, mean, stdev) {
  return Math.exp(quantileNormal(p, mean, stdev));
}

export default function(mean, stdev) {
  var mu,
      sigma,
      dist = {
        mean: function(_) {
          if (arguments.length) {
            mu = _ || 0;
            return dist;
          } else {
            return mu;
          }
        },
        stdev: function(_) {
          if (arguments.length) {
            sigma = _ == null ? 1 : _;
            return dist;
          } else {
            return sigma;
          }
        },
        sample: () => sampleLogNormal(mu, sigma),
        pdf: value => densityLogNormal(value, mu, sigma),
        cdf: value => cumulativeLogNormal(value, mu, sigma),
        icdf: p => quantileLogNormal(p, mu, sigma)
      };

  return dist.mean(mean).stdev(stdev);
}
