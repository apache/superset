import {SQRT2, SQRT2PI} from './constants';
import {random} from './random';

let nextSample = NaN;

export function sampleNormal(mean, stdev) {
  mean = mean || 0;
  stdev = stdev == null ? 1 : stdev;

  let x = 0, y = 0, rds, c;
  if (nextSample === nextSample) {
    x = nextSample;
    nextSample = NaN;
  } else {
    do {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      rds = x * x + y * y;
    } while (rds === 0 || rds > 1);
    c = Math.sqrt(-2 * Math.log(rds) / rds); // Box-Muller transform
    x *= c;
    nextSample = y * c;
  }
  return mean + x * stdev;
}

export function densityNormal(value, mean, stdev) {
  stdev = stdev == null ? 1 : stdev;
  const z = (value - (mean || 0)) / stdev;
  return Math.exp(-0.5 * z * z) / (stdev * SQRT2PI);
}

// Approximation from West (2009)
// Better Approximations to Cumulative Normal Functions
export function cumulativeNormal(value, mean, stdev) {
  mean = mean || 0;
  stdev = stdev == null ? 1 : stdev;

  let cd,
      z = (value - mean) / stdev,
      Z = Math.abs(z);

  if (Z > 37) {
    cd = 0;
  } else {
    let sum, exp = Math.exp(-Z * Z / 2);
    if (Z < 7.07106781186547) {
      sum = 3.52624965998911e-02 * Z + 0.700383064443688;
      sum = sum * Z + 6.37396220353165;
      sum = sum * Z + 33.912866078383;
      sum = sum * Z + 112.079291497871;
      sum = sum * Z + 221.213596169931;
      sum = sum * Z + 220.206867912376;
      cd = exp * sum;
      sum = 8.83883476483184e-02 * Z + 1.75566716318264;
      sum = sum * Z + 16.064177579207;
      sum = sum * Z + 86.7807322029461;
      sum = sum * Z + 296.564248779674;
      sum = sum * Z + 637.333633378831;
      sum = sum * Z + 793.826512519948;
      sum = sum * Z + 440.413735824752;
      cd = cd / sum;
    } else {
      sum = Z + 0.65;
      sum = Z + 4 / sum;
      sum = Z + 3 / sum;
      sum = Z + 2 / sum;
      sum = Z + 1 / sum;
      cd = exp / sum / 2.506628274631;
    }
  }
  return z > 0 ? 1 - cd : cd;
}

// Approximation of Probit function using inverse error function.
export function quantileNormal(p, mean, stdev) {
  if (p < 0 || p > 1) return NaN;
  return (mean || 0) + (stdev == null ? 1 : stdev) * SQRT2 * erfinv(2 * p - 1);
}

// Approximate inverse error function. Implementation from "Approximating
// the erfinv function" by Mike Giles, GPU Computing Gems, volume 2, 2010.
// Ported from Apache Commons Math, http://www.apache.org/licenses/LICENSE-2.0
function erfinv(x) {
  // beware that the logarithm argument must be
  // commputed as (1.0 - x) * (1.0 + x),
  // it must NOT be simplified as 1.0 - x * x as this
  // would induce rounding errors near the boundaries +/-1
  let w = - Math.log((1 - x) * (1 + x)), p;

  if (w < 6.25) {
      w -= 3.125;
      p =  -3.6444120640178196996e-21;
      p =   -1.685059138182016589e-19 + p * w;
      p =   1.2858480715256400167e-18 + p * w;
      p =    1.115787767802518096e-17 + p * w;
      p =   -1.333171662854620906e-16 + p * w;
      p =   2.0972767875968561637e-17 + p * w;
      p =   6.6376381343583238325e-15 + p * w;
      p =  -4.0545662729752068639e-14 + p * w;
      p =  -8.1519341976054721522e-14 + p * w;
      p =   2.6335093153082322977e-12 + p * w;
      p =  -1.2975133253453532498e-11 + p * w;
      p =  -5.4154120542946279317e-11 + p * w;
      p =    1.051212273321532285e-09 + p * w;
      p =  -4.1126339803469836976e-09 + p * w;
      p =  -2.9070369957882005086e-08 + p * w;
      p =   4.2347877827932403518e-07 + p * w;
      p =  -1.3654692000834678645e-06 + p * w;
      p =  -1.3882523362786468719e-05 + p * w;
      p =    0.0001867342080340571352 + p * w;
      p =  -0.00074070253416626697512 + p * w;
      p =   -0.0060336708714301490533 + p * w;
      p =      0.24015818242558961693 + p * w;
      p =       1.6536545626831027356 + p * w;
  } else if (w < 16.0) {
      w = Math.sqrt(w) - 3.25;
      p =   2.2137376921775787049e-09;
      p =   9.0756561938885390979e-08 + p * w;
      p =  -2.7517406297064545428e-07 + p * w;
      p =   1.8239629214389227755e-08 + p * w;
      p =   1.5027403968909827627e-06 + p * w;
      p =   -4.013867526981545969e-06 + p * w;
      p =   2.9234449089955446044e-06 + p * w;
      p =   1.2475304481671778723e-05 + p * w;
      p =  -4.7318229009055733981e-05 + p * w;
      p =   6.8284851459573175448e-05 + p * w;
      p =   2.4031110387097893999e-05 + p * w;
      p =   -0.0003550375203628474796 + p * w;
      p =   0.00095328937973738049703 + p * w;
      p =   -0.0016882755560235047313 + p * w;
      p =    0.0024914420961078508066 + p * w;
      p =   -0.0037512085075692412107 + p * w;
      p =     0.005370914553590063617 + p * w;
      p =       1.0052589676941592334 + p * w;
      p =       3.0838856104922207635 + p * w;
  } else if (Number.isFinite(w)) {
      w = Math.sqrt(w) - 5.0;
      p =  -2.7109920616438573243e-11;
      p =  -2.5556418169965252055e-10 + p * w;
      p =   1.5076572693500548083e-09 + p * w;
      p =  -3.7894654401267369937e-09 + p * w;
      p =   7.6157012080783393804e-09 + p * w;
      p =  -1.4960026627149240478e-08 + p * w;
      p =   2.9147953450901080826e-08 + p * w;
      p =  -6.7711997758452339498e-08 + p * w;
      p =   2.2900482228026654717e-07 + p * w;
      p =  -9.9298272942317002539e-07 + p * w;
      p =   4.5260625972231537039e-06 + p * w;
      p =  -1.9681778105531670567e-05 + p * w;
      p =   7.5995277030017761139e-05 + p * w;
      p =  -0.00021503011930044477347 + p * w;
      p =  -0.00013871931833623122026 + p * w;
      p =       1.0103004648645343977 + p * w;
      p =       4.8499064014085844221 + p * w;
  } else {
      p = Infinity;
  }

  return p * x;
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
        sample: () => sampleNormal(mu, sigma),
        pdf: value => densityNormal(value, mu, sigma),
        cdf: value => cumulativeNormal(value, mu, sigma),
        icdf: p => quantileNormal(p, mu, sigma)
      };

  return dist.mean(mean).stdev(stdev);
}
