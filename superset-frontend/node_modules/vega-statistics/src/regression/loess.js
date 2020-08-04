import ols from './ols';
import {points} from './points';
import {median} from 'd3-array';

const maxiters = 2,
      epsilon = 1e-12;

// Adapted from science.js by Jason Davies
// Source: https://github.com/jasondavies/science.js/blob/master/src/stats/loess.js
// License: https://github.com/jasondavies/science.js/blob/master/LICENSE
export default function(data, x, y, bandwidth) {
  const [xv, yv, ux, uy] = points(data, x, y, true),
        n = xv.length,
        bw = Math.max(2, ~~(bandwidth * n)), // # nearest neighbors
        yhat = new Float64Array(n),
        residuals = new Float64Array(n),
        robustWeights = new Float64Array(n).fill(1);

  for (let iter = -1; ++iter <= maxiters; ) {
    const interval = [0, bw - 1];

    for (let i = 0; i < n; ++i) {
      const dx = xv[i],
            i0 = interval[0],
            i1 = interval[1],
            edge = (dx - xv[i0]) > (xv[i1] - dx) ? i0 : i1;

      let W = 0, X = 0, Y = 0, XY = 0, X2 = 0,
          denom = 1 / Math.abs(xv[edge] - dx || 1); // avoid singularity!

      for (let k = i0; k <= i1; ++k) {
        const xk = xv[k],
              yk = yv[k],
              w = tricube(Math.abs(dx - xk) * denom) * robustWeights[k],
              xkw = xk * w;

        W += w;
        X += xkw;
        Y += yk * w;
        XY += yk * xkw;
        X2 += xk * xkw;
      }

      // linear regression fit
      const [a, b] = ols(X / W, Y / W, XY / W, X2 / W);
      yhat[i] = a + b * dx;
      residuals[i] = Math.abs(yv[i] - yhat[i]);

      updateInterval(xv, i + 1, interval);
    }

    if (iter === maxiters) {
      break;
    }

    const medianResidual = median(residuals);
    if (Math.abs(medianResidual) < epsilon) break;

    for (let i = 0, arg, w; i < n; ++i){
      arg = residuals[i] / (6 * medianResidual);
      // default to epsilon (rather than zero) for large deviations
      // keeping weights tiny but non-zero prevents singularites
      robustWeights[i] = (arg >= 1) ? epsilon : ((w = 1 - arg * arg) * w);
    }
  }

  return output(xv, yhat, ux, uy);
}

// weighting kernel for local regression
function tricube(x) {
  return (x = 1 - x * x * x) * x * x;
}

// advance sliding window interval of nearest neighbors
function updateInterval(xv, i, interval) {
  let val = xv[i],
      left = interval[0],
      right = interval[1] + 1;

  if (right >= xv.length) return;

  // step right if distance to new right edge is <= distance to old left edge
  // step when distance is equal to ensure movement over duplicate x values
  while (i > left && (xv[right] - val) <= (val - xv[left])) {
    interval[0] = ++left;
    interval[1] = right;
    ++right;
  }
}

// generate smoothed output points
// average points with repeated x values
function output(xv, yhat, ux, uy) {
  const n = xv.length, out = [];
  let i = 0, cnt = 0, prev = [], v;

  for (; i<n; ++i) {
    v = xv[i] + ux;
    if (prev[0] === v) {
      // average output values via online update
      prev[1] += (yhat[i] - prev[1]) / (++cnt);
    } else {
      // add new output point
      cnt = 0;
      prev[1] += uy;
      prev = [v, yhat[i]];
      out.push(prev);
    }
  }
  prev[1] += uy;

  return out;
}
