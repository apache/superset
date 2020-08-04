import Renderer from './Renderer';
import {gradientRef, isGradient, patternPrefix} from './Gradient';
import marks from './marks/index';
import {ariaItemAttributes, ariaMarkAttributes} from './util/aria';
import {cssClass, domChild, domClear, domCreate} from './util/dom';
import {closeTag, openTag} from './util/tags';
import {fontFamily, fontSize, lineHeight, textLines, textValue} from './util/text';
import {visit} from './util/visit';
import clip from './util/svg/clip';
import metadata from './util/svg/metadata';
import {rootAttributes, styles} from './util/svg/styles';
import {inherits, isArray} from 'vega-util';

const RootIndex = 0,
      ns = metadata.xmlns;

export default function SVGRenderer(loader) {
  Renderer.call(this, loader);
  this._dirtyID = 0;
  this._dirty = [];
  this._svg = null;
  this._root = null;
  this._defs = null;
}

var prototype = inherits(SVGRenderer, Renderer);
var base = Renderer.prototype;

prototype.initialize = function(el, width, height, padding) {
  // create the svg definitions cache
  this._defs = {
    gradient: {},
    clipping: {}
  };

  if (el) {
    this._svg = domChild(el, 0, 'svg', ns);
    this._svg.setAttribute('class', 'marks');
    domClear(el, 1);

    // set the svg root group
    this._root = domChild(this._svg, RootIndex, 'g', ns);
    for (const attr in rootAttributes) {
      this._root.setAttribute(attr, rootAttributes[attr]);
    }

    // ensure no additional child elements
    domClear(this._svg, RootIndex + 1);
  }

  // set background color if defined
  this.background(this._bgcolor);

  return base.initialize.call(this, el, width, height, padding);
};

prototype.background = function(bgcolor) {
  if (arguments.length && this._svg) {
    this._svg.style.setProperty('background-color', bgcolor);
  }
  return base.background.apply(this, arguments);
};

prototype.resize = function(width, height, origin, scaleFactor) {
  base.resize.call(this, width, height, origin, scaleFactor);

  if (this._svg) {
    this._svg.setAttribute('width', this._width * this._scale);
    this._svg.setAttribute('height', this._height * this._scale);
    this._svg.setAttribute('viewBox', '0 0 ' + this._width + ' ' + this._height);
    this._root.setAttribute('transform', 'translate(' + this._origin + ')');
  }

  this._dirty = [];

  return this;
};

prototype.canvas = function() {
  return this._svg;
};

prototype.svg = function() {
  if (!this._svg) return null;

  var attr = {
    class:   'marks',
    width:   this._width * this._scale,
    height:  this._height * this._scale,
    viewBox: '0 0 ' + this._width + ' ' + this._height
  };
  for (var key in metadata) {
    attr[key] = metadata[key];
  }

  var bg = !this._bgcolor ? ''
    : (openTag('rect', {
        width:  this._width,
        height: this._height,
        fill:   this._bgcolor
      }) + closeTag('rect'));

  return openTag('svg', attr)
    + (this._defs.el ? this._defs.el.outerHTML : '')
    + bg
    + this._root.outerHTML
    + closeTag('svg');
};


// -- Render entry point --

prototype._render = function(scene) {
  // perform spot updates and re-render markup
  if (this._dirtyCheck()) {
    if (this._dirtyAll) this._resetDefs();
    this.draw(this._root, scene);
    domClear(this._root, 1);
  }

  this.updateDefs();

  this._dirty = [];
  ++this._dirtyID;

  return this;
};

// -- Manage SVG definitions ('defs') block --

prototype.updateDefs = function() {
  const svg = this._svg,
        defs = this._defs;

  let el = defs.el,
      index = 0;

  for (const id in defs.gradient) {
    if (!el) defs.el = (el = domChild(svg, RootIndex, 'defs', ns));
    index = updateGradient(el, defs.gradient[id], index);
  }

  for (const id in defs.clipping) {
    if (!el) defs.el = (el = domChild(svg, RootIndex, 'defs', ns));
    index = updateClipping(el, defs.clipping[id], index);
  }

  // clean-up
  if (el) {
    index === 0
      ? (svg.removeChild(el), defs.el = null)
      : domClear(el, index);
  }
};

