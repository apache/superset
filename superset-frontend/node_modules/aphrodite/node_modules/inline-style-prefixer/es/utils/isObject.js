export default function isObject(value) {
  return value instanceof Object && !Array.isArray(value);
}