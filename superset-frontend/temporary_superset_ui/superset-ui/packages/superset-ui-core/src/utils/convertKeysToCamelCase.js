import camelCase from 'lodash/fp/camelCase';
import isPlainObject from 'lodash/fp/isPlainObject';
import mapKeys from 'lodash/fp/mapKeys';

export default function convertKeysToCamelCase(object) {
  if (object === null || object === undefined) {
    return object;
  }
  if (isPlainObject(object)) {
    return mapKeys(k => camelCase(k), object);
  }
  throw new Error(`Cannot convert input that is not a plain object: ${object}`);
}
