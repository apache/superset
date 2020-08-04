import {ariaLabel} from './aria';
import background from './background';
import cursor, {setCursor} from './cursor';
import {change, data, dataref, insert, remove} from './data';
import {events, initializeEventConfig} from './events';
import hover from './hover';
import finalize from './finalize';
import initialize from './initialize';
import padding from './padding';
import renderToImageURL from './render-to-image-url';
import renderToCanvas from './render-to-canvas';
import renderToSVG from './render-to-svg';
import {resizeRenderer} from './render-size';
import runtime from './runtime';
import {scale} from './scale';
import {initializeResize, resizeView, viewHeight, viewWidth} from './size';
import {getState, setState} from './state';
import timer from './timer';
import defaultTooltip from './tooltip';
import trap from './trap';

import {Dataflow, asyncCallback} from 'vega-dataflow';
import {locale} from 'vega-format';
import {
  CanvasHandler, RenderType, Scenegraph, renderModule
} from 'vega-scenegraph';
import {
  error, extend, hasOwnProperty, inherits, stringValue
} from 'vega-util';

/**
 * Create a new View instance from a Vega dataflow runtime specification.
 * The generated View will not immediately be ready for display. Callers
 * should also invoke the initialize method (e.g., to set the parent
 * DOM element in browser-based deployment) and then invoke the run
 * method to evaluate the dataflow graph. Rendering will automatically
 * be performed upon dataflow runs.
 * @constructor
 * @param {object} spec - The Vega dataflow runtime specification.
 */
export default function View(spec, options) {
  const view = this;
  options = options || {};

  Dataflow.call(view);
  if (options.loader) view.loader(options.loader);
  if (options.logger) view.logger(options.logger);
  if (options.logLevel != null) view.logLevel(options.logLevel);
  if (options.locale || spec.locale) {
    const loc = extend({}, spec.locale, options.locale);
    view.locale(locale(loc.number, loc.time));
  }

  view._el = null;
  view._elBind = null;
  view._renderType = options.renderer || RenderType.Canvas;
  view._scenegraph = new Scenegraph();
  const root = view._scenegraph.root;

  // initialize renderer, handler and event management
  view._renderer = null;
  view._tooltip = options.tooltip || defaultTooltip,
  view._redraw = true;
  view._handler = new CanvasHandler().scene(root);
  view._globalCursor = false;
  view._preventDefault = false;
  view._timers = [];
  view._eventListeners = [];
  view._resizeListeners = [];

  // initialize event configuration
  view._eventConfig = initializeEventConfig(spec.eventConfig);
  view.globalCursor(view._eventConfig.globalCursor);

  // initialize dataflow graph
  const ctx = runtime(view, spec, options.expr);
  view._runtime = ctx;
  view._signals = ctx.signals;
  view._bind = (spec.bindings || []).map(_ => ({
    state: null,
    param: extend({}, _)
  }));

  // initialize scenegraph
  if (ctx.root) ctx.root.set(root);
  root.source = ctx.data.root.input;
  view.pulse(
    ctx.data.root.input,
    view.changeset().insert(root.items)
  );

  // initialize view size
  view._width = view.width();
  view._height = view.height();
  view._viewWidth = viewWidth(view, view._width);
  view._viewHeight = viewHeight(view, view._height);
  view._origin = [0, 0];
  view._resize = 0;
  view._autosize = 1;
  initializeResize(view);

  // initialize background color
  background(view);

  // initialize cursor
  cursor(view);

  // initialize view description
  view.description(spec.description);

  // initialize hover proessing, if requested
  if (options.hover) view.hover();

  // initialize DOM container(s) and renderer
  if (options.container) view.initialize(options.container, options.bind);
}

var prototype = inherits(View, Dataflow);

// -- DATAFLOW / RENDERING ----

prototype.evaluate = async function(encode, prerun, postrun) {
  // evaluate dataflow and prerun
  await Dataflow.prototype.evaluate.call(this, encode, prerun);

  // render as needed
  if (this._redraw || this._resize) {
    try {
      if (this._renderer) {
        if (this._resize) {
          this._resize = 0;
          resizeRenderer(this);
        }
        await this._renderer.renderAsync(this._scenegraph.root);
      }
      this._redraw = false;
    } catch (e) {
      this.error(e);
    }
  }

  // evaluate postrun
  if (postrun) asyncCallback(this, postrun);

  return this;
};

prototype.dirty = function(item) {
  this._redraw = true;
  this._renderer && this._renderer.dirty(item);
};

// -- GET / SET ----

prototype.description = function(text) {
  if (arguments.length) {
    const desc = text != null ? (text + '') : null;
    if (desc !== this._desc) ariaLabel(this._el, this._desc = desc);
    return this;
  }
  return this._desc;
};

prototype.container = function() {
  return this._el;
};

prototype.scenegraph = function() {
  return this._scenegraph;
};

prototype.origin = function() {
  return this._origin.slice();
};

function lookupSignal(view, name) {
  return hasOwnProperty(view._signals, name)
    ? view._signals[name]
    : error('Unrecognized signal name: ' + stringValue(name));
}

