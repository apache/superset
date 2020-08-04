import marks from '../marks/index';
import point from './point';

export default function(item, event, el, origin) {
  var mark = item && item.mark,
      mdef, p;

  if (mark && (mdef = marks[mark.marktype]).tip) {
    p = point(event, el);
    p[0] -= origin[0];
    p[1] -= origin[1];
    while (item = item.mark.group) {
      p[0] -= item.x || 0;
      p[1] -= item.y || 0;
    }
    item = mdef.tip(mark.items, p);
  }

  return item;
}
