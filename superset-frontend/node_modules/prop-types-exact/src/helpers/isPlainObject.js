export default function isPlainObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}
