import quartiles from './quartiles';
import {deviation} from 'd3-array';

// Scott, D. W. (1992) Multivariate Density Estimation:
// Theory, Practice, and Visualization. Wiley.
export default function(array, f) {
  var n = array.length,
      v = deviation(array, f),
      q = quartiles(array, f),
      h = (q[2] - q[0]) / 1.34;

  v = Math.min(v, h) || v || Math.abs(q[0]) || 1;

  return 1.06 * v * Math.pow(n, -0.2);
}
