import parseDist from './util/Distributions';
import {Transform, ingest} from 'vega-dataflow';
import {sampleCurve} from 'vega-statistics';
import {error, extent, inherits} from 'vega-util';

/**
 * Grid sample points for a probability density. Given a distribution and
 * a sampling extent, will generate points suitable for plotting either
 * PDF (probability density function) or CDF (cumulative distribution
 * function) curves.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {object} params.distribution - The probability distribution. This
 *   is an object parameter dependent on the distribution type.
 * @param {string} [params.method='pdf'] - The distribution method to sample.
 *   One of 'pdf' or 'cdf'.
 * @param {Array<number>} [params.extent] - The [min, max] extent over which
 *   to sample the distribution. This argument is required in most cases, but
 *   can be omitted if the distribution (e.g., 'kde') supports a 'data' method
 *   that returns numerical sample points from which the extent can be deduced.
 * @param {number} [params.minsteps=25] - The minimum number of curve samples
 *   for plotting the density.
 * @param {number} [params.maxsteps=200] - The maximum number of curve samples
 *   for plotting the density.
 * @param {number} [params.steps] - The exact number of curve samples for
 *   plotting the density. If specified, overrides both minsteps and maxsteps
 *   to set an exact number of uniform samples. Useful in conjunction with
 *   a fixed extent to ensure consistent sample points for stacked densities.
 */
export default function Density(params) {
  Transform.call(this, null, params);
}

var distributions = [
  {
    'key': {'function': 'normal'},
    'params': [
      { 'name': 'mean', 'type': 'number', 'default': 0 },
      { 'name': 'stdev', 'type': 'number', 'default': 1 }
    ]
  },
  {
    'key': {'function': 'lognormal'},
    'params': [
      { 'name': 'mean', 'type': 'number', 'default': 0 },
      { 'name': 'stdev', 'type': 'number', 'default': 1 }
    ]
  },
  {
    'key': {'function': 'uniform'},
    'params': [
      { 'name': 'min', 'type': 'number', 'default': 0 },
      { 'name': 'max', 'type': 'number', 'default': 1 }
    ]
  },
  {
    'key': {'function': 'kde'},
    'params': [
      { 'name': 'field', 'type': 'field', 'required': true },
      { 'name': 'from', 'type': 'data' },
      { 'name': 'bandwidth', 'type': 'number', 'default': 0 }
    ]
  }
];

var mixture = {
  'key': {'function': 'mixture'},
  'params': [
    { 'name': 'distributions', 'type': 'param', 'array': true,
      'params': distributions },
    { 'name': 'weights', 'type': 'number', 'array': true }
  ]
};

Density.Definition = {
  'type': 'Density',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'extent', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'steps', 'type': 'number' },
    { 'name': 'minsteps', 'type': 'number', 'default': 25 },
    { 'name': 'maxsteps', 'type': 'number', 'default': 200 },
    { 'name': 'method', 'type': 'string', 'default': 'pdf',
      'values': ['pdf', 'cdf'] },
    { 'name': 'distribution', 'type': 'param',
      'params': distributions.concat(mixture) },
    { 'name': 'as', 'type': 'string', 'array': true,
      'default': ['value', 'density'] }
  ]
};

var prototype = inherits(Density, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS);

  if (!this.value || pulse.changed() || _.modified()) {
    var dist = parseDist(_.distribution, source(pulse)),
        minsteps = _.steps || _.minsteps || 25,
        maxsteps = _.steps || _.maxsteps || 200,
        method = _.method || 'pdf';

    if (method !== 'pdf' && method !== 'cdf') {
      error('Invalid density method: ' + method);
    }
    if (!_.extent && !dist.data) {
      error('Missing density extent parameter.');
    }
    method = dist[method];

    var as = _.as || ['value', 'density'],
        domain = _.extent || extent(dist.data()),
        values = sampleCurve(method, domain, minsteps, maxsteps).map(v => {
          var tuple = {};
          tuple[as[0]] = v[0];
          tuple[as[1]] = v[1];
          return ingest(tuple);
        });

    if (this.value) out.rem = this.value;
    this.value = out.add = out.source = values;
  }

  return out;
};

function source(pulse) {
  return function() { return pulse.materialize(pulse.SOURCE).source; };
}
