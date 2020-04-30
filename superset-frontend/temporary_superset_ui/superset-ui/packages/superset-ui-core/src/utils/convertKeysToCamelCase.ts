import camelCase from 'lodash/camelCase';
import isPlainObject from 'lodash/isPlainObject';
import mapKeys from 'lodash/mapKeys';

export default function convertKeysToCamelCase<T>(object: T) {
  if (object === null || object === undefined) {
    return object;
  }
  if (isPlainObject(object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapKeys(object as { [key: string]: any }, (_, k) => camelCase(k)) as T;
  }
  throw new Error(`Cannot convert input that is not a plain object: ${object}`);
}
