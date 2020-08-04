import cloud from './CloudLayout';
import {Transform} from 'vega-dataflow';
import {constant, error, extent, inherits, isFunction} from 'vega-util';
import {scale} from 'vega-scale';
import {random} from 'vega-statistics';

var Output = ['x', 'y', 'font', 'fontSize', 'fontStyle', 'fontWeight', 'angle'];

var Params = ['text', 'font', 'rotate', 'fontSize', 'fontStyle', 'fontWeight'];

export default function Wordcloud(params) {
  Transform.call(this, cloud(), params);
}

Wordcloud.Definition = {
  'type': 'Wordcloud',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'size', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'font', 'type': 'string', 'expr': true, 'default': 'sans-serif' },
    { 'name': 'fontStyle', 'type': 'string', 'expr': true, 'default': 'normal' },
    { 'name': 'fontWeight', 'type': 'string', 'expr': true, 'default': 'normal' },
    { 'name': 'fontSize', 'type': 'number', 'expr': true, 'default': 14 },
    { 'name': 'fontSizeRange', 'type': 'number', 'array': 'nullable', 'default': [10, 50] },
    { 'name': 'rotate', 'type': 'number', 'expr': true, 'default': 0 },
    { 'name': 'text', 'type': 'field' },
    { 'name': 'spiral', 'type': 'string', 'values': ['archimedean', 'rectangular'] },
    { 'name': 'padding', 'type': 'number', 'expr': true },
    { 'name': 'as', 'type': 'string', 'array': true, 'length': 7, 'default': Output }
  ]
};

var prototype = inherits(Wordcloud, Transform);

prototype.transform = function(_, pulse) {
  if (_.size && !(_.size[0] && _.size[1])) {
    error('Wordcloud size dimensions must be non-zero.');
  }

  function modp(param) {
    var p = _[param];
    return isFunction(p) && pulse.modified(p.fields);
  }

  var mod = _.modified();
  if (!(mod || pulse.changed(pulse.ADD_REM) || Params.some(modp))) return;

  var data = pulse.materialize(pulse.SOURCE).source,
      layout = this.value,
      as = _.as || Output,
      fontSize = _.fontSize || 14,
      range;

  isFunction(fontSize)
    ? (range = _.fontSizeRange)
    : (fontSize = constant(fontSize));

  // create font size scaling function as needed
  if (range) {
    var fsize = fontSize,
        sizeScale = scale('sqrt')()
          .domain(extent(data, fsize))
          .range(range);
    fontSize = function(x) { return sizeScale(fsize(x)); };
  }

  data.forEach(function(t) {
    t[as[0]] = NaN;
    t[as[1]] = NaN;
    t[as[3]] = 0;
  });

  // configure layout
  var words = layout
    .words(data)
    .text(_.text)
    .size(_.size || [500, 500])
    .padding(_.padding || 1)
    .spiral(_.spiral || 'archimedean')
    .rotate(_.rotate || 0)
    .font(_.font || 'sans-serif')
    .fontStyle(_.fontStyle || 'normal')
    .fontWeight(_.fontWeight || 'normal')
    .fontSize(fontSize)
    .random(random)
    .layout();

  var size = layout.size(),
      dx = size[0] >> 1,
      dy = size[1] >> 1,
      i = 0,
      n = words.length,
      w, t;

  for (; i<n; ++i) {
    w = words[i];
    t = w.datum;
    t[as[0]] = w.x + dx;
    t[as[1]] = w.y + dy;
    t[as[2]] = w.font;
    t[as[3]] = w.size;
    t[as[4]] = w.style;
    t[as[5]] = w.weight;
    t[as[6]] = w.rotate;
  }

  return pulse.reflow(mod).modifies(as);
};
