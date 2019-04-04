export default function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'viewport-mercator-project: assertion failed.');
  }
}
//# sourceMappingURL=assert.js.map