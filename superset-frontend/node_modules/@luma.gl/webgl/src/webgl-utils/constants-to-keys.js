import {assert} from '../utils';

// Resolve a WebGL enumeration name (returns itself if already a number)
export function getKeyValue(gl, name) {
  // If not a string, return (assume number)
  if (typeof name !== 'string') {
    return name;
  }

  // If string converts to number, return number
  const number = Number(name);
  if (!isNaN(number)) {
    return number;
  }

  // Look up string, after removing any 'GL.' or 'gl.' prefix
  name = name.replace(/^.*\./, '');
  const value = gl[name];
  assert(value !== undefined, `Accessing undefined constant GL.${name}`);
  return value;
}

export function getKey(gl, value) {
  value = Number(value);
  for (const key in gl) {
    if (gl[key] === value) {
      return `GL.${key}`;
    }
  }
  return String(value);
}

export function getKeyType(gl, value) {
  assert(value !== undefined, 'undefined key');
  value = Number(value);
  for (const key in gl) {
    if (gl[key] === value) {
      return `GL.${key}`;
    }
  }
  return String(value);
}
