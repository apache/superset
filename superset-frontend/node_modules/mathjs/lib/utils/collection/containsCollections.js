'use strict';

var isCollection = require('./isCollection');

/**
 * Test whether an array contains collections
 * @param {Array} array
 * @returns {boolean} Returns true when the array contains one or multiple
 *                    collections (Arrays or Matrices). Returns false otherwise.
 */
module.exports = function containsCollections (array) {
  for (var i = 0; i < array.length; i++) {
    if (isCollection(array[i])) {
      return true;
    }
  }
  return false;
};
