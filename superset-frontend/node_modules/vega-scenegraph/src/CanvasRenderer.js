import Renderer from './Renderer';
import Bounds from './Bounds';
import marks from './marks/index';

import {domClear} from './util/dom';
import clip from './util/canvas/clip';
import resize from './util/canvas/resize';
import {canvas} from 'vega-canvas';
import {error, inherits} from 'vega-util';

export default function CanvasRenderer(loader) {
  Renderer.call(this, loader);
  this._options = {};
  this._redraw = false;
  this._dirty = new Bounds();
  this._tempb = new Bounds();
}

const prototype = inherits(CanvasRenderer, Renderer),
      base = Renderer.prototype;

prototype.initialize = function(el, width, height, origin, scaleFactor, options) {
  this._options = options || {};

  this._canvas = this._options.externalContext
    ? null
    : canvas(1, 1, this._options.type); // instantiate a small canvas

  if (el && this._canvas) {
    domClear(el, 0).appendChild(this._canvas);
    this._canvas.setAttribute('class', 'marks');
  }

  // this method will invoke resize to size the canvas appropriately
  return base.initialize.call(this, el, width, height, origin, scaleFactor);
};

prototype.resize = function(width, height, origin, scaleFactor) {
  base.resize.call(this, width, height, origin, scaleFactor);

  if (this._canvas) {
    // configure canvas size and transform
    resize(this._canvas, this._width, this._height,
      this._origin, this._scale, this._options.context);
  } else {
    // external context needs to be scaled and positioned to origin
    const ctx = this._options.externalContext;
    if (!ctx) error('CanvasRenderer is missing a valid canvas or context');
    ctx.scale(this._scale, this._scale);
    ctx.translate(this._origin[0], this._origin[1]);
  }

  this._redraw = true;
  return this;
};

prototype.canvas = function() {
  return this._canvas;
};

prototype.context = function() {
  return this._options.externalContext
    || (this._canvas ? this._canvas.getContext('2d') : null);
};

prototype.dirty = function(item) {
  let b = this._tempb.clear().union(item.bounds),
      g = item.mark.group;

  while (g) {
    b.translate(g.x || 0, g.y || 0);
    g = g.mark.group;
  }

  this._dirty.union(b);
};

function clipToBounds(g, b, origin) {
  // expand bounds by 1 pixel, then round to pixel boundaries
  b.expand(1).round();

  // align to base pixel grid in case of non-integer scaling (#2425)
  if (g.pixelRatio % 1) {
    b.scale(g.pixelRatio).round().scale(1 / g.pixelRatio);
  }

  // to avoid artifacts translate if origin has fractional pixels
  b.translate(-(origin[0] % 1), -(origin[1] % 1));

  // set clip path
  g.beginPath();
  g.rect(b.x1, b.y1, b.width(), b.height());
  g.clip();

  return b;
}

const viewBounds = (origin, width, height) => new Bounds()
  .set(0, 0, width, height)
  .translate(-origin[0], -origin[1]);

prototype._render = function(scene) {
  const g = this.context(),
        o = this._origin,
        w = this._width,
        h = this._height,
        db = this._dirty,
        vb = viewBounds(o, w, h);

  // setup
  g.save();
  const b = this._redraw || db.empty()
    ? (this._redraw = false, vb.expand(1))
    : clipToBounds(g, vb.intersect(db), o);

  this.clear(-o[0], -o[1], w, h);

  // render
  this.draw(g, scene, b);

  // takedown
  g.restore();
  db.clear();

  return this;
};

prototype.draw = function(ctx, scene, bounds) {
  const mark = marks[scene.marktype];
  if (scene.clip) clip(ctx, scene);
  mark.draw.call(this, ctx, scene, bounds);
  if (scene.clip) ctx.restore();
};

prototype.clear = function(x, y, w, h) {
  const opt = this._options,
         g = this.context();

  if (opt.type !== 'pdf' && !opt.externalContext) {
    // calling clear rect voids vector output in pdf mode
    // and could remove external context content (#2615)
    g.clearRect(x, y, w, h);
  }

  if (this._bgcolor != null) {
    g.fillStyle = this._bgcolor;
    g.fillRect(x, y, w, h);
  }
};