function updateGradient(el, grad, index) {
  var i, n, stop;

  if (grad.gradient === 'radial') {
    // SVG radial gradients automatically transform to normalized bbox
    // coordinates, in a way that is cumbersome to replicate in canvas.
    // We wrap the radial gradient in a pattern element, allowing us to
    // maintain a circular gradient that matches what canvas provides.
    var pt = domChild(el, index++, 'pattern', ns);
    pt.setAttribute('id', patternPrefix + grad.id);
    pt.setAttribute('viewBox', '0,0,1,1');
    pt.setAttribute('width', '100%');
    pt.setAttribute('height', '100%');
    pt.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    pt = domChild(pt, 0, 'rect', ns);
    pt.setAttribute('width', '1');
    pt.setAttribute('height', '1');
    pt.setAttribute('fill', 'url(' + href() + '#' + grad.id + ')');

    el = domChild(el, index++, 'radialGradient', ns);
    el.setAttribute('id', grad.id);
    el.setAttribute('fx', grad.x1);
    el.setAttribute('fy', grad.y1);
    el.setAttribute('fr', grad.r1);
    el.setAttribute('cx', grad.x2);
    el.setAttribute('cy', grad.y2);
    el.setAttribute( 'r', grad.r2);
  } else {
    el = domChild(el, index++, 'linearGradient', ns);
    el.setAttribute('id', grad.id);
    el.setAttribute('x1', grad.x1);
    el.setAttribute('x2', grad.x2);
    el.setAttribute('y1', grad.y1);
    el.setAttribute('y2', grad.y2);
  }

  for (i=0, n=grad.stops.length; i<n; ++i) {
    stop = domChild(el, i, 'stop', ns);
    stop.setAttribute('offset', grad.stops[i].offset);
    stop.setAttribute('stop-color', grad.stops[i].color);
  }
  domClear(el, i);

  return index;
}

function updateClipping(el, clip, index) {
  var mask;

  el = domChild(el, index, 'clipPath', ns);
  el.setAttribute('id', clip.id);

  if (clip.path) {
    mask = domChild(el, 0, 'path', ns);
    mask.setAttribute('d', clip.path);
  } else {
    mask = domChild(el, 0, 'rect', ns);
    mask.setAttribute('x', 0);
    mask.setAttribute('y', 0);
    mask.setAttribute('width', clip.width);
    mask.setAttribute('height', clip.height);
  }
  domClear(el, 1);

  return index + 1;
}

prototype._resetDefs = function() {
  var def = this._defs;
  def.gradient = {};
  def.clipping = {};
};


// -- Manage rendering of items marked as dirty --

prototype.dirty = function(item) {
  if (item.dirty !== this._dirtyID) {
    item.dirty = this._dirtyID;
    this._dirty.push(item);
  }
};

prototype.isDirty = function(item) {
  return this._dirtyAll
    || !item._svg
    || item.dirty === this._dirtyID;
};

prototype._dirtyCheck = function() {
  this._dirtyAll = true;
  var items = this._dirty;
  if (!items.length || !this._dirtyID) return true;

  var id = ++this._dirtyID,
      item, mark, type, mdef, i, n, o;

  for (i=0, n=items.length; i<n; ++i) {
    item = items[i];
    mark = item.mark;

    if (mark.marktype !== type) {
      // memoize mark instance lookup
      type = mark.marktype;
      mdef = marks[type];
    }

    if (mark.zdirty && mark.dirty !== id) {
      this._dirtyAll = false;
      dirtyParents(item, id);
      mark.items.forEach(function(i) { i.dirty = id; });
    }
    if (mark.zdirty) continue; // handle in standard drawing pass

    if (item.exit) { // EXIT
      if (mdef.nested && mark.items.length) {
        // if nested mark with remaining points, update instead
        o = mark.items[0];
        if (o._svg) this._update(mdef, o._svg, o);
      } else if (item._svg) {
        // otherwise remove from DOM
        o = item._svg.parentNode;
        if (o) o.removeChild(item._svg);
      }
      item._svg = null;
      continue;
    }

    item = (mdef.nested ? mark.items[0] : item);
    if (item._update === id) continue; // already visited

    if (!item._svg || !item._svg.ownerSVGElement) {
      // ENTER
      this._dirtyAll = false;
      dirtyParents(item, id);
    } else {
      // IN-PLACE UPDATE
      this._update(mdef, item._svg, item);
    }
    item._update = id;
  }
  return !this._dirtyAll;
};

