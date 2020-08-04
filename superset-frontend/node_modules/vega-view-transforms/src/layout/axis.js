import {Bottom, Left, Right, Top} from '../constants';
import {set, tempBounds} from './util';
import {boundStroke, multiLineOffset} from 'vega-scenegraph';

export function isYAxis(mark) {
  var orient = mark.items[0].orient;
  return orient === Left || orient === Right;
}

function axisIndices(datum) {
  var index = +datum.grid;
  return [
    datum.ticks  ? index++ : -1, // ticks index
    datum.labels ? index++ : -1, // labels index
    index + (+datum.domain)      // title index
  ];
}

export function axisLayout(view, axis, width, height) {  
  var item = axis.items[0],
      datum = item.datum,
      delta = item.translate != null ? item.translate : 0.5,
      orient = item.orient,
      indices = axisIndices(datum),
      range = item.range,
      offset = item.offset,
      position = item.position,
      minExtent = item.minExtent,
      maxExtent = item.maxExtent,
      title = datum.title && item.items[indices[2]].items[0],
      titlePadding = item.titlePadding,
      bounds = item.bounds,
      dl = title && multiLineOffset(title),
      x = 0, y = 0, i, s;

  tempBounds.clear().union(bounds);
  bounds.clear();
  if ((i=indices[0]) > -1) bounds.union(item.items[i].bounds);
  if ((i=indices[1]) > -1) bounds.union(item.items[i].bounds);

  // position axis group and title
  switch (orient) {
    case Top:
      x = position || 0;
      y = -offset;
      s = Math.max(minExtent, Math.min(maxExtent, -bounds.y1));
      bounds.add(0, -s).add(range, 0);
      if (title) axisTitleLayout(view, title, s, titlePadding, dl, 0, -1, bounds);
      break;
    case Left:
      x = -offset;
      y = position || 0;
      s = Math.max(minExtent, Math.min(maxExtent, -bounds.x1));
      bounds.add(-s, 0).add(0, range);
      if (title) axisTitleLayout(view, title, s, titlePadding, dl, 1, -1, bounds);
      break;
    case Right:
      x = width + offset;
      y = position || 0;
      s = Math.max(minExtent, Math.min(maxExtent, bounds.x2));
      bounds.add(0, 0).add(s, range);
      if (title) axisTitleLayout(view, title, s, titlePadding, dl, 1, 1, bounds);
      break;
    case Bottom:
      x = position || 0;
      y = height + offset;
      s = Math.max(minExtent, Math.min(maxExtent, bounds.y2));
      bounds.add(0, 0).add(range, s);
      if (title) axisTitleLayout(view, title, s, titlePadding, 0, 0, 1, bounds);
      break;
    default:
      x = item.x;
      y = item.y;
  }

  // update bounds
  boundStroke(bounds.translate(x, y), item);

  if (set(item, 'x', x + delta) | set(item, 'y', y + delta)) {
    item.bounds = tempBounds;
    view.dirty(item);
    item.bounds = bounds;
    view.dirty(item);
  }

  return item.mark.bounds.clear().union(bounds);
}

function axisTitleLayout(view, title, offset, pad, dl, isYAxis, sign, bounds) {
  const b = title.bounds;

  if (title.auto) {
    const v = sign * (offset + dl + pad);
    let dx = 0, dy = 0;

    view.dirty(title);
    isYAxis
      ? dx = (title.x || 0) - (title.x = v)
      : dy = (title.y || 0) - (title.y = v);
    title.mark.bounds.clear().union(b.translate(-dx, -dy));
    view.dirty(title);
  }

  bounds.union(b);
}
