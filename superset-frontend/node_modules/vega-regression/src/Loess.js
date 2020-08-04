import partition from './partition';
import {regressionLoess} from 'vega-statistics';
import {Transform, ingest} from 'vega-dataflow';
import {accessorName, inherits} from 'vega-util';

/**
 * Compute locally-weighted regression fits for one or more data groups.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.x - An accessor for the predictor data field.
 * @param {function(object): *} params.y - An accessor for the predicted data field.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors to groupby.
 * @param {number} [params.bandwidth=0.3] - The loess bandwidth.
 */
export default function Loess(params) {
  Transform.call(this, null, params);
}

Loess.Definition = {
  'type': 'Loess',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'x', 'type': 'field', 'required': true },
    { 'name': 'y', 'type': 'field', 'required': true },
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'bandwidth', 'type': 'number', 'default': 0.3 },
    { 'name': 'as', 'type': 'string', 'array': true }
  ]
};

var prototype = inherits(Loess, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS);

  if (!this.value || pulse.changed() || _.modified()) {
    const source = pulse.materialize(pulse.SOURCE).source,
          groups = partition(source, _.groupby),
          names = (_.groupby || []).map(accessorName),
          m = names.length,
          as = _.as || [accessorName(_.x), accessorName(_.y)],
          values = [];

    groups.forEach(g => {
      regressionLoess(g, _.x, _.y, _.bandwidth || 0.3).forEach(p => {
        const t = {};
        for (let i=0; i<m; ++i) {
          t[names[i]] = g.dims[i];
        }
        t[as[0]] = p[0];
        t[as[1]] = p[1];
        values.push(ingest(t));
      });
    });

    if (this.value) out.rem = this.value;
    this.value = out.add = out.source = values;
  }

  return out;
};
