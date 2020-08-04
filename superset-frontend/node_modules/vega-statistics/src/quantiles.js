import numbers from './numbers';
import {ascending, quantileSorted} from 'd3-array';

export default function(array, p, f) {
  var values = Float64Array.from(numbers(array, f));

  // don't depend on return value from typed array sort call
  // protects against undefined sort results in Safari (vega/vega-lite#4964)
  values.sort(ascending);

  return p.map(_ => quantileSorted(values, _));
}
