import {Transform, ingest} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Generates data tuples using a provided generator function.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(Parameters): object} params.generator - A tuple generator
 *   function. This function is given the operator parameters as input.
 *   Changes to any additional parameters will not trigger re-calculation
 *   of previously generated tuples. Only future tuples are affected.
 * @param {number} params.size - The number of tuples to produce.
 */
export default function Generate(params) {
  Transform.call(this, [], params);
}

var prototype = inherits(Generate, Transform);

prototype.transform = function(_, pulse) {
  var data = this.value,
      out = pulse.fork(pulse.ALL),
      num = _.size - data.length,
      gen = _.generator,
      add, rem, t;

  if (num > 0) {
    // need more tuples, generate and add
    for (add=[]; --num >= 0;) {
      add.push(t = ingest(gen(_)));
      data.push(t);
    }
    out.add = out.add.length
      ? out.materialize(out.ADD).add.concat(add)
      : add;
  } else {
    // need fewer tuples, remove
    rem = data.slice(0, -num);
    out.rem = out.rem.length
      ? out.materialize(out.REM).rem.concat(rem)
      : rem;
    data = data.slice(-num);
  }

  out.source = this.value = data;
  return out;
};