function dirtyParents(item, id) {
  for (; item && item.dirty !== id; item=item.mark.group) {
    item.dirty = id;
    if (item.mark && item.mark.dirty !== id) {
      item.mark.dirty = id;
    } else return;
  }
}


// -- Construct & maintain scenegraph to SVG mapping ---

// Draw a mark container.
prototype.draw = function(el, scene, prev) {
  if (!this.isDirty(scene)) return scene._svg;

  var svg = this._svg,
      mdef = marks[scene.marktype],
      events = scene.interactive === false ? 'none' : null,
      isGroup = mdef.tag === 'g',
      sibling = null,
      i = 0,
      parent;

  parent = bind(scene, el, prev, 'g', svg);
  parent.setAttribute('class', cssClass(scene));

  // apply aria attributes to parent container element
  const aria = ariaMarkAttributes(scene);
  for (const key in aria) setAttribute(parent, key, aria[key]);

  if (!isGroup) {
    setAttribute(parent, 'pointer-events', events);
  }
  setAttribute(parent, 'clip-path',
    scene.clip ? clip(this, scene, scene.group) : null);

  const process = item => {
    const dirty = this.isDirty(item),
          node = bind(item, parent, sibling, mdef.tag, svg);

    if (dirty) {
      this._update(mdef, node, item);
      if (isGroup) recurse(this, node, item);
    }

    sibling = node;
    ++i;
  };

  if (mdef.nested) {
    if (scene.items.length) process(scene.items[0]);
  } else {
    visit(scene, process);
  }

  domClear(parent, i);
  return parent;
};

// Recursively process group contents.
function recurse(renderer, el, group) {
  el = el.lastChild.previousSibling;
  let prev, idx = 0;

  visit(group, item => {
    prev = renderer.draw(el, item, prev);
    ++idx;
  });

  // remove any extraneous DOM elements
  domClear(el, 1 + idx);
}

// Bind a scenegraph item to an SVG DOM element.
// Create new SVG elements as needed.
function bind(item, el, sibling, tag, svg) {
  let node = item._svg, doc;

  // create a new dom node if needed
  if (!node) {
    doc = el.ownerDocument;
    node = domCreate(doc, tag, ns);
    item._svg = node;

    if (item.mark) {
      node.__data__ = item;
      node.__values__ = {fill: 'default'};

      // if group, create background, content, and foreground elements
      if (tag === 'g') {
        const bg = domCreate(doc, 'path', ns);
        node.appendChild(bg);
        bg.__data__ = item;

        const cg = domCreate(doc, 'g', ns);
        node.appendChild(cg);
        cg.__data__ = item;

        const fg = domCreate(doc, 'path', ns);
        node.appendChild(fg);
        fg.__data__ = item;
        fg.__values__ = {fill: 'default'};
      }
    }
  }

  // (re-)insert if (a) not contained in SVG or (b) sibling order has changed
  if (node.ownerSVGElement !== svg || siblingCheck(node, sibling)) {
    el.insertBefore(node, sibling ? sibling.nextSibling : el.firstChild);
  }

  return node;
}

function siblingCheck(node, sibling) {
  return node.parentNode
    && node.parentNode.childNodes.length > 1
    && node.previousSibling != sibling; // treat null/undefined the same
}


// -- Set attributes & styles on SVG elements ---

var element = null, // temp var for current SVG element
    values = null;  // temp var for current values hash

