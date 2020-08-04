import {Transform, ingest} from 'vega-dataflow';
import {inherits} from 'vega-util';
import {range} from 'd3-array';

/**
 * Generates data tuples for a specified sequence range of numbers.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {number} params.start - The first number in the sequence.
 * @param {number} params.stop - The last number (exclusive) in the sequence.
 * @param {number} [params.step=1] - The step size between numbers in the sequence.
 */
export default function Sequence(params) {
  Transform.call(this, null, params);
}

Sequence.Definition = {
  'type': 'Sequence',
  'metadata': {'generates': true, 'changes': true},
  'params': [
    { 'name': 'start', 'type': 'number', 'required': true },
    { 'name': 'stop', 'type': 'number', 'required': true },
    { 'name': 'step', 'type': 'number', 'default': 1 },
    { 'name': 'as', 'type': 'string', 'default': 'data' }
  ]
};

var prototype = inherits(Sequence, Transform);

prototype.transform = function(_, pulse) {
  if (this.value && !_.modified()) return;

  var out = pulse.materialize().fork(pulse.MOD),
      as = _.as || 'data';

  out.rem = this.value ? pulse.rem.concat(this.value) : pulse.rem;

  this.value = range(_.start, _.stop, _.step || 1).map(function(v) {
    var t = {};
    t[as] = v;
    return ingest(t);
  });

  out.add = pulse.add.concat(this.value);

  return out;
};
