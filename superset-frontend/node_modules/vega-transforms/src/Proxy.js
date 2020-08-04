import {Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Proxy the value of another operator as a pure signal value.
 * Ensures no tuples are propagated.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {*} params.value - The value to proxy, becomes the value of this operator.
 */
export default function Proxy(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Proxy, Transform);

prototype.transform = function(_, pulse) {
  this.value = _.value;
  return _.modified('value')
    ? pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS)
    : pulse.StopPropagation;
};
