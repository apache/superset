import {Operator} from 'vega-dataflow';
import {array, field, inherits, isArray} from 'vega-util';

/**
 * Generates one or more field accessor functions.
 * If the 'name' parameter is an array, an array of field accessors
 * will be created and the 'as' parameter will be ignored.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {string} params.name - The field name(s) to access.
 * @param {string} params.as - The accessor function name.
 */
export default function Field(params) {
  Operator.call(this, null, update, params);
}

inherits(Field, Operator);

function update(_) {
  return (this.value && !_.modified()) ? this.value
    : isArray(_.name) ? array(_.name).map(function(f) { return field(f); })
    : field(_.name, _.as);
}
