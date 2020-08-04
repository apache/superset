import {domCreate} from './util/dom';
import resolveItem from './util/resolveItem';
import {loader} from 'vega-loader';

/**
 * Create a new Handler instance.
 * @param {object} [customLoader] - Optional loader instance for
 *   href URL sanitization. If not specified, a standard loader
 *   instance will be generated.
 * @param {function} [customTooltip] - Optional tooltip handler
 *   function for custom tooltip display.
 * @constructor
 */
export default function Handler(customLoader, customTooltip) {
  this._active = null;
  this._handlers = {};
  this._loader = customLoader || loader();
  this._tooltip = customTooltip || defaultTooltip;
}

// The default tooltip display handler.
// Sets the HTML title attribute on the visualization container.
function defaultTooltip(handler, event, item, value) {
  handler.element().setAttribute('title', value || '');
}

const prototype = Handler.prototype;

/**
 * Initialize a new Handler instance.
 * @param {DOMElement} el - The containing DOM element for the display.
 * @param {Array<number>} origin - The origin of the display, in pixels.
 *   The coordinate system will be translated to this point.
 * @param {object} [obj] - Optional context object that should serve as
 *   the "this" context for event callbacks.
 * @return {Handler} - This handler instance.
 */
prototype.initialize = function(el, origin, obj) {
  this._el = el;
  this._obj = obj || null;
  return this.origin(origin);
};

/**
 * Returns the parent container element for a visualization.
 * @return {DOMElement} - The containing DOM element.
 */
prototype.element = function() {
  return this._el;
};

/**
 * Returns the scene element (e.g., canvas or SVG) of the visualization
 * Subclasses must override if the first child is not the scene element.
 * @return {DOMElement} - The scene (e.g., canvas or SVG) element.
 */
prototype.canvas = function() {
  return this._el && this._el.firstChild;
};

/**
 * Get / set the origin coordinates of the visualization.
 */
prototype.origin = function(origin) {
  if (arguments.length) {
    this._origin = origin || [0, 0];
    return this;
  } else {
    return this._origin.slice();
  }
};

/**
 * Get / set the scenegraph root.
 */
prototype.scene = function(scene) {
  if (!arguments.length) return this._scene;
  this._scene = scene;
  return this;
};

/**
 * Add an event handler. Subclasses should override this method.
 */
prototype.on = function(/*type, handler*/) {};

/**
 * Remove an event handler. Subclasses should override this method.
 */
prototype.off = function(/*type, handler*/) {};

/**
 * Utility method for finding the array index of an event handler.
 * @param {Array} h - An array of registered event handlers.
 * @param {string} type - The event type.
 * @param {function} handler - The event handler instance to find.
 * @return {number} - The handler's array index or -1 if not registered.
 */
prototype._handlerIndex = function(h, type, handler) {
  for (let i = h ? h.length : 0; --i>=0;) {
    if (h[i].type === type && (!handler || h[i].handler === handler)) {
      return i;
    }
  }
  return -1;
};

/**
 * Returns an array with registered event handlers.
 * @param {string} [type] - The event type to query. Any annotations
 *   are ignored; for example, for the argument "click.foo", ".foo" will
 *   be ignored and the method returns all "click" handlers. If type is
 *   null or unspecified, this method returns handlers for all types.
 * @return {Array} - A new array containing all registered event handlers.
 */
prototype.handlers = function(type) {
  const h = this._handlers, a = [];
  if (type) {
    a.push.apply(a, h[this.eventName(type)]);
  } else {
    for (const k in h) { a.push.apply(a, h[k]); }
  }
  return a;
};

/**
 * Parses an event name string to return the specific event type.
 * For example, given "click.foo" returns "click"
 * @param {string} name - The input event type string.
 * @return {string} - A string with the event type only.
 */
prototype.eventName = function(name) {
  const i = name.indexOf('.');
  return i < 0 ? name : name.slice(0, i);
};

/**
 * Handle hyperlink navigation in response to an item.href value.
 * @param {Event} event - The event triggering hyperlink navigation.
 * @param {Item} item - The scenegraph item.
 * @param {string} href - The URL to navigate to.
 */
prototype.handleHref = function(event, item, href) {
  this._loader
    .sanitize(href, {context:'href'})
    .then(opt => {
      const e = new MouseEvent(event.type, event),
            a = domCreate(null, 'a');
      for (const name in opt) a.setAttribute(name, opt[name]);
      a.dispatchEvent(e);
    })
    .catch(function() { /* do nothing */ });
};

/**
 * Handle tooltip display in response to an item.tooltip value.
 * @param {Event} event - The event triggering tooltip display.
 * @param {Item} item - The scenegraph item.
 * @param {boolean} show - A boolean flag indicating whether
 *   to show or hide a tooltip for the given item.
 */
prototype.handleTooltip = function(event, item, show) {
  if (item && item.tooltip != null) {
    item = resolveItem(item, event, this.canvas(), this._origin);
    const value = (show && item && item.tooltip) || null;
    this._tooltip.call(this._obj, this, event, item, value);
  }
};

/**
 * Returns the size of a scenegraph item and its position relative
 * to the viewport.
 * @param {Item} item - The scenegraph item.
 * @return {object} - A bounding box object (compatible with the
 *   DOMRect type) consisting of x, y, width, heigh, top, left,
 *   right, and bottom properties.
 */
prototype.getItemBoundingClientRect = function(item) {
  const el = this.canvas();
  if (!el) return;

  const rect = el.getBoundingClientRect(),
        origin = this._origin,
        bounds = item.bounds,
        width = bounds.width(),
        height = bounds.height();

  let x = bounds.x1 + origin[0] + rect.left,
      y = bounds.y1 + origin[1] + rect.top;

  // translate coordinate for each parent group
  while (item.mark && (item = item.mark.group)) {
    x += item.x || 0;
    y += item.y || 0;
  }

  // return DOMRect-compatible bounding box
  return {
    x, y, width, height,
    left: x, top: y, right: x + width, bottom: y + height
  };
};
