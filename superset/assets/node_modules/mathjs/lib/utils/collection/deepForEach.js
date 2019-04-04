'use strict';

var isMatrix = require('./isMatrix');

/**
 * Recursively loop over all elements in a given multi dimensional array
 * and invoke the callback on each of the elements.
 * @param {Array | Matrix} array
 * @param {Function} callback     The callback method is invoked with one
 *                                parameter: the current element in the array
 */
module.exports = function deepForEach (array, callback) {
  if (isMatrix(array)) {
    array = array.valueOf();
  }

  for (var i = 0, ii = array.length; i < ii; i++) {
    var value = array[i];

    if (Array.isArray(value)) {
      deepForEach(value, callback);
    }
    else {
      callback(value);
    }
  }
};
