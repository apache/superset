import {Operator} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Computes global min/max extents over a collection of extents.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<Array<number>>} params.extents - The input extents.
 */
export default function MultiExtent(params) {
  Operator.call(this, null, update, params);
}

inherits(MultiExtent, Operator);

function update(_) {
  if (this.value && !_.modified()) {
    return this.value;
  }

  var min = +Infinity,
      max = -Infinity,
      ext = _.extents,
      i, n, e;

  for (i=0, n=ext.length; i<n; ++i) {
    e = ext[i];
    if (e[0] < min) min = e[0];
    if (e[1] > max) max = e[1];
  }
  return [min, max];
}
