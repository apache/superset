import {Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Operator whose value is simply its parameter hash. This operator is
 * useful for enabling reactive updates to values of nested objects.
 * @constructor
 * @param {object} params - The parameters for this operator.
 */
export default function Params(params) {
  Transform.call(this, null, params);
}

inherits(Params, Transform);

Params.prototype.transform = function(_, pulse) {
  this.modified(_.modified());
  this.value = _;
  return pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS); // do not pass tuples
};
