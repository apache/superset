'use strict';

var flatten = require('../../utils/array').flatten;
var identify = require('../../utils/array').identify;

function factory (type, config, load, typed) {
  var equal = load(require('../relational/equal'));
  var index = load(require('../../type/matrix/MatrixIndex'));
  var size = load(require('../matrix/size'));
  var subset = load(require('../matrix/subset'));
  var compareNatural = load(require('../relational/compareNatural'));
  
  /**
   * Check whether a (multi)set is a subset of another (multi)set. (Every element of set1 is the element of set2.)
   * Multi-dimension arrays will be converted to single-dimension arrays before the operation.
   *
   * Syntax:
   *
   *    math.setIsSubset(set1, set2)
   *
   * Examples:
   *
   *    math.setIsSubset([1, 2], [3, 4, 5, 6]);        // returns false
   *    math.setIsSubset([3, 4], [3, 4, 5, 6]);        // returns true
   *
   * See also:
   *
   *    setUnion, setIntersect, setDifference
   *
   * @param {Array | Matrix}    a1  A (multi)set
   * @param {Array | Matrix}    a2  A (multi)set
   * @return {boolean}            true | false
   */
  var setIsSubset = typed('setIsSubset', {
    'Array | Matrix, Array | Matrix': function (a1, a2) {
      if (subset(size(a1), new index(0)) === 0) { // empty is a subset of anything
        return true;
      }
      else if (subset(size(a2), new index(0)) === 0) { // anything is not a subset of empty
        return false;
      }
      var b1 = identify(flatten(Array.isArray(a1) ? a1 : a1.toArray()).sort(compareNatural));
      var b2 = identify(flatten(Array.isArray(a2) ? a2 : a2.toArray()).sort(compareNatural));
      var inb2;
      for (var i=0; i<b1.length; i++) {
        inb2 = false;
        for (var j=0; j<b2.length; j++) {
          if (equal(b1[i].value, b2[j].value) && b1[i].identifier === b2[j].identifier) { // the identifier is always a decimal int
            inb2 = true;
            break;
          }
        }
        if (inb2 === false) {
          return false;
        }
      }
      return true;
    }
  });

  return setIsSubset;
}

exports.name = 'setIsSubset';
exports.factory = factory;
