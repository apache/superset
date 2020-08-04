'use strict';

var flatten = require('../../utils/array').flatten;

function factory (type, config, load, typed) {
  var equal = load(require('../relational/equal'));
  var index = load(require('../../type/matrix/MatrixIndex'));
  var matrix = load(require('../../type/matrix/DenseMatrix'));
  var size = load(require('../matrix/size'));
  var subset = load(require('../matrix/subset'));
  var compareNatural = load(require('../relational/compareNatural'));
  
  /**
   * Collect the distinct elements of a multiset.
   * A multi-dimension array will be converted to a single-dimension array before the operation.
   *
   * Syntax:
   *
   *    math.setDistinct(set)
   *
   * Examples:
   *
   *    math.setDistinct([1, 1, 1, 2, 2, 3]);        // returns [1, 2, 3]
   *
   * See also:
   *
   *    setMultiplicity
   *
   * @param {Array | Matrix}    a  A multiset
   * @return {Array | Matrix}    A set containing the distinc elements of the multiset
   */
  var setDistinct = typed('setDistinct', {
    'Array | Matrix': function (a) {
      if (subset(size(a), new index(0)) === 0) { // if empty, return empty
        var result = [];
      }
      else {
        var b = flatten(Array.isArray(a) ? a : a.toArray()).sort(compareNatural);
        var result = [];
        result.push(b[0]);
        for (var i=1; i<b.length; i++) {
          if (!equal(b[i], b[i-1])) {
            result.push(b[i]);
          }
        }
      }
      // return an array, if the input was an array
      if (Array.isArray(a)) {
        return result;
      }
      // return a matrix otherwise
      return new matrix(result);
    }
  });

  return setDistinct;
}

exports.name = 'setDistinct';
exports.factory = factory;
