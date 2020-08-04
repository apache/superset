import {max} from 'd3-array';
import {rgb} from 'd3-color';
import {canvas} from 'vega-canvas';
import {Transform} from 'vega-dataflow';
import {
  accessorFields, constant, extend, identity,
  inherits, isFunction, toSet, zero
} from 'vega-util';

/**
 * Render a heatmap image for input raster grid data.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} [params.field] - The field with raster grid
 *   data. If unspecified, the tuple itself is interpreted as a raster grid.
 * @param {string} [params.color] - A constant color value or function for
 *   individual pixel color. If a function, it will be invoked with an input
 *   object that includes $x, $y, $value, and $max fields for the grid.
 * @param {number} [params.opacity] - A constant opacity value or function for
 *   individual pixel opacity. If a function, it will be invoked with an input
 *   object that includes $x, $y, $value, and $max fields for the grid.
 * @param {string} [params.resolve] - The method for resolving maximum values
 *   across multiple input grids. If 'independent' (the default), maximum
 *   calculation will be performed separately for each grid. If 'shared',
 *   a single global maximum will be used for all input grids.
 * @param {string} [params.as='image'] - The output field in which to store
 *   the generated bitmap canvas images (default 'image').
 */
export default function Heatmap(params) {
  Transform.call(this, null, params);
}

Heatmap.Definition = {
  'type': 'heatmap',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'field', 'type': 'field' },
    { 'name': 'color', 'type': 'string', 'expr': true},
    { 'name': 'opacity', 'type': 'number', 'expr': true},
    { 'name': 'resolve', 'type': 'enum', 'values': ['shared', 'independent'], 'default': 'independent' },
    { 'name': 'as', 'type': 'string', 'default': 'image' }
  ]
};

var prototype = inherits(Heatmap, Transform);

prototype.transform = function(_, pulse) {
  if (!pulse.changed() && !_.modified()) {
    return pulse.StopPropagation;
  }

  var source = pulse.materialize(pulse.SOURCE).source,
      shared = _.resolve === 'shared',
      field = _.field || identity,
      opacity = opacity_(_.opacity, _),
      color = color_(_.color, _),
      as = _.as || 'image',
      obj = {
        $x: 0, $y: 0, $value: 0,
        $max: shared ? max(source.map(t => max(field(t).values))) : 0
      };

  source.forEach(t => {
    const v = field(t);

    // build proxy data object
    const o = extend({}, t, obj);
    // set maximum value if not globally shared
    if (!shared) o.$max = max(v.values || []);

    // generate canvas image
    // optimize color/opacity if not pixel-dependent
    t[as] = toCanvas(v, o,
      color.dep ? color : constant(color(o)),
      opacity.dep ? opacity : constant(opacity(o))
    );
  });

  return pulse.reflow(true).modifies(as);
};

// get image color function
function color_(color, _) {
  let f;
  if (isFunction(color)) {
    f = obj => rgb(color(obj, _));
    f.dep = dependency(color);
  } else {
    // default to mid-grey
    f = constant(rgb(color || '#888'));
  }
  return f;
}

// get image opacity function
function opacity_(opacity, _) {
  let f;
  if (isFunction(opacity)) {
    f = obj => opacity(obj, _);
    f.dep = dependency(opacity);
  } else if (opacity) {
    f = constant(opacity);
  } else {
    // default to [0, max] opacity gradient
    f = obj => (obj.$value / obj.$max) || 0;
    f.dep = true;
  }
  return f;
}

// check if function depends on individual pixel data
function dependency(f) {
  if (!isFunction(f)) return false;
  const set = toSet(accessorFields(f));
  return set.$x || set.$y || set.$value || set.$max;
}

// render raster grid to canvas
function toCanvas(grid, obj, color, opacity) {
  const n = grid.width,
        m = grid.height,
        x1 = grid.x1 || 0,
        y1 = grid.y1 || 0,
        x2 = grid.x2 || n,
        y2 = grid.y2 || m,
        val = grid.values,
        value = val ? i => val[i] : zero,
        can = canvas(x2 - x1, y2 - y1),
        ctx = can.getContext('2d'),
        img = ctx.getImageData(0, 0, x2 - x1, y2 - y1),
        pix = img.data;

  for (let j=y1, k=0; j<y2; ++j) {
    obj.$y = j - y1;
    for (let i=x1, r=j*n; i<x2; ++i, k+=4) {
      obj.$x = i - x1;
      obj.$value = value(i + r);

      const v = color(obj);
      pix[k+0] = v.r;
      pix[k+1] = v.g;
      pix[k+2] = v.b;
      pix[k+3] = ~~(255 * opacity(obj));
    }
  }

  ctx.putImageData(img, 0, 0);
  return can;
}