prototype.signal = function(name, value, options) {
  var op = lookupSignal(this, name);
  return arguments.length === 1
    ? op.value
    : this.update(op, value, options);
};

prototype.width = function(_) {
  return arguments.length ? this.signal('width', _) : this.signal('width');
};

prototype.height = function(_) {
  return arguments.length ? this.signal('height', _) : this.signal('height');
};

prototype.padding = function(_) {
  return arguments.length
    ? this.signal('padding', padding(_))
    : padding(this.signal('padding'));
};

prototype.autosize = function(_) {
  return arguments.length ? this.signal('autosize', _) : this.signal('autosize');
};

prototype.background = function(_) {
  return arguments.length ? this.signal('background', _) : this.signal('background');
};

prototype.renderer = function(type) {
  if (!arguments.length) return this._renderType;
  if (!renderModule(type)) error('Unrecognized renderer type: ' + type);
  if (type !== this._renderType) {
    this._renderType = type;
    this._resetRenderer();
  }
  return this;
};

prototype.tooltip = function(handler) {
  if (!arguments.length) return this._tooltip;
  if (handler !== this._tooltip) {
    this._tooltip = handler;
    this._resetRenderer();
  }
  return this;
};

prototype.loader = function(loader) {
  if (!arguments.length) return this._loader;
  if (loader !== this._loader) {
    Dataflow.prototype.loader.call(this, loader);
    this._resetRenderer();
  }
  return this;
};

prototype.resize = function() {
  // set flag to perform autosize
  this._autosize = 1;
  // touch autosize signal to ensure top-level ViewLayout runs
  return this.touch(lookupSignal(this, 'autosize'));
};

prototype._resetRenderer = function() {
  if (this._renderer) {
    this._renderer = null;
    this.initialize(this._el, this._elBind);
  }
};

// -- SIZING ----
prototype._resizeView = resizeView;

// -- EVENT HANDLING ----

prototype.addEventListener = function(type, handler, options) {
  var callback = handler;
  if (!(options && options.trap === false)) {
    // wrap callback in error handler
    callback = trap(this, handler);
    callback.raw = handler;
  }
  this._handler.on(type, callback);
  return this;
};

prototype.removeEventListener = function(type, handler) {
  var handlers = this._handler.handlers(type),
      i = handlers.length, h, t;

  // search registered handlers, remove if match found
  while (--i >= 0) {
    t = handlers[i].type;
    h = handlers[i].handler;
    if (type === t && (handler === h || handler === h.raw)) {
      this._handler.off(t, h);
      break;
    }
  }
  return this;
};

prototype.addResizeListener = function(handler) {
  var l = this._resizeListeners;
  if (l.indexOf(handler) < 0) {
    // add handler if it isn't already registered
    // note: error trapping handled elsewhere, so
    // no need to wrap handlers here
    l.push(handler);
  }
  return this;
};

prototype.removeResizeListener = function(handler) {
  var l = this._resizeListeners,
      i = l.indexOf(handler);
  if (i >= 0) {
    l.splice(i, 1);
  }
  return this;
};

function findOperatorHandler(op, handler) {
  const h = (op._targets || [])
    .filter(op => op._update && op._update.handler === handler);
  return h.length ? h[0] : null;
}

function addOperatorListener(view, name, op, handler) {
  var h = findOperatorHandler(op, handler);
  if (!h) {
    h = trap(view, () => handler(name, op.value));
    h.handler = handler;
    view.on(op, null, h);
  }
  return view;
}

function removeOperatorListener(view, op, handler) {
  var h = findOperatorHandler(op, handler);
  if (h) op._targets.remove(h);
  return view;
}

prototype.addSignalListener = function(name, handler) {
  return addOperatorListener(this, name, lookupSignal(this, name), handler);
};

prototype.removeSignalListener = function(name, handler) {
  return removeOperatorListener(this, lookupSignal(this, name), handler);
};

prototype.addDataListener = function(name, handler) {
  return addOperatorListener(this, name, dataref(this, name).values, handler);
};

prototype.removeDataListener = function(name, handler) {
  return removeOperatorListener(this, dataref(this, name).values, handler);
};

prototype.globalCursor = function(_) {
  if (arguments.length) {
    if (this._globalCursor !== !!_) {
      const prev = setCursor(this, null); // clear previous cursor
      this._globalCursor = !!_;
      if (prev) setCursor(this, prev); // swap cursor
    }
    return this;
  } else {
    return this._globalCursor;
  }
};

prototype.preventDefault = function(_) {
  if (arguments.length) {
    this._preventDefault = _;
    return this;
  } else {
    return this._preventDefault;
  }
};

prototype.timer = timer;
prototype.events = events;
prototype.finalize = finalize;
prototype.hover = hover;

// -- DATA ----
prototype.data = data;
prototype.change = change;
prototype.insert = insert;
prototype.remove = remove;

// -- SCALES --
prototype.scale = scale;

// -- INITIALIZATION ----
prototype.initialize = initialize;

// -- HEADLESS RENDERING ----
prototype.toImageURL = renderToImageURL;
prototype.toCanvas = renderToCanvas;
prototype.toSVG = renderToSVG;

// -- SAVE / RESTORE STATE ----
prototype.getState = getState;
prototype.setState = setState;
