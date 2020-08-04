import curves from './curves';
import symbols from './symbols';

import {default as vg_rect} from './rectangle';
import {default as vg_trail} from './trail';

import {
  arc as d3_arc,
  area as d3_area,
  line as d3_line,
  symbol as d3_symbol
} from 'd3-shape';

function value(a, b) {
  return a != null ? a : b;
}

const x =  item => item.x || 0,
      y =  item => item.y || 0,
      w =  item => item.width || 0,
      h =  item => item.height || 0,
      xw = item => (item.x || 0) + (item.width || 0),
      yh = item => (item.y || 0) + (item.height || 0),
      sa = item => item.startAngle || 0,
      ea = item => item.endAngle || 0,
      pa = item => item.padAngle || 0,
      ir = item => item.innerRadius || 0,
      or = item => item.outerRadius || 0,
      cr = item => item.cornerRadius || 0,
      tl = item => value(item.cornerRadiusTopLeft, item.cornerRadius) || 0,
      tr = item => value(item.cornerRadiusTopRight, item.cornerRadius) || 0,
      br = item => value(item.cornerRadiusBottomRight, item.cornerRadius) || 0,
      bl = item => value(item.cornerRadiusBottomLeft, item.cornerRadius) || 0,
      sz = item => value(item.size, 64),
      ts = item => item.size || 1,
      def = item => !(item.defined === false),
      type = item => symbols(item.shape || 'circle');

const arcShape    = d3_arc().startAngle(sa).endAngle(ea).padAngle(pa)
                      .innerRadius(ir).outerRadius(or).cornerRadius(cr),
      areavShape  = d3_area().x(x).y1(y).y0(yh).defined(def),
      areahShape  = d3_area().y(y).x1(x).x0(xw).defined(def),
      lineShape   = d3_line().x(x).y(y).defined(def),
      rectShape   = vg_rect().x(x).y(y).width(w).height(h)
                      .cornerRadius(tl, tr, br, bl),
      symbolShape = d3_symbol().type(type).size(sz),
      trailShape  = vg_trail().x(x).y(y).defined(def).size(ts);

export function hasCornerRadius(item) {
  return item.cornerRadius
    || item.cornerRadiusTopLeft
    || item.cornerRadiusTopRight
    || item.cornerRadiusBottomRight
    || item.cornerRadiusBottomLeft;
}

export function arc(context, item) {
  return arcShape.context(context)(item);
}

export function area(context, items) {
  var item = items[0],
      interp = item.interpolate || 'linear';
  return (item.orient === 'horizontal' ? areahShape : areavShape)
    .curve(curves(interp, item.orient, item.tension))
    .context(context)(items);
}

export function line(context, items) {
  var item = items[0],
      interp = item.interpolate || 'linear';
  return lineShape.curve(curves(interp, item.orient, item.tension))
    .context(context)(items);
}

export function rectangle(context, item, x, y) {
  return rectShape.context(context)(item, x, y);
}

export function shape(context, item) {
  return (item.mark.shape || item.shape)
    .context(context)(item);
}

export function symbol(context, item) {
  return symbolShape.context(context)(item);
}

export function trail(context, items) {
  return trailShape.context(context)(items);
}
