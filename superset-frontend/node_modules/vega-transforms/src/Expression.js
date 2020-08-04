import {Operator} from 'vega-dataflow';
import {accessor, accessorFields, accessorName, inherits} from 'vega-util';

/**
 * Wraps an expression function with access to external parameters.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function} params.expr - The expression function. The
 *  function should accept both a datum and a parameter object.
 *  This operator's value will be a new function that wraps the
 *  expression function with access to this operator's parameters.
 */
export default function Expression(params) {
  Operator.call(this, null, update, params);
  this.modified(true);
}

inherits(Expression, Operator);

function update(_) {
  var expr = _.expr;
  return this.value && !_.modified('expr')
    ? this.value
    : accessor(
        datum => expr(datum, _),
        accessorFields(expr),
        accessorName(expr)
      );
}
