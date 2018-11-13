import camelCase from 'lodash/camelCase';
import isPlainObject from 'lodash/isPlainObject';
import mapKeys from 'lodash/mapKeys';

export default function convertKeysToCamelCase(object) {
  if (object === null || object === undefined) {
    return object;
  }
  if (isPlainObject(object)) {
    return mapKeys(object, (_, k) => camelCase(k));
  }
  throw new Error(`Cannot convert input that is not a plain object: ${object}`);
}
