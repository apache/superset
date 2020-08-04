import {isObject} from 'vega-util';

export function Entry(type, value, params, parent) {
  this.id = -1;
  this.type = type;
  this.value = value;
  this.params = params;
  if (parent) this.parent = parent;
}

export function entry(type, value, params, parent) {
  return new Entry(type, value, params, parent);
}

export function operator(value, params) {
  return entry('operator', value, params);
}

// -----

export function ref(op) {
  var ref = {$ref: op.id};
  // if operator not yet registered, cache ref to resolve later
  if (op.id < 0) (op.refs = op.refs || []).push(ref);
  return ref;
}

export var tupleidRef = {
  $tupleid: 1,
  toString: function() { return ':_tupleid_:'; }
};

export function fieldRef(field, name) {
  return name ? {$field: field, $name: name} : {$field: field};
}

export var keyFieldRef = fieldRef('key');

export function compareRef(fields, orders) {
  return {$compare: fields, $order: orders};
}

export function keyRef(fields, flat) {
  var ref = {$key: fields};
  if (flat) ref.$flat = true;
  return ref;
}

// -----

export var Ascending  = 'ascending';

export var Descending = 'descending';

export function sortKey(sort) {
  return !isObject(sort) ? ''
    : (sort.order === Descending ? '-' : '+')
      + aggrField(sort.op, sort.field);
}

export function aggrField(op, field) {
  return (op && op.signal ? '$' + op.signal : op || '')
    + (op && field ? '_' : '')
    + (field && field.signal ? '$' + field.signal : field || '');
}

// -----

export var Scope = 'scope';

export var View = 'view';

export function isSignal(_) {
  return _ && _.signal;
}

export function isExpr(_) {
  return _ && _.expr;
}

export function hasSignal(_) {
  if (isSignal(_)) return true;
  if (isObject(_)) for (var key in _) {
    if (hasSignal(_[key])) return true;
  }
  return false;
}

export function value(specValue, defaultValue) {
  return specValue != null ? specValue : defaultValue;
}

export function deref(v) {
  return v && v.signal || v;
}
