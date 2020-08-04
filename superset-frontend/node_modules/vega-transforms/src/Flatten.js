import {fieldNames} from './util/util';
import {Transform, derive} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Flattens array-typed field values into new data objects.
 * If multiple fields are specified, they are treated as parallel arrays,
 * with output values included for each matching index (or null if missing).
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<function(object): *>} params.fields - An array of field
 *   accessors for the tuple fields that should be flattened.
 * @param {string} [params.index] - Optional output field name for index
 *   value. If unspecified, no index field is included in the output.
 * @param {Array<string>} [params.as] - Output field names for flattened
 *   array fields. Any unspecified fields will use the field name provided
 *   by the fields accessors.
 */
export default function Flatten(params) {
  Transform.call(this, [], params);
}

Flatten.Definition = {
  'type': 'Flatten',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'fields', 'type': 'field', 'array': true, 'required': true },
    { 'name': 'index', 'type': 'string' },
    { 'name': 'as', 'type': 'string', 'array': true }
  ]
};

var prototype = inherits(Flatten, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE),
      fields = _.fields,
      as = fieldNames(fields, _.as || []),
      index = _.index || null,
      m = as.length;

  // remove any previous results
  out.rem = this.value;

  // generate flattened tuples
  pulse.visit(pulse.SOURCE, function(t) {
    var arrays = fields.map(f => f(t)),
        maxlen = arrays.reduce((l, a) => Math.max(l, a.length), 0),
        i = 0, j, d, v;

    for (; i<maxlen; ++i) {
      d = derive(t);
      for (j=0; j<m; ++j) {
        d[as[j]] = (v = arrays[j][i]) == null ? null : v;
      }
      if (index) {
        d[index] = i;
      }
      out.add.push(d);
    }
  });

  this.value = out.source = out.add;
  if (index) out.modifies(index);
  return out.modifies(as);
};
