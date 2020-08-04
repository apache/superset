import {partition} from './util/util';
import {Transform, ingest} from 'vega-dataflow';
import {quantiles} from 'vega-statistics';
import {accessorName, inherits} from 'vega-util';
import {range} from 'd3-array';

/**
 * Generates sample quantile values from an input data stream.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - An accessor for the data field
 *   over which to calculate quantile values.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors
 *   to groupby.
 * @param {Array<number>} [params.probs] - An array of probabilities in
 *   the range (0, 1) for which to compute quantile values. If not specified,
 *   the *step* parameter will be used.
 * @param {Array<number>} [params.step=0.01] - A probability step size for
 *   sampling quantile values. All values from one-half the step size up to
 *   1 (exclusive) will be sampled. This parameter is only used if the
 *   *quantiles* parameter is not provided.
 */
export default function Quantile(params) {
  Transform.call(this, null, params);
}

Quantile.Definition = {
  'type': 'Quantile',
  'metadata': {'generates': true, 'changes': true},
  'params': [
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'field', 'type': 'field', 'required': true },
    { 'name': 'probs', 'type': 'number', 'array': true },
    { 'name': 'step', 'type': 'number', 'default': 0.01 },
    { 'name': 'as', 'type': 'string', 'array': true, 'default': ['prob', 'value'] }
  ]
};

var prototype = inherits(Quantile, Transform);

var EPSILON = 1e-14;

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS),
      as = _.as || ['prob', 'value'];

  if (this.value && !_.modified() && !pulse.changed()) {
    out.source = this.value;
    return out;
  }

  const source = pulse.materialize(pulse.SOURCE).source,
        groups = partition(source, _.groupby, _.field),
        names = (_.groupby || []).map(accessorName),
        values = [],
        step = _.step || 0.01,
        p = _.probs || range(step/2, 1 - EPSILON, step),
        n = p.length;

  groups.forEach(g => {
    const q = quantiles(g, p);

    for (let i=0; i<n; ++i) {
      const t = {};
      for (let i=0; i<names.length; ++i) {
        t[names[i]] = g.dims[i];
      }
      t[as[0]] = p[i];
      t[as[1]] = q[i];
      values.push(ingest(t));
    }
  });

  if (this.value) out.rem = this.value;
  this.value = out.add = out.source = values;

  return out;
};
