import {range, tickStep} from 'd3-array';
import {extent} from 'vega-util';

export default function(k, nice, zero) {
  return function(values) {
    var ex = extent(values),
        start = zero ? Math.min(ex[0], 0) : ex[0],
        stop = ex[1],
        span = stop - start,
        step = nice ? tickStep(start, stop, k) : (span / (k + 1));
    return range(step, stop, step);
  };
}
