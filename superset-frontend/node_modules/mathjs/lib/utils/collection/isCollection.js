'use strict';

var isMatrix = require('./isMatrix');

/**
 * Test whether a value is a collection: an Array or Matrix
 * @param {*} x
 * @returns {boolean} isCollection
 */
module.exports = function isCollection (x) {
  return Array.isArray(x) || isMatrix(x);
};
