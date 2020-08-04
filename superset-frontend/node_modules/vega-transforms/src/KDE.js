import {partition} from './util/util';
import {randomKDE} from 'vega-statistics';
import {Transform, ingest} from 'vega-dataflow';
import {sampleCurve} from 'vega-statistics';
import {accessorName, error, extent, inherits} from 'vega-util';

/**
 * Compute kernel density estimates (KDE) for one or more data groups.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors
 *   to groupby.
 * @param {function(object): *} params.field - An accessor for the data field
 *   to estimate.
 * @param {number} [params.bandwidth=0] - The KDE kernel bandwidth.
 *   If zero or unspecified, the bandwidth is automatically determined.
 * @param {boolean} [params.counts=false] - A boolean flag indicating if the
 *   output values should be probability estimates (false, default) or
 *   smoothed counts (true).
 * @param {string} [params.cumulative=false] - A boolean flag indicating if a
 *   density (false) or cumulative distribution (true) should be generated.
 * @param {Array<number>} [params.extent] - The domain extent over which to
 *   plot the density. If unspecified, the [min, max] data extent is used.
 * @param {string} [params.resolve='independent'] - Indicates how parameters for
 *   multiple densities should be resolved. If "independent" (the default), each
 *   density may have its own domain extent and dynamic number of curve sample
 *   steps. If "shared", the KDE transform will ensure that all densities are
 *   defined over a shared domain and curve steps, enabling stacking.
 * @param {number} [params.minsteps=25] - The minimum number of curve samples
 *   for plotting the density.
 * @param {number} [params.maxsteps=200] - The maximum number of curve samples
 *   for plotting the density.
 * @param {number} [params.steps] - The exact number of curve samples for
 *   plotting the density. If specified, overrides both minsteps and maxsteps
 *   to set an exact number of uniform samples. Useful in conjunction with
 *   a fixed extent to ensure consistent sample points for stacked densities.
 */
export default function KDE(params) {
  Transform.call(this, null, params);
}

KDE.Definition = {
  'type': 'KDE',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'field', 'type': 'field', 'required': true },
    { 'name': 'cumulative', 'type': 'boolean', 'default': false },
    { 'name': 'counts', 'type': 'boolean', 'default': false },
    { 'name': 'bandwidth', 'type': 'number', 'default': 0 },
    { 'name': 'extent', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'resolve', 'type': 'enum', 'values': ['shared', 'independent'], 'default': 'independent' },
    { 'name': 'steps', 'type': 'number' },
    { 'name': 'minsteps', 'type': 'number', 'default': 25 },
    { 'name': 'maxsteps', 'type': 'number', 'default': 200 },
    { 'name': 'as', 'type': 'string', 'array': true, 'default': ['value', 'density'] }
  ]
};

var prototype = inherits(KDE, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS);

  if (!this.value || pulse.changed() || _.modified()) {
    const source = pulse.materialize(pulse.SOURCE).source,
          groups = partition(source, _.groupby, _.field),
          names = (_.groupby || []).map(accessorName),
          bandwidth = _.bandwidth,
          method = _.cumulative ? 'cdf' : 'pdf',
          as = _.as || ['value', 'density'],
          values = [];

    let domain = _.extent,
        minsteps = _.steps || _.minsteps || 25,
        maxsteps = _.steps || _.maxsteps || 200;

    if (method !== 'pdf' && method !== 'cdf') {
      error('Invalid density method: ' + method);
    }

    if (_.resolve === 'shared') {
      if (!domain) domain = extent(source, _.field);
      minsteps = maxsteps = _.steps || maxsteps;
    }

    groups.forEach(g => {
      const density = randomKDE(g, bandwidth)[method],
            scale = _.counts ? g.length : 1,
            local = domain || extent(g);

      sampleCurve(density, local, minsteps, maxsteps).forEach(v => {
        const t = {};
        for (let i=0; i<names.length; ++i) {
          t[names[i]] = g.dims[i];
        }
        t[as[0]] = v[0];
        t[as[1]] = v[1] * scale;
        values.push(ingest(t));
      });
    });

    if (this.value) out.rem = this.value;
    this.value = out.add = out.source = values;
  }

  return out;
};
