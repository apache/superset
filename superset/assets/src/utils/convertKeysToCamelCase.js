import { mapKeys, camelCase } from 'lodash/fp';

export default function convertKeysToCamelCase(object) {
  return mapKeys(k => camelCase(k), object);
}
