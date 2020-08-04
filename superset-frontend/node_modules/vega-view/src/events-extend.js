import {offset} from './render-size';
import {constant, isString} from 'vega-util';
import {point} from 'vega-scenegraph';

/**
 * Extend an event with additional view-specific methods.
 * Adds a new property ('vega') to an event that provides a number
 * of methods for querying information about the current interaction.
 * The vega object provides the following methods:
 *   view - Returns the backing View instance.
 *   item - Returns the currently active scenegraph item (if any).
 *   group - Returns the currently active scenegraph group (if any).
 *     This method accepts a single string-typed argument indicating the name
 *     of the desired parent group. The scenegraph will be traversed from
 *     the item up towards the root to search for a matching group. If no
 *     argument is provided the enclosing group for the active item is
 *     returned, unless the item it itself a group, in which case it is
 *     returned directly.
 *   xy - Returns a two-element array containing the x and y coordinates for
 *     mouse or touch events. For touch events, this is based on the first
 *     elements in the changedTouches array. This method accepts a single
 *     argument: either an item instance or mark name that should serve as
 *     the reference coordinate system. If no argument is provided the
 *     top-level view coordinate system is assumed.
 *   x - Returns the current x-coordinate, accepts the same arguments as xy.
 *   y - Returns the current y-coordinate, accepts the same arguments as xy.
 * @param {Event} event - The input event to extend.
 * @param {Item} item - The currently active scenegraph item (if any).
 * @return {Event} - The extended input event.
 */
export default function(view, event, item) {
  var r  = view._renderer,
      el = r && r.canvas(),
      p, e, translate;

  if (el) {
    translate = offset(view);
    e = event.changedTouches ? event.changedTouches[0] : event;
    p = point(e, el);
    p[0] -= translate[0];
    p[1] -= translate[1];
  }

  event.dataflow = view;
  event.item = item;
  event.vega = extension(view, item, p);
  return event;
}

function extension(view, item, point) {
  var itemGroup = item
    ? item.mark.marktype === 'group' ? item : item.mark.group
    : null;

  function group(name) {
    var g = itemGroup, i;
    if (name) for (i = item; i; i = i.mark.group) {
      if (i.mark.name === name) { g = i; break; }
    }
    return g && g.mark && g.mark.interactive ? g : {};
  }

  function xy(item) {
    if (!item) return point;
    if (isString(item)) item = group(item);

    var p = point.slice();
    while (item) {
      p[0] -= item.x || 0;
      p[1] -= item.y || 0;
      item = item.mark && item.mark.group;
    }
    return p;
  }

  return {
    view:  constant(view),
    item:  constant(item || {}),
    group: group,
    xy:    xy,
    x:     function(item) { return xy(item)[0]; },
    y:     function(item) { return xy(item)[1]; }
  };
}
