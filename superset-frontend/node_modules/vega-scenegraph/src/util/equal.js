import pathParse from '../path/parse';
import {isNumber, isObject} from 'vega-util';

var TOLERANCE = 1e-9;

export function sceneEqual(a, b, key) {
  return (a === b) ? true
    : (key === 'path') ? pathEqual(a, b)
    : (a instanceof Date && b instanceof Date) ? +a === +b
    : (isNumber(a) && isNumber(b)) ? Math.abs(a - b) <= TOLERANCE
    : (!a || !b || !isObject(a) && !isObject(b)) ? a == b
    : (a == null || b == null) ? false
    : objectEqual(a, b);
}

export function pathEqual(a, b) {
  return sceneEqual(pathParse(a), pathParse(b));
}

function objectEqual(a, b) {
  var ka = Object.keys(a),
      kb = Object.keys(b),
      key, i;

  if (ka.length !== kb.length) return false;

  ka.sort();
  kb.sort();

  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i]) return false;
  }

  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!sceneEqual(a[key], b[key], key)) return false;
  }

  return typeof a === typeof b;
}
