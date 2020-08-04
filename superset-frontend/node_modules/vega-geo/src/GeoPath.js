import {Transform} from 'vega-dataflow';
import {getProjectionPath} from 'vega-projection';
import {identity, inherits} from 'vega-util';

/**
 * Map GeoJSON data to an SVG path string.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(number, number): *} params.projection - The cartographic
 *   projection to apply.
 * @param {function(object): *} [params.field] - The field with GeoJSON data,
 *   or null if the tuple itself is a GeoJSON feature.
 * @param {string} [params.as='path'] - The output field in which to store
 *   the generated path data (default 'path').
 */
export default function GeoPath(params) {
  Transform.call(this, null, params);
}

GeoPath.Definition = {
  'type': 'GeoPath',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'projection', 'type': 'projection' },
    { 'name': 'field', 'type': 'field' },
    { 'name': 'pointRadius', 'type': 'number', 'expr': true },
    { 'name': 'as', 'type': 'string', 'default': 'path' }
  ]
};

var prototype = inherits(GeoPath, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.ALL),
      path = this.value,
      field = _.field || identity,
      as = _.as || 'path',
      flag = out.SOURCE;

  function set(t) { t[as] = path(field(t)); }

  if (!path || _.modified()) {
    // parameters updated, reset and reflow
    this.value = path = getProjectionPath(_.projection);
    out.materialize().reflow();
  } else {
    flag = field === identity || pulse.modified(field.fields)
      ? out.ADD_MOD
      : out.ADD;
  }

  var prev = initPath(path, _.pointRadius);
  out.visit(flag, set);
  path.pointRadius(prev);

  return out.modifies(as);
};

function initPath(path, pointRadius) {
  var prev = path.pointRadius();
  path.context(null);
  if (pointRadius != null) {
    path.pointRadius(pointRadius);
  }
  return prev;
}
