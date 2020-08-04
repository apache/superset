import {Transform} from 'vega-dataflow';
import {error, fastmap, inherits} from 'vega-util';

var Paths = fastmap({
  'line': line,
  'line-radial': lineR,
  'arc': arc,
  'arc-radial': arcR,
  'curve': curve,
  'curve-radial': curveR,
  'orthogonal-horizontal': orthoX,
  'orthogonal-vertical': orthoY,
  'orthogonal-radial': orthoR,
  'diagonal-horizontal': diagonalX,
  'diagonal-vertical': diagonalY,
  'diagonal-radial': diagonalR
});

function sourceX(t) { return t.source.x; }
function sourceY(t) { return t.source.y; }
function targetX(t) { return t.target.x; }
function targetY(t) { return t.target.y; }

 /**
  * Layout paths linking source and target elements.
  * @constructor
  * @param {object} params - The parameters for this operator.
  */
export default function LinkPath(params) {
  Transform.call(this, {}, params);
}

LinkPath.Definition = {
  'type': 'LinkPath',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'sourceX', 'type': 'field', 'default': 'source.x' },
    { 'name': 'sourceY', 'type': 'field', 'default': 'source.y' },
    { 'name': 'targetX', 'type': 'field', 'default': 'target.x' },
    { 'name': 'targetY', 'type': 'field', 'default': 'target.y' },
    { 'name': 'orient', 'type': 'enum', 'default': 'vertical',
      'values': ['horizontal', 'vertical', 'radial'] },
    { 'name': 'shape', 'type': 'enum', 'default': 'line',
      'values': ['line', 'arc', 'curve', 'diagonal', 'orthogonal'] },
    { 'name': 'require', 'type': 'signal' },
    { 'name': 'as', 'type': 'string', 'default': 'path' }
  ]
};

var prototype = inherits(LinkPath, Transform);

prototype.transform = function(_, pulse) {
  var sx = _.sourceX || sourceX,
      sy = _.sourceY || sourceY,
      tx = _.targetX || targetX,
      ty = _.targetY || targetY,
      as = _.as || 'path',
      orient = _.orient || 'vertical',
      shape = _.shape || 'line',
      path = Paths.get(shape + '-' + orient) || Paths.get(shape);

  if (!path) {
    error('LinkPath unsupported type: ' + _.shape
      + (_.orient ? '-' + _.orient : ''));
  }

  pulse.visit(pulse.SOURCE, function(t) {
    t[as] = path(sx(t), sy(t), tx(t), ty(t));
  });

  return pulse.reflow(_.modified()).modifies(as);
};

// -- Link Path Generation Methods -----

function line(sx, sy, tx, ty) {
  return 'M' + sx + ',' + sy +
         'L' + tx + ',' + ty;
}

function lineR(sa, sr, ta, tr) {
  return line(
    sr * Math.cos(sa), sr * Math.sin(sa),
    tr * Math.cos(ta), tr * Math.sin(ta)
  );
}

function arc(sx, sy, tx, ty) {
  var dx = tx - sx,
      dy = ty - sy,
      rr = Math.sqrt(dx * dx + dy * dy) / 2,
      ra = 180 * Math.atan2(dy, dx) / Math.PI;
  return 'M' + sx + ',' + sy +
         'A' + rr + ',' + rr +
         ' ' + ra + ' 0 1' +
         ' ' + tx + ',' + ty;
}

function arcR(sa, sr, ta, tr) {
  return arc(
    sr * Math.cos(sa), sr * Math.sin(sa),
    tr * Math.cos(ta), tr * Math.sin(ta)
  );
}

function curve(sx, sy, tx, ty) {
  var dx = tx - sx,
      dy = ty - sy,
      ix = 0.2 * (dx + dy),
      iy = 0.2 * (dy - dx);
  return 'M' + sx + ',' + sy +
         'C' + (sx+ix) + ',' + (sy+iy) +
         ' ' + (tx+iy) + ',' + (ty-ix) +
         ' ' + tx + ',' + ty;
}

function curveR(sa, sr, ta, tr) {
  return curve(
    sr * Math.cos(sa), sr * Math.sin(sa),
    tr * Math.cos(ta), tr * Math.sin(ta)
  );
}

function orthoX(sx, sy, tx, ty) {
  return 'M' + sx + ',' + sy +
         'V' + ty + 'H' + tx;
}

function orthoY(sx, sy, tx, ty) {
  return 'M' + sx + ',' + sy +
         'H' + tx + 'V' + ty;
}

function orthoR(sa, sr, ta, tr) {
  var sc = Math.cos(sa),
      ss = Math.sin(sa),
      tc = Math.cos(ta),
      ts = Math.sin(ta),
      sf = Math.abs(ta - sa) > Math.PI ? ta <= sa : ta > sa;
  return 'M' + (sr*sc) + ',' + (sr*ss) +
         'A' + sr + ',' + sr + ' 0 0,' + (sf?1:0) +
         ' ' + (sr*tc) + ',' + (sr*ts) +
         'L' + (tr*tc) + ',' + (tr*ts);
}

function diagonalX(sx, sy, tx, ty) {
  var m = (sx + tx) / 2;
  return 'M' + sx + ',' + sy +
         'C' + m  + ',' + sy +
         ' ' + m  + ',' + ty +
         ' ' + tx + ',' + ty;
}

function diagonalY(sx, sy, tx, ty) {
  var m = (sy + ty) / 2;
  return 'M' + sx + ',' + sy +
         'C' + sx + ',' + m +
         ' ' + tx + ',' + m +
         ' ' + tx + ',' + ty;
}

function diagonalR(sa, sr, ta, tr) {
  var sc = Math.cos(sa),
      ss = Math.sin(sa),
      tc = Math.cos(ta),
      ts = Math.sin(ta),
      mr = (sr + tr) / 2;
  return 'M' + (sr*sc) + ',' + (sr*ss) +
         'C' + (mr*sc) + ',' + (mr*ss) +
         ' ' + (mr*tc) + ',' + (mr*ts) +
         ' ' + (tr*tc) + ',' + (tr*ts);
}
