import {Transform, ingest} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Count regexp-defined pattern occurrences in a text field.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - An accessor for the text field.
 * @param {string} [params.pattern] - RegExp string defining the text pattern.
 * @param {string} [params.case] - One of 'lower', 'upper' or null (mixed) case.
 * @param {string} [params.stopwords] - RegExp string of words to ignore.
 */
export default function CountPattern(params) {
  Transform.call(this, null, params);
}

CountPattern.Definition = {
  'type': 'CountPattern',
  'metadata': {'generates': true, 'changes': true},
  'params': [
    { 'name': 'field', 'type': 'field', 'required': true },
    { 'name': 'case', 'type': 'enum', 'values': ['upper', 'lower', 'mixed'], 'default': 'mixed' },
    { 'name': 'pattern', 'type': 'string', 'default': '[\\w"]+' },
    { 'name': 'stopwords', 'type': 'string', 'default': '' },
    { 'name': 'as', 'type': 'string', 'array': true, 'length': 2, 'default': ['text', 'count'] }
  ]
};

function tokenize(text, tcase, match) {
  switch (tcase) {
    case 'upper': text = text.toUpperCase(); break;
    case 'lower': text = text.toLowerCase(); break;
  }
  return text.match(match);
}

var prototype = inherits(CountPattern, Transform);

prototype.transform = function(_, pulse) {
  function process(update) {
    return function(tuple) {
      var tokens = tokenize(get(tuple), _.case, match) || [], t;
      for (var i=0, n=tokens.length; i<n; ++i) {
        if (!stop.test(t = tokens[i])) update(t);
      }
    };
  }

  var init = this._parameterCheck(_, pulse),
      counts = this._counts,
      match = this._match,
      stop = this._stop,
      get = _.field,
      as = _.as || ['text', 'count'],
      add = process(function(t) { counts[t] = 1 + (counts[t] || 0); }),
      rem = process(function(t) { counts[t] -= 1; });

  if (init) {
    pulse.visit(pulse.SOURCE, add);
  } else {
    pulse.visit(pulse.ADD, add);
    pulse.visit(pulse.REM, rem);
  }

  return this._finish(pulse, as); // generate output tuples
};

prototype._parameterCheck = function(_, pulse) {
  var init = false;

  if (_.modified('stopwords') || !this._stop) {
    this._stop = new RegExp('^' + (_.stopwords || '') + '$', 'i');
    init = true;
  }

  if (_.modified('pattern') || !this._match) {
    this._match = new RegExp((_.pattern || '[\\w\']+'), 'g');
    init = true;
  }

  if (_.modified('field') || pulse.modified(_.field.fields)) {
    init = true;
  }

  if (init) this._counts = {};
  return init;
};

prototype._finish = function(pulse, as) {
  var counts = this._counts,
      tuples = this._tuples || (this._tuples = {}),
      text = as[0],
      count = as[1],
      out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS),
      w, t, c;

  for (w in counts) {
    t = tuples[w];
    c = counts[w] || 0;
    if (!t && c) {
      tuples[w] = (t = ingest({}));
      t[text] = w;
      t[count] = c;
      out.add.push(t);
    } else if (c === 0) {
      if (t) out.rem.push(t);
      counts[w] = null;
      tuples[w] = null;
    } else if (t[count] !== c) {
      t[count] = c;
      out.mod.push(t);
    }
  }

  return out.modifies(as);
};
