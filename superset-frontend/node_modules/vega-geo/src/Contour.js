import {Transform, ingest} from 'vega-dataflow';
import {inherits, isArray} from 'vega-util';
import {transform} from './Isocontour';
import {params} from './KDE2D';
import contours from './util/contours';
import density2D from './util/density2D';
import quantize from './util/quantize';

/**
 * Generate contours based on kernel-density estimation of point data.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<number>} params.size - The dimensions [width, height] over which to compute contours.
 *  If the values parameter is provided, this must be the dimensions of the input data.
 *  If density estimation is performed, this is the output view dimensions in pixels.
 * @param {Array<number>} [params.values] - An array of numeric values representing an
 *  width x height grid of values over which to compute contours. If unspecified, this
 *  transform will instead attempt to compute contours for the kernel density estimate
 *  using values drawn from data tuples in the input pulse.
 * @param {function(object): number} [params.x] - The pixel x-coordinate accessor for density estimation.
 * @param {function(object): number} [params.y] - The pixel y-coordinate accessor for density estimation.
 * @param {function(object): number} [params.weight] - The data point weight accessor for density estimation.
 * @param {number} [params.cellSize] - Contour density calculation cell size.
 * @param {number} [params.bandwidth] - Kernel density estimation bandwidth.
 * @param {Array<number>} [params.thresholds] - Contour threshold array. If
 *   this parameter is set, the count and nice parameters will be ignored.
 * @param {number} [params.count] - The desired number of contours.
 * @param {boolean} [params.nice] - Boolean flag indicating if the contour
 *   threshold values should be automatically aligned to "nice"
 *   human-friendly values. Setting this flag may cause the number of
 *   thresholds to deviate from the specified count.
 * @param {boolean} [params.smooth] - Boolean flag indicating if the contour
 *   polygons should be smoothed using linear interpolation. The default is
 *   true. The parameter is ignored when using density estimation.
 */
export default function Contour(params) {
  Transform.call(this, null, params);
}

Contour.Definition = {
  'type': 'Contour',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'size', 'type': 'number', 'array': true, 'length': 2, 'required': true },
    { 'name': 'values', 'type': 'number', 'array': true },
    { 'name': 'x', 'type': 'field' },
    { 'name': 'y', 'type': 'field' },
    { 'name': 'weight', 'type': 'field' },
    { 'name': 'cellSize', 'type': 'number' },
    { 'name': 'bandwidth', 'type': 'number' },
    { 'name': 'count', 'type': 'number' },
    { 'name': 'nice', 'type': 'boolean', 'default': false },
    { 'name': 'thresholds', 'type': 'number', 'array': true },
    { 'name': 'smooth', 'type': 'boolean', 'default': true }
  ]
};

var prototype = inherits(Contour, Transform);

prototype.transform = function(_, pulse) {
  if (this.value && !pulse.changed() && !_.modified()) {
    return pulse.StopPropagation;
  }

  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS),
      contour = contours().smooth(_.smooth !== false),
      values = _.values,
      thresh = _.thresholds || quantize(_.count || 10, _.nice, !!values),
      size = _.size, grid, post;

  if (!values) {
    values = pulse.materialize(pulse.SOURCE).source;
    grid = params(density2D(), _)(values, true);
    post = transform(grid, grid.scale || 1, grid.scale || 1, 0, 0);
    size = [grid.width, grid.height];
    values = grid.values;
  }

  thresh = isArray(thresh) ? thresh : thresh(values);
  values = contour.size(size)(values, thresh);
  if (post) values.forEach(post);

  if (this.value) out.rem = this.value;
  this.value = out.source = out.add = (values || []).map(ingest);

  return out;
};
