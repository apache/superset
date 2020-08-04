import boundStroke from '../bound/boundStroke';
import {rectangle} from '../path/shapes';
import {intersectRect} from '../util/intersect';
import {drawAll} from '../util/canvas/draw';
import {pickPath} from '../util/canvas/pick';

function attr(emit, item) {
  emit('d', rectangle(null, item));
}

function bound(bounds, item) {
  var x, y;
  return boundStroke(bounds.set(
    x = item.x || 0,
    y = item.y || 0,
    (x + item.width) || 0,
    (y + item.height) || 0
  ), item);
}

function draw(context, item) {
  context.beginPath();
  rectangle(context, item);
}

export default {
  type:   'rect',
  tag:    'path',
  nested: false,
  attr:   attr,
  bound:  bound,
  draw:   drawAll(draw),
  pick:   pickPath(draw),
  isect:  intersectRect
};
