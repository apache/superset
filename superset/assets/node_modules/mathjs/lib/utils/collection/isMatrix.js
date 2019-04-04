'use strict';

/**
 * Test whether a value is a Matrix
 * @param {*} x
 * @returns {boolean} returns true with input is a Matrix
 *                    (like a DenseMatrix or SparseMatrix)
 */
module.exports = function isMatrix (x) {
  return x && x.constructor.prototype.isMatrix || false;
};
