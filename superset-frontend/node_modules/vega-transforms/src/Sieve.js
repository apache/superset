import {Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Propagates a new pulse without any tuples so long as the input
 * pulse contains some added, removed or modified tuples.
 * @param {object} params - The parameters for this operator.
 * @constructor
 */
export default function Sieve(params) {
  Transform.call(this, null, params);
  this.modified(true); // always treat as modified
}

var prototype = inherits(Sieve, Transform);

prototype.transform = function(_, pulse) {
  this.value = pulse.source;
  return pulse.changed()
    ? pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS)
    : pulse.StopPropagation;
};
