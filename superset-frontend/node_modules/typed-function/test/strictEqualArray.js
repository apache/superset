var assert = require('assert');

/**
 * Test strict equality of all elements in two arrays.
 * @param {Array} a
 * @param {Array} b
 */
module.exports = function strictEqualArray(a, b) {
  assert.strictEqual(a.length, b.length);

  for (var i = 0; i < a.length; a++) {
    assert.strictEqual(a[i], b[i]);
  }
};
