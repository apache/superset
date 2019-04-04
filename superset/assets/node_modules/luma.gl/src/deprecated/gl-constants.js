// WEBGL BUILT-IN CONSTANTS
import GL from '../constants';
import {getKeyValue, getKey, getKeyType} from '../webgl-utils/constants-to-keys';

export {GL};
export default GL;

// Resolve a WebGL enumeration name (returns itself if already a number)
export function glGet(name) {
  return getKeyValue(GL, name);
}

export function glKey(value) {
  return getKey(GL, value);
}

export function glKeyType(value) {
  return getKeyType(GL, value);
}