// Extra configuration for certain mark types
var mark_extras = {
  group: function(mdef, el, item) {
    const fg = element = el.childNodes[2];
    values = fg.__values__;
    mdef.foreground(emit, item, this);

    values = el.__values__; // use parent's values hash
    element = el.childNodes[1];
    mdef.content(emit, item, this);

    const bg = element = el.childNodes[0];
    mdef.background(emit, item, this);

    const value = item.mark.interactive === false ? 'none' : null;
    if (value !== values.events) {
      setAttribute(fg, 'pointer-events', value);
      setAttribute(bg, 'pointer-events', value);
      values.events = value;
    }

    if (item.strokeForeground && item.stroke) {
      const fill = item.fill;
      setAttribute(fg, 'display', null);

      // set style of background
      this.style(bg, item);
      setAttribute(bg, 'stroke', null);

      // set style of foreground
      if (fill) item.fill = null;
      values = fg.__values__;
      this.style(fg, item);
      if (fill) item.fill = fill;

      // leave element null to prevent downstream styling
      element = null;
    } else {
      // ensure foreground is ignored
      setAttribute(fg, 'display', 'none');
    }
  },
  image: function(mdef, el, item) {
    if (item.smooth === false) {
      setStyle(el, 'image-rendering', 'optimizeSpeed');
      setStyle(el, 'image-rendering', 'pixelated');
    } else {
      setStyle(el, 'image-rendering', null);
    }
  },
  text: function(mdef, el, item) {
    let tl = textLines(item),
        key, value, doc, lh;

    if (isArray(tl)) {
      // multi-line text
      value = tl.map(_ => textValue(item, _));
      key = value.join('\n'); // content cache key

      if (key !== values.text) {
        domClear(el, 0);
        doc = el.ownerDocument;
        lh = lineHeight(item);
        value.forEach((t, i) => {
          const ts = domCreate(doc, 'tspan', ns);
          ts.__data__ = item; // data binding
          ts.textContent = t;
          if (i) {
            ts.setAttribute('x', 0);
            ts.setAttribute('dy', lh);
          }
          el.appendChild(ts);
        });
        values.text = key;
      }
    } else {
      // single-line text
      value = textValue(item, tl);
      if (value !== values.text) {
        el.textContent = value;
        values.text = value;
      }
    }

    setAttribute(el, 'font-family', fontFamily(item));
    setAttribute(el, 'font-size', fontSize(item) + 'px');
    setAttribute(el, 'font-style', item.fontStyle);
    setAttribute(el, 'font-variant', item.fontVariant);
    setAttribute(el, 'font-weight', item.fontWeight);
  }
};

function setStyle(el, name, value) {
  if (value !== values[name]) {
    if (value == null) {
      el.style.removeProperty(name);
    } else {
      el.style.setProperty(name, value + '');
    }
    values[name] = value;
  }
}

prototype._update = function(mdef, el, item) {
  // set dom element and values cache
  // provides access to emit method
  element = el;
  values = el.__values__;

  // apply aria-specific properties
  ariaItemAttributes(emit, item);

  // apply svg attributes
  mdef.attr(emit, item, this);

  // some marks need special treatment
  const extra = mark_extras[mdef.type];
  if (extra) extra.call(this, mdef, el, item);

  // apply svg style attributes
  // note: element may be modified by 'extra' method
  if (element) this.style(element, item);
};

function emit(name, value, ns) {
  // early exit if value is unchanged
  if (value === values[name]) return;

  // use appropriate method given namespace (ns)
  if (ns) {
    setAttributeNS(element, name, value, ns);
  } else {
    setAttribute(element, name, value);
  }

  // note current value for future comparison
  values[name] = value;
}

function setAttribute(el, name, value) {
  if (value != null) {
    // if value is provided, update DOM attribute
    el.setAttribute(name, value);
  } else {
    // else remove DOM attribute
    el.removeAttribute(name);
  }
}

function setAttributeNS(el, name, value, ns) {
  if (value != null) {
    // if value is provided, update DOM attribute
    el.setAttributeNS(ns, name, value);
  } else {
    // else remove DOM attribute
    el.removeAttributeNS(ns, name);
  }
}

prototype.style = function(el, o) {
  if (o == null) return;

  for (const prop in styles) {
    let value = prop === 'font' ? fontFamily(o) : o[prop];
    if (value === values[prop]) continue;

    const name = styles[prop];
    if (value == null) {
      el.removeAttribute(name);
    } else {
      if (isGradient(value)) {
        value = gradientRef(value, this._defs.gradient, href());
      }
      el.setAttribute(name, value + '');
    }

    values[prop] = value;
  }
};

function href() {
  let loc;
  return typeof window === 'undefined' ? ''
    : (loc = window.location).hash ? loc.href.slice(0, -loc.hash.length)
    : loc.href;
}
