import {hasCornerRadius, rectangle} from '../path/shapes';
import boundStroke from '../bound/boundStroke';
import {intersectRect} from '../util/intersect';
import value from '../util/value';
import {pickVisit, visit} from '../util/visit';
import blend from '../util/canvas/blend';
import {clipGroup} from '../util/canvas/clip';
import fill from '../util/canvas/fill';
import stroke from '../util/canvas/stroke';
import {hitPath} from '../util/canvas/pick';
import clip from '../util/svg/clip';
import {translateItem} from '../util/svg/transform';

function offset(item) {
  const sw = value(item.strokeWidth, 1);
  return item.strokeOffset != null ? item.strokeOffset
    : item.stroke && sw > 0.5 && sw < 1.5 ? 0.5 - Math.abs(sw - 1)
    : 0;
}

function attr(emit, item) {
  emit('transform', translateItem(item));
}

function emitRectangle(emit, item) {
  const off = offset(item);
  emit('d', rectangle(null, item, off, off));
}

function background(emit, item) {
  emit('class', 'background');
  emit('aria-hidden', true);
  emitRectangle(emit, item);
}

function foreground(emit, item) {
  emit('class', 'foreground');
  emit('aria-hidden', true);
  if (item.strokeForeground) {
    emitRectangle(emit, item);
  } else {
    emit('d', '');
  }
}

function content(emit, item, renderer) {
  const url = item.clip ? clip(renderer, item, item) : null;
  emit('clip-path', url);
}

function bound(bounds, group) {
  if (!group.clip && group.items) {
    const items = group.items, m = items.length;
    for (let j=0; j<m; ++j) {
      bounds.union(items[j].bounds);
    }
  }

  if ((group.clip || group.width || group.height) && !group.noBound) {
    bounds.add(0, 0).add(group.width || 0, group.height || 0);
  }

  boundStroke(bounds, group);

  return bounds.translate(group.x || 0, group.y || 0);
}

function rectanglePath(context, group, x, y) {
  const off = offset(group);
  context.beginPath();
  rectangle(context, group, (x || 0) + off, (y || 0) + off);
}

const hitBackground = hitPath(rectanglePath);
const hitForeground = hitPath(rectanglePath, false);

function draw(context, scene, bounds) {
  visit(scene, group => {
    const gx = group.x || 0,
          gy = group.y || 0,
          fore = group.strokeForeground,
          opacity = group.opacity == null ? 1 : group.opacity;

    // draw group background
    if ((group.stroke || group.fill) && opacity) {
      rectanglePath(context, group, gx, gy);
      blend(context, group);
      if (group.fill && fill(context, group, opacity)) {
        context.fill();
      }
      if (group.stroke && !fore && stroke(context, group, opacity)) {
        context.stroke();
      }
    }

    // setup graphics context, set clip and bounds
    context.save();
    context.translate(gx, gy);
    if (group.clip) clipGroup(context, group);
    if (bounds) bounds.translate(-gx, -gy);

    // draw group contents
    visit(group, item => {
      this.draw(context, item, bounds);
    });

    // restore graphics context
    if (bounds) bounds.translate(gx, gy);
    context.restore();

    // draw group foreground
    if (fore && group.stroke && opacity) {
      rectanglePath(context, group, gx, gy);
      blend(context, group);
      if (stroke(context, group, opacity)) {
        context.stroke();
      }
    }
  });
}

function pick(context, scene, x, y, gx, gy) {
  if (scene.bounds && !scene.bounds.contains(gx, gy) || !scene.items) {
    return null;
  }

  const cx = x * context.pixelRatio,
        cy = y * context.pixelRatio;

  return pickVisit(scene, group => {
    let hit, fore, ix, dx, dy, dw, dh, b, c;

    // first hit test bounding box
    b = group.bounds;
    if (b && !b.contains(gx, gy)) return;

    // passed bounds check, test rectangular clip
    dx = group.x || 0;
    dy = group.y || 0;
    dw = dx + (group.width || 0);
    dh = dy + (group.height || 0);
    c = group.clip;
    if (c && (gx < dx || gx > dw || gy < dy || gy > dh)) return;

    // adjust coordinate system
    context.save();
    context.translate(dx, dy);
    dx = gx - dx;
    dy = gy - dy;

    // test background for rounded corner clip
    if (c && hasCornerRadius(group) && !hitBackground(context, group, cx, cy)) {
      context.restore();
      return null;
    }

    fore = group.strokeForeground;
    ix = scene.interactive !== false;

    // hit test against group foreground
    if (ix && fore && group.stroke
        && hitForeground(context, group, cx, cy)) {
      context.restore();
      return group;
    }

    // hit test against contained marks
    hit = pickVisit(group, mark => pickMark(mark, dx, dy)
      ? this.pick(mark, x, y, dx, dy)
      : null
    );

    // hit test against group background
    if (!hit && ix && (group.fill || (!fore && group.stroke))
        && hitBackground(context, group, cx, cy)) {
      hit = group;
    }

    // restore state and return
    context.restore();
    return hit || null;
  });
}

function pickMark(mark, x, y) {
  return (mark.interactive !== false || mark.marktype === 'group')
    && mark.bounds && mark.bounds.contains(x, y);
}

export default {
  type:       'group',
  tag:        'g',
  nested:     false,
  attr:       attr,
  bound:      bound,
  draw:       draw,
  pick:       pick,
  isect:      intersectRect,
  content:    content,
  background: background,
  foreground: foreground
};
