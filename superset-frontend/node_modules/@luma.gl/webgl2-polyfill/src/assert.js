export default function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'webgl2-polyfill: assertion failed.');
  }
}
