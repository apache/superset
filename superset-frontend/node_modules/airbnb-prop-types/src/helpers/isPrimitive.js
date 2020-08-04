export default function isPrimitive(x) {
  return !x || (typeof x !== 'object' && typeof x !== 'function');
}
