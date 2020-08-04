import {Bottom, Top} from './constants';
import {Transform} from 'vega-dataflow';
import {Bounds} from 'vega-scenegraph';
import {inherits, peek} from 'vega-util';

/**
 * Analyze items for overlap, changing opacity to hide items with
 * overlapping bounding boxes. This transform will preserve at least
 * two items (e.g., first and last) even if overlap persists.
 * @param {object} params - The parameters for this operator.
 * @param {function(*,*): number} [params.sort] - A comparator
 *   function for sorting items.
 * @param {object} [params.method] - The overlap removal method to apply.
 *   One of 'parity' (default, hide every other item until there is no
 *   more overlap) or 'greedy' (sequentially scan and hide and items that
 *   overlap with the last visible item).
 * @param {object} [params.boundScale] - A scale whose range should be used
 *   to bound the items. Items exceeding the bounds of the scale range
 *   will be treated as overlapping. If null or undefined, no bounds check
 *   will be applied.
 * @param {object} [params.boundOrient] - The orientation of the scale
 *   (top, bottom, left, or right) used to bound items. This parameter is
 *   ignored if boundScale is null or undefined.
 * @param {object} [params.boundTolerance] - The tolerance in pixels for
 *   bound inclusion testing (default 1). This specifies by how many pixels
 *   an item's bounds may exceed the scale range bounds and not be culled.
 * @constructor
 */
export default function Overlap(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Overlap, Transform);

var methods = {
  parity: items => {
    return items.filter((item, i) => i % 2 ? (item.opacity = 0) : 1);
  },
  greedy: (items, sep) => {
    var a;
    return items.filter((b, i) => {
      if (!i || !intersect(a.bounds, b.bounds, sep)) {
        a = b;
        return 1;
      } else {
        return b.opacity = 0;
      }
    });
  }
};

// compute bounding box intersection
// including padding pixels of separation
function intersect(a, b, sep) {
  return sep > Math.max(
    b.x1 - a.x2,
    a.x1 - b.x2,
    b.y1 - a.y2,
    a.y1 - b.y2
  );
}

function hasOverlap(items, pad) {
  for (var i=1, n=items.length, a=items[0].bounds, b; i<n; a=b, ++i) {
    if (intersect(a, b = items[i].bounds, pad)) return true;
  }
}

function hasBounds(item) {
  var b = item.bounds;
  return b.width() > 1 && b.height() > 1;
}

function boundTest(scale, orient, tolerance) {
  var range = scale.range(),
      b = new Bounds();

  if (orient === Top || orient === Bottom) {
    b.set(range[0], -Infinity, range[1], +Infinity);
  } else {
    b.set(-Infinity, range[0], +Infinity, range[1]);
  }
  b.expand(tolerance || 1);

  return item => b.encloses(item.bounds);
}

// reset all items to be fully opaque
function reset(source) {
  source.forEach(item => item.opacity = 1);
  return source;
}

// add all tuples to mod, fork pulse if parameters were modified
// fork prevents cross-stream tuple pollution (e.g., pulse from scale)
function reflow(pulse, _) {
  return pulse.reflow(_.modified()).modifies('opacity');
}

prototype.transform = function(_, pulse) {
  var reduce = methods[_.method] || methods.parity,
      source = pulse.materialize(pulse.SOURCE).source,
      sep = _.separation || 0,
      items, test, bounds;

  if (!source || !source.length) return;

  if (!_.method) {
    // early exit if method is falsy
    if (_.modified('method')) {
      reset(source);
      pulse = reflow(pulse, _);
    }
    return pulse;
  }

  // skip labels with no content
  source = source.filter(hasBounds);

  // early exit, nothing to do
  if (!source.length) return;

  if (_.sort) {
    source = source.slice().sort(_.sort);
  }

  items = reset(source);
  pulse = reflow(pulse, _);

  if (items.length >= 3 && hasOverlap(items, sep)) {
    do {
      items = reduce(items, sep);
    } while (items.length >= 3 && hasOverlap(items, sep));

    if (items.length < 3 && !peek(source).opacity) {
      if (items.length > 1) peek(items).opacity = 0;
      peek(source).opacity = 1;
    }
  }

  if (_.boundScale && _.boundTolerance >= 0) {
    test = boundTest(_.boundScale, _.boundOrient, +_.boundTolerance);
    source.forEach(item => {
      if (!test(item)) item.opacity = 0;
    });
  }

  // re-calculate mark bounds
  bounds = items[0].mark.bounds.clear();
  source.forEach(item => {
    if (item.opacity) bounds.union(item.bounds);
  });

  return pulse;
};
