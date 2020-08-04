import {Operator} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Merge a collection of value arrays.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<Array<*>>} params.values - The input value arrrays.
 */
export default function MultiValues(params) {
  Operator.call(this, null, update, params);
}

inherits(MultiValues, Operator);

function update(_) {
  return (this.value && !_.modified())
    ? this.value
    : _.values.reduce(function(data, _) { return data.concat(_); }, []);
}
