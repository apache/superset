import {Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Invokes a function for each data tuple and saves the results as a new field.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.expr - The formula function to invoke for each tuple.
 * @param {string} params.as - The field name under which to save the result.
 * @param {boolean} [params.initonly=false] - If true, the formula is applied to
 *   added tuples only, and does not update in response to modifications.
 */
export default function Formula(params) {
  Transform.call(this, null, params);
}

Formula.Definition = {
  'type': 'Formula',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'expr', 'type': 'expr', 'required': true },
    { 'name': 'as', 'type': 'string', 'required': true },
    { 'name': 'initonly', 'type': 'boolean' }
  ]
};

var prototype = inherits(Formula, Transform);

prototype.transform = function(_, pulse) {
  var func = _.expr,
      as = _.as,
      mod = _.modified(),
      flag = _.initonly ? pulse.ADD
        : mod ? pulse.SOURCE
        : pulse.modified(func.fields) || pulse.modified(as) ? pulse.ADD_MOD
        : pulse.ADD;

  if (mod) {
    // parameters updated, need to reflow
    pulse = pulse.materialize().reflow(true);
  }

  if (!_.initonly) {
    pulse.modifies(as);
  }

  return pulse.visit(flag, t => t[as] = func(t, _));
};
