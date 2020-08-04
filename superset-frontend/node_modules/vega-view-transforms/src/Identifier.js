import {Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';

var COUNTER_NAME = ':vega_identifier:';

/**
 * Adds a unique identifier to all added tuples.
 * This transform creates a new signal that serves as an id counter.
 * As a result, the id counter is shared across all instances of this
 * transform, generating unique ids across multiple data streams. In
 * addition, this signal value can be included in a snapshot of the
 * dataflow state, enabling correct resumption of id allocation.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {string} params.as - The field name for the generated identifier.
 */
export default function Identifier(params) {
  Transform.call(this, 0, params);
}

Identifier.Definition = {
  'type': 'Identifier',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'as', 'type': 'string', 'required': true }
  ]
};

var prototype = inherits(Identifier, Transform);

prototype.transform = function(_, pulse) {
  var counter = getCounter(pulse.dataflow),
      id = counter.value,
      as = _.as;

  pulse.visit(pulse.ADD, t => {
    if (!t[as]) t[as] = ++id;
  });

  counter.set(this.value = id);
  return pulse;
};

function getCounter(view) {
  var counter = view._signals[COUNTER_NAME];
  if (!counter) {
    view._signals[COUNTER_NAME] = (counter = view.add(0));
  }
  return counter;
}
