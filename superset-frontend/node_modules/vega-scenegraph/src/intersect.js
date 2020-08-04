import Marks from './marks/index';
import {error} from 'vega-util';
import Bounds from './Bounds';

export function intersect(scene, bounds, filter) {
  const hits = [], // intersection results
        box = new Bounds().union(bounds), // defensive copy
        type = scene.marktype;

  return type ? intersectMark(scene, box, filter, hits)
    : type === 'group' ? intersectGroup(scene, box, filter, hits)
    : error('Intersect scene must be mark node or group item.');
}

function intersectMark(mark, box, filter, hits) {
  if (visitMark(mark, box, filter)) {
    const items = mark.items,
          type = mark.marktype,
          n = items.length;

    let i = 0;

    if (type === 'group') {
      for (; i<n; ++i) {
        intersectGroup(items[i], box, filter, hits);
      }
    } else {
      for (const test = Marks[type].isect; i<n; ++i) {
        let item = items[i];
        if (intersectItem(item, box, test)) hits.push(item);
      }
    }
  }
  return hits;
}

function visitMark(mark, box, filter) {
  // process if bounds intersect and if
  // (1) mark is a group mark (so we must recurse), or
  // (2) mark is interactive and passes filter
  return mark.bounds && box.intersects(mark.bounds) && (
    mark.marktype === 'group' ||
    mark.interactive !== false && (!filter || filter(mark))
  );
}

function intersectGroup(group, box, filter, hits) {
  // test intersect against group
  // skip groups by default unless filter says otherwise
  if ((filter && filter(group.mark)) &&
      intersectItem(group, box, Marks.group.isect)) {
    hits.push(group);
  }

  // recursively test children marks
  // translate box to group coordinate space
  const marks = group.items,
        n = marks && marks.length;

  if (n) {
    const x = group.x || 0,
          y = group.y || 0;
    box.translate(-x, -y);
    for (let i=0; i<n; ++i) {
      intersectMark(marks[i], box, filter, hits);
    }
    box.translate(x, y);
  }

  return hits;
}

function intersectItem(item, box, test) {
  // test bounds enclosure, bounds intersection, then detailed test
  const bounds = item.bounds;
  return box.encloses(bounds) || (box.intersects(bounds) && test(item, box));
}

