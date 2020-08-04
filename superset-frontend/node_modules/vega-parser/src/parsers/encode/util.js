import {extend, hasOwnProperty, isArray, isObject} from 'vega-util';

export const encoder = _ => isObject(_) && !isArray(_)
  ? extend({}, _)
  : {value: _};

export function addEncode(object, name, value, set) {
  if (value != null) {
    // Always assign signal to update, even if the signal is from the enter block
    if (isObject(value) && !isArray(value)) {
      object.update[name] = value;
    } else {
      object[set || 'enter'][name] = {value: value};
    }
    return 1;
  } else {
    return 0;
  }
}

export function addEncoders(object, enter, update) {
  for (const name in enter) {
    addEncode(object, name, enter[name]);
  }
  for (const name in update) {
    addEncode(object, name, update[name], 'update');
  }
}

export function extendEncode(encode, extra, skip) {
  for (const name in extra) {
    if (skip && hasOwnProperty(skip, name)) continue;
    encode[name] = extend(encode[name] || {}, extra[name]);
  }
  return encode;
}

export function has(key, encode) {
  return encode && (
    (encode.enter && encode.enter[key]) ||
    (encode.update && encode.update[key])
  );
}
