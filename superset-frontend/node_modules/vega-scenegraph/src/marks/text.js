import Bounds from '../Bounds';
import {DegToRad, HalfPi} from '../util/constants';
import {font, lineHeight, offset, textLines, textMetrics, textValue} from '../util/text';
import {intersectBoxLine} from '../util/intersect';
import {visit} from '../util/visit';
import blend from '../util/canvas/blend';
import fill from '../util/canvas/fill';
import {pick} from '../util/canvas/pick';
import stroke from '../util/canvas/stroke';
import {rotate, translate} from '../util/svg/transform';
import {isArray} from 'vega-util';

var textAlign = {
  'left':   'start',
  'center': 'middle',
  'right':  'end'
};

var tempBounds = new Bounds();

function anchorPoint(item) {
  var x = item.x || 0,
      y = item.y || 0,
      r = item.radius || 0, t;

  if (r) {
    t = (item.theta || 0) - HalfPi;
    x += r * Math.cos(t);
    y += r * Math.sin(t);
  }

  tempBounds.x1 = x;
  tempBounds.y1 = y;
  return tempBounds;
}

function attr(emit, item) {
  var dx = item.dx || 0,
      dy = (item.dy || 0) + offset(item),
      p = anchorPoint(item),
      x = p.x1,
      y = p.y1,
      a = item.angle || 0, t;

  emit('text-anchor', textAlign[item.align] || 'start');

  if (a) {
    t = translate(x, y) + ' ' + rotate(a);
    if (dx || dy) t += ' ' + translate(dx, dy);
  } else {
    t = translate(x + dx, y + dy);
  }
  emit('transform', t);
}

function bound(bounds, item, mode) {
  var h = textMetrics.height(item),
      a = item.align,
      p = anchorPoint(item),
      x = p.x1,
      y = p.y1,
      dx = item.dx || 0,
      dy = (item.dy || 0) + offset(item) - Math.round(0.8*h), // use 4/5 offset
      tl = textLines(item),
      w;

  // get dimensions
  if (isArray(tl)) {
    // multi-line text
    h += lineHeight(item) * (tl.length - 1);
    w = tl.reduce((w, t) => Math.max(w, textMetrics.width(item, t)), 0);
  } else {
    // single-line text
    w = textMetrics.width(item, tl);
  }

  // horizontal alignment
  if (a === 'center') {
    dx -= (w / 2);
  } else if (a === 'right') {
    dx -= w;
  } else {
    // left by default, do nothing
  }

  bounds.set(dx+=x, dy+=y, dx+w, dy+h);

  if (item.angle && !mode) {
    bounds.rotate(item.angle * DegToRad, x, y);
  } else if (mode === 2) {
    return bounds.rotatedPoints(item.angle * DegToRad, x, y);
  }
  return bounds;
}

function draw(context, scene, bounds) {
  visit(scene, function(item) {
    var opacity = item.opacity == null ? 1 : item.opacity,
        p, x, y, i, lh, tl, str;

    if (bounds && !bounds.intersects(item.bounds) || // bounds check
        opacity === 0 || item.fontSize <= 0 ||
        item.text == null || item.text.length === 0) return;

    context.font = font(item);
    context.textAlign = item.align || 'left';

    p = anchorPoint(item);
    x = p.x1,
    y = p.y1;

    if (item.angle) {
      context.save();
      context.translate(x, y);
      context.rotate(item.angle * DegToRad);
      x = y = 0; // reset x, y
    }
    x += (item.dx || 0);
    y += (item.dy || 0) + offset(item);

    tl = textLines(item);
    blend(context, item);
    if (isArray(tl)) {
      lh = lineHeight(item);
      for (i=0; i<tl.length; ++i) {
        str = textValue(item, tl[i]);
        if (item.fill && fill(context, item, opacity)) {
          context.fillText(str, x, y);
        }
        if (item.stroke && stroke(context, item, opacity)) {
          context.strokeText(str, x, y);
        }
        y += lh;
      }
    } else {
      str = textValue(item, tl);
      if (item.fill && fill(context, item, opacity)) {
        context.fillText(str, x, y);
      }
      if (item.stroke && stroke(context, item, opacity)) {
        context.strokeText(str, x, y);
      }
    }

    if (item.angle) context.restore();
  });
}

function hit(context, item, x, y, gx, gy) {
  if (item.fontSize <= 0) return false;
  if (!item.angle) return true; // bounds sufficient if no rotation

  // project point into space of unrotated bounds
  var p = anchorPoint(item),
      ax = p.x1,
      ay = p.y1,
      b = bound(tempBounds, item, 1),
      a = -item.angle * DegToRad,
      cos = Math.cos(a),
      sin = Math.sin(a),
      px = cos * gx - sin * gy + (ax - cos * ax + sin * ay),
      py = sin * gx + cos * gy + (ay - sin * ax - cos * ay);

  return b.contains(px, py);
}

function intersectText(item, box) {
  var p = bound(tempBounds, item, 2);
  return intersectBoxLine(box, p[0], p[1], p[2], p[3])
      || intersectBoxLine(box, p[0], p[1], p[4], p[5])
      || intersectBoxLine(box, p[4], p[5], p[6], p[7])
      || intersectBoxLine(box, p[2], p[3], p[6], p[7]);
}

export default {
  type:   'text',
  tag:    'text',
  nested: false,
  attr:   attr,
  bound:  bound,
  draw:   draw,
  pick:   pick(hit),
  isect:  intersectText
};
