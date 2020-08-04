import {Operator} from 'vega-dataflow';
import {inherits, key} from 'vega-util';

/**
 * Generates a key function.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<string>} params.fields - The field name(s) for the key function.
 * @param {boolean} params.flat - A boolean flag indicating if the field names
 *  should be treated as flat property names, side-stepping nested field
 *  lookups normally indicated by dot or bracket notation.
 */
export default function Key(params) {
  Operator.call(this, null, update, params);
}

inherits(Key, Operator);

function update(_) {
  return (this.value && !_.modified()) ? this.value : key(_.fields, _.flat);
}
