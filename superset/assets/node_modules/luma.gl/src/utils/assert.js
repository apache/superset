// Recommendation is to ignore message but current test suite checks agains the
// message so keep it for now.
export default function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'luma.gl: assertion failed.');
  }
}
