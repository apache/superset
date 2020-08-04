import {Transform} from 'vega-dataflow';
import {getProjectionPath} from 'vega-projection';
import {field, inherits} from 'vega-util';

/**
 * Annotate items with a geopath shape generator.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(number, number): *} params.projection - The cartographic
 *   projection to apply.
 * @param {function(object): *} [params.field] - The field with GeoJSON data,
 *   or null if the tuple itself is a GeoJSON feature.
 * @param {string} [params.as='shape'] - The output field in which to store
 *   the generated path data (default 'shape').
 */
export default function GeoShape(params) {
  Transform.call(this, null, params);
}

GeoShape.Definition = {
  'type': 'GeoShape',
  'metadata': {'modifies': true, 'nomod': true},
  'params': [
    { 'name': 'projection', 'type': 'projection' },
    { 'name': 'field', 'type': 'field', 'default': 'datum' },
    { 'name': 'pointRadius', 'type': 'number', 'expr': true },
    { 'name': 'as', 'type': 'string', 'default': 'shape' }
  ]
};

var prototype = inherits(GeoShape, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.ALL),
      shape = this.value,
      as = _.as || 'shape',
      flag = out.ADD;

  if (!shape || _.modified()) {
    // parameters updated, reset and reflow
    this.value = shape = shapeGenerator(
      getProjectionPath(_.projection),
      _.field || field('datum'),
      _.pointRadius
    );
    out.materialize().reflow();
    flag = out.SOURCE;
  }

  out.visit(flag, function(t) { t[as] = shape; });

  return out.modifies(as);
};

function shapeGenerator(path, field, pointRadius) {
  var shape = pointRadius == null
    ? function(_) { return path(field(_)); }
    : function(_) {
      var prev = path.pointRadius(),
          value = path.pointRadius(pointRadius)(field(_));
      path.pointRadius(prev);
      return value;
    };
  shape.context = function(_) {
    path.context(_);
    return shape;
  };

  return shape;
}
