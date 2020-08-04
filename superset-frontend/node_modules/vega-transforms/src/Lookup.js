import {Transform} from 'vega-dataflow';
import {accessorName, error, inherits} from 'vega-util';

/**
 * Extend tuples by joining them with values from a lookup table.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Map} params.index - The lookup table map.
 * @param {Array<function(object): *} params.fields - The fields to lookup.
 * @param {Array<string>} params.as - Output field names for each lookup value.
 * @param {*} [params.default] - A default value to use if lookup fails.
 */
export default function Lookup(params) {
  Transform.call(this, {}, params);
}

Lookup.Definition = {
  'type': 'Lookup',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'index', 'type': 'index', 'params': [
        {'name': 'from', 'type': 'data', 'required': true },
        {'name': 'key', 'type': 'field', 'required': true }
      ] },
    { 'name': 'values', 'type': 'field', 'array': true },
    { 'name': 'fields', 'type': 'field', 'array': true, 'required': true },
    { 'name': 'as', 'type': 'string', 'array': true },
    { 'name': 'default', 'default': null }
  ]
};

var prototype = inherits(Lookup, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse,
      as = _.as,
      keys = _.fields,
      index = _.index,
      values = _.values,
      defaultValue = _.default==null ? null : _.default,
      reset = _.modified(),
      flag = reset ? pulse.SOURCE : pulse.ADD,
      n = keys.length,
      set, m, mods;

  if (values) {
    m = values.length;

    if (n > 1 && !as) {
      error('Multi-field lookup requires explicit "as" parameter.');
    }
    if (as && as.length !== n * m) {
      error('The "as" parameter has too few output field names.');
    }
    as = as || values.map(accessorName);

    set = function(t) {
      for (var i=0, k=0, j, v; i<n; ++i) {
        v = index.get(keys[i](t));
        if (v == null) for (j=0; j<m; ++j, ++k) t[as[k]] = defaultValue;
        else for (j=0; j<m; ++j, ++k) t[as[k]] = values[j](v);
      }
    };
  } else {
    if (!as) {
      error('Missing output field names.');
    }

    set = function(t) {
      for (var i=0, v; i<n; ++i) {
        v = index.get(keys[i](t));
        t[as[i]] = v==null ? defaultValue : v;
      }
    };
  }

  if (reset) {
    out = pulse.reflow(true);
  } else {
    mods = keys.some(function(k) { return pulse.modified(k.fields); });
    flag |= (mods ? pulse.MOD : 0);
  }
  pulse.visit(flag, set);

  return out.modifies(as);
};
