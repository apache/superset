import {context} from './canvas/context';
import Bounds from '../Bounds';

const b = new Bounds();

export function intersectPath(draw) {
  return function(item, brush) {
    // rely on (inaccurate) bounds intersection if no context
    if (!context) return true;

    // add path to offscreen graphics context
    draw(context, item);

    // get bounds intersection region
    b.clear().union(item.bounds).intersect(brush).round();
    const {x1, y1, x2, y2} = b;

    // iterate over intersection region
    // perform fine grained inclusion test
    for (let y = y1; y <= y2; ++y) {
      for (let x = x1; x <= x2; ++x) {
        if (context.isPointInPath(x, y)) {
          return true;
        }
      }
    }

    // false if no hits in intersection region
    return false;
  };
}

export function intersectPoint(item, box) {
  return box.contains(item.x || 0, item.y || 0);
}

export function intersectRect(item, box) {
  const x = item.x || 0,
        y = item.y || 0,
        w = item.width || 0,
        h = item.height || 0;
  return box.intersects(b.set(x, y, x + w, y + h));
}

export function intersectRule(item, box) {
  const x = item.x || 0,
        y = item.y || 0,
        x2 = item.x2 != null ? item.x2 : x,
        y2 = item.y2 != null ? item.y2 : y;
  return intersectBoxLine(box, x, y, x2, y2);
}

export function intersectBoxLine(box, x, y, u, v) {
  const {x1, y1, x2, y2} = box,
        dx = u - x,
        dy = v - y;

  let t0 = 0, t1 = 1, p, q, r, e;

  for (e=0; e<4; ++e) {
    if (e === 0) { p = -dx; q = -(x1 - x); }
    if (e === 1) { p =  dx; q =  (x2 - x); }
    if (e === 2) { p = -dy; q = -(y1 - y); }
    if (e === 3) { p =  dy; q =  (y2 - y); }

    if (Math.abs(p) < 1e-10 && q < 0) return false;

    r = q / p;

    if (p < 0) {
      if (r > t1) return false;
      else if (r > t0) t0 = r;
    } else if (p > 0) {
      if (r < t0) return false;
      else if (r < t1) t1 = r;
    }
  }

  return true;
}
