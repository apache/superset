import {hasOwnProperty} from 'vega-util';

export var transforms = {};

export function definition(type) {
  var t = transform(type);
  return t && t.Definition || null;
}

export function transform(type) {
  type = type && type.toLowerCase();
  return hasOwnProperty(transforms, type) ? transforms[type] : null;
}
