'use strict';

var deepMap = require('../../utils/collection/deepMap');
var number = require('../../utils/number');

function factory (type, config, load, typed) {
  /**
   * Test whether a value is an numeric value.
   *
   * The function is evaluated element-wise in case of Array or Matrix input.
   *
   * Syntax:
   *
   *     math.isNumeric(x)
   *
   * Examples:
   *
   *    math.isNumeric(2);                     // returns true
   *    math.isNumeric(0);                     // returns true
   *    math.isNumeric(math.bignumber(500));   // returns true
   *    math.isNumeric(math.fraction(4));      // returns true
   *    math.isNumeric(math.complex('2-4i');   // returns false
   *    math.isNumeric('3');                   // returns false
   *    math.isNumeric([2.3, 'foo', false]);   // returns [true, false, true]
   *
   * See also:
   *
   *    isZero, isPositive, isNegative, isInteger
   *
   * @param {*} x       Value to be tested
   * @return {boolean}  Returns true when `x` is a `number`, `BigNumber`,
   *                    `Fraction`, or `boolean`. Returns false for other types.
   *                    Throws an error in case of unknown types.
   */
  var isNumeric = typed('isNumeric', {
    'number | BigNumber | Fraction | boolean': function () {
      return true;
    },

    'Complex | Unit | string': function () {
      return false;
    },

    'Array | Matrix': function (x) {
      return deepMap(x, isNumeric);
    }
  });

  return isNumeric;
}

exports.name = 'isNumeric';
exports.factory = factory;
