import {AxisRole, Group, LegendRole, TitleRole} from './constants';
import {Transform} from 'vega-dataflow';
import {Marks, boundClip} from 'vega-scenegraph';
import {inherits} from 'vega-util';

/**
 * Calculate bounding boxes for scenegraph items.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {object} params.mark - The scenegraph mark instance to bound.
 */
export default function Bound(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Bound, Transform);

prototype.transform = function(_, pulse) {
  var view = pulse.dataflow,
      mark = _.mark,
      type = mark.marktype,
      entry = Marks[type],
      bound = entry.bound,
      markBounds = mark.bounds, rebound;

  if (entry.nested) {
    // multi-item marks have a single bounds instance
    if (mark.items.length) view.dirty(mark.items[0]);
    markBounds = boundItem(mark, bound);
    mark.items.forEach(function(item) {
      item.bounds.clear().union(markBounds);
    });
  }

  else if (type === Group || _.modified()) {
    // operator parameters modified -> re-bound all items
    // updates group bounds in response to modified group content
    pulse.visit(pulse.MOD, item => view.dirty(item));
    markBounds.clear();
    mark.items.forEach(item => markBounds.union(boundItem(item, bound)));

    // force reflow for axes/legends/titles to propagate any layout changes
    switch (mark.role) {
      case AxisRole:
      case LegendRole:
      case TitleRole:
        pulse.reflow();
    }
  }

  else {
    // incrementally update bounds, re-bound mark as needed
    rebound = pulse.changed(pulse.REM);

    pulse.visit(pulse.ADD, item => {
      markBounds.union(boundItem(item, bound));
    });

    pulse.visit(pulse.MOD, item => {
      rebound = rebound || markBounds.alignsWith(item.bounds);
      view.dirty(item);
      markBounds.union(boundItem(item, bound));
    });

    if (rebound) {
      markBounds.clear();
      mark.items.forEach(item => markBounds.union(item.bounds));
    }
  }

  // ensure mark bounds do not exceed any clipping region
  boundClip(mark);

  return pulse.modifies('bounds');
};

function boundItem(item, bound, opt) {
  return bound(item.bounds.clear(), item, opt);
}
