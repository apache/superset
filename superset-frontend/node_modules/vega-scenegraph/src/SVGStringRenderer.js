import Renderer from './Renderer';
import {gradientRef, isGradient, patternPrefix} from './Gradient';
import marks from './marks/index';
import {ariaItemAttributes, ariaMarkAttributes} from './util/aria';
import {cssClass} from './util/dom';
import {closeTag, openTag} from './util/tags';
import {fontFamily, fontSize, lineHeight, textLines, textValue} from './util/text';
import {visit} from './util/visit';
import clip from './util/svg/clip';
import metadata from './util/svg/metadata';
import {rootAttributes, styles} from './util/svg/styles';
import {extend, inherits, isArray} from 'vega-util';

export default function SVGStringRenderer(loader) {
  Renderer.call(this, loader);

  this._text = {
    head: '',
    bg:   '',
    root: '',
    foot: '',
    defs: '',
    body: ''
  };

  this._defs = {
    gradient: {},
    clipping: {}
  };
}

var prototype = inherits(SVGStringRenderer, Renderer);
var base = Renderer.prototype;

prototype.resize = function(width, height, origin, scaleFactor) {
  base.resize.call(this, width, height, origin, scaleFactor);
  var o = this._origin,
      t = this._text;

  var attr = {
    class:   'marks',
    width:   this._width * this._scale,
    height:  this._height * this._scale,
    viewBox: '0 0 ' + this._width + ' ' + this._height
  };
  for (var key in metadata) {
    attr[key] = metadata[key];
  }

  t.head = openTag('svg', attr);

  var bg = this._bgcolor;
  if (bg === 'transparent' || bg === 'none') bg = null;

  if (bg) {
    t.bg = openTag('rect', {
      width:  this._width,
      height: this._height,
      fill:   bg
    }) + closeTag('rect');
  } else {
    t.bg = '';
  }

  t.root = openTag('g', extend(
    {}, rootAttributes, {transform: 'translate(' + o + ')'}
  ));

  t.foot = closeTag('g') + closeTag('svg');

  return this;
};

prototype.background = function() {
  var rv = base.background.apply(this, arguments);
  if (arguments.length && this._text.head) {
    this.resize(this._width, this._height, this._origin, this._scale);
  }
  return rv;
};

prototype.svg = function() {
  var t = this._text;
  return t.head + t.defs + t.bg + t.root + t.body + t.foot;
};

prototype._render = function(scene) {
  this._text.body = this.mark(scene);
  this._text.defs = this.buildDefs();
  return this;
};

prototype.buildDefs = function() {
  let defs = '', tag;

  for (const id in this._defs.gradient) {
    const def = this._defs.gradient[id],
          stops = def.stops;

    if (def.gradient === 'radial') {
      // SVG radial gradients automatically transform to normalized bbox
      // coordinates, in a way that is cumbersome to replicate in canvas.
      // We wrap the radial gradient in a pattern element, allowing us to
      // maintain a circular gradient that matches what canvas provides.

      defs += openTag(tag = 'pattern', {
        id: patternPrefix + id,
        viewBox: '0,0,1,1',
        width: '100%',
        height: '100%',
        preserveAspectRatio: 'xMidYMid slice'
      });

      defs += openTag('rect', {
        width:  '1',
        height: '1',
        fill:   'url(#' + id + ')'
      }) + closeTag('rect');

      defs += closeTag(tag);

      defs += openTag(tag = 'radialGradient', {
        id: id,
        fx: def.x1,
        fy: def.y1,
        fr: def.r1,
        cx: def.x2,
        cy: def.y2,
         r: def.r2
      });
    } else {
      defs += openTag(tag = 'linearGradient', {
        id: id,
        x1: def.x1,
        x2: def.x2,
        y1: def.y1,
        y2: def.y2
      });
    }

    for (let i = 0; i < stops.length; ++i) {
      defs += openTag('stop', {
        offset: stops[i].offset,
        'stop-color': stops[i].color
      }) + closeTag('stop');
    }

    defs += closeTag(tag);
  }

  for (const id in this._defs.clipping) {
    const def = this._defs.clipping[id];

    defs += openTag('clipPath', {id: id});

    if (def.path) {
      defs += openTag('path', {
        d: def.path
      }) + closeTag('path');
    } else {
      defs += openTag('rect', {
        x: 0,
        y: 0,
        width: def.width,
        height: def.height
      }) + closeTag('rect');
    }

    defs += closeTag('clipPath');
  }

  return defs ? (openTag('defs') + defs + closeTag('defs')) : '';
};

prototype.attr = function(scene, item, attrs, tag) {
  const object = {},
        emit = (name, value, ns, prefixed) => {
          object[prefixed || name] = value;
        };

  // apply mark specific attributes
  if (Array.isArray(attrs)) {
    attrs.forEach(fn => fn(emit, item, this));
  } else {
    attrs(emit, item, this);
  }

  // apply style attributes
  if (tag) {
    applyStyles(object, item, scene, tag, this._defs);
  }

  return object;
};

prototype.href = function(item) {
  var that = this,
      href = item.href,
      attr;

  if (href) {
    if (attr = that._hrefs && that._hrefs[href]) {
      return attr;
    } else {
      that.sanitizeURL(href).then(attr => {
        // rewrite to use xlink namespace
        // note that this will be deprecated in SVG 2.0
        attr['xlink:href'] = attr.href;
        attr.href = null;
        (that._hrefs || (that._hrefs = {}))[href] = attr;
      });
    }
  }
  return null;
};

prototype.mark = function(scene) {
  const mdef = marks[scene.marktype],
        tag  = mdef.tag,
        attrList = [ariaItemAttributes, mdef.attr];

  let str = '';

  // render opening group tag
  str += openTag('g', extend(
    {
      'class': cssClass(scene),
      'clip-path': scene.clip ? clip(this, scene, scene.group) : null
    },
    ariaMarkAttributes(scene),
    {
      'pointer-events': tag !== 'g' && scene.interactive === false ? 'none' : null
    }
  ));

  // render contained elements
  const process = item => {
    const href = this.href(item);
    if (href) str += openTag('a', href);

    str += openTag(
      tag,
      this.attr(scene, item, attrList, tag !== 'g' ? tag : null)
    );

    if (tag === 'text') {
      const tl = textLines(item);
      if (isArray(tl)) {
        // multi-line text
        const attrs = {x: 0, dy: lineHeight(item)};
        for (let i=0; i<tl.length; ++i) {
          str += openTag('tspan', i ? attrs: null)
            + escape_text(textValue(item, tl[i]))
            + closeTag('tspan');
        }
      } else {
        // single-line text
        str += escape_text(textValue(item, tl));
      }
    } else if (tag === 'g') {
      const fore = item.strokeForeground,
            fill = item.fill,
            stroke = item.stroke;

      if (fore && stroke) {
        item.stroke = null;
      }

      str += openTag(
        'path',
        this.attr(scene, item, mdef.background, 'bgrect')
      ) + closeTag('path');

      str += openTag('g', this.attr(scene, item, mdef.content))
        + this.markGroup(item)
        + closeTag('g');

      if (fore && stroke) {
        if (fill) item.fill = null;
        item.stroke = stroke;

        str += openTag(
          'path',
          this.attr(scene, item, mdef.foreground, 'bgrect')
        ) + closeTag('path');

        if (fill) item.fill = fill;
      } else {
        str += openTag(
          'path',
          this.attr(scene, item, mdef.foreground, 'bgfore')
        ) + closeTag('path');
      }
    }

    str += closeTag(tag);
    if (href) str += closeTag('a');
  };

  if (mdef.nested) {
    if (scene.items && scene.items.length) process(scene.items[0]);
  } else {
    visit(scene, process);
  }

  // render closing group tag
  return str + closeTag('g');
};

prototype.markGroup = function(scene) {
  let str = '';
  visit(scene, item => { str += this.mark(item); });
  return str;
};

function applyStyles(s, item, scene, tag, defs) {
  if (item == null) return s;

  if (tag === 'bgrect' && scene.interactive === false) {
    s['pointer-events'] = 'none';
  }

  if (tag === 'bgfore') {
    if (scene.interactive === false) {
      s['pointer-events'] = 'none';
    }
    s.display = 'none';
    if (item.fill !== null) return s;
  }

  if (tag === 'image' && item.smooth === false) {
    s.style = 'image-rendering: optimizeSpeed; image-rendering: pixelated;';
  }

  if (tag === 'text') {
    s['font-family'] = fontFamily(item);
    s['font-size'] = fontSize(item) + 'px';
    if (item.fontStyle) s['font-style'] = item.fontStyle;
    if (item.fontVariant) s['font-variant'] = item.fontVariant;
    if (item.fontWeight) s['font-weight'] = item.fontWeight;
  }

  for (const prop in styles) {
    let value = item[prop];
    const name = styles[prop];

    if (value === 'transparent' && (name === 'fill' || name === 'stroke')) {
      // transparent is not a legal SVG value
      // we can skip it to rely on default 'none' instead
    } else if (value != null) {
      if (isGradient(value)) {
        value = gradientRef(value, defs.gradient, '');
      }
      s[name] = value;
    }
  }

  return s;
}

function escape_text(s) {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
}
