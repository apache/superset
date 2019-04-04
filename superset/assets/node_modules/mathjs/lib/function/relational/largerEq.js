'use strict';

var nearlyEqual = require('../../utils/number').nearlyEqual;
var bigNearlyEqual = require('../../utils/bignumber/nearlyEqual');

function factory (type, config, load, typed) {
  
  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm03 = load(require('../../type/matrix/utils/algorithm03'));
  var algorithm07 = load(require('../../type/matrix/utils/algorithm07'));
  var algorithm12 = load(require('../../type/matrix/utils/algorithm12'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  var latex = require('../../utils/latex');

  /**
   * Test whether value x is larger or equal to y.
   *
   * The function returns true when x is larger than y or the relative
   * difference between x and y is smaller than the configured epsilon. The
   * function cannot be used to compare values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.largerEq(x, y)
   *
   * Examples:
   *
   *    math.larger(2, 1 + 1);         // returns false
   *    math.largerEq(2, 1 + 1);       // returns true
   *
   * See also:
   *
   *    equal, unequal, smaller, smallerEq, larger, compare
   *
   * @param  {number | BigNumber | Fraction | boolean | Unit | string | Array | Matrix} x First value to compare
   * @param  {number | BigNumber | Fraction | boolean | Unit | string | Array | Matrix} y Second value to compare
   * @return {boolean | Array | Matrix} Returns true when the x is larger or equal to y, else returns false
   */
  var largerEq = typed('largerEq', {

    'boolean, boolean': function (x, y) {
      return x >= y;
    },

    'number, number': function (x, y) {
      return x >= y || nearlyEqual(x, y, config.epsilon);
    },

    'BigNumber, BigNumber': function (x, y) {
      return x.gte(y) || bigNearlyEqual(x, y, config.epsilon);
    },

    'Fraction, Fraction': function (x, y) {
      return x.compare(y) !== -1;
    },

    'Complex, Complex': function () {
      throw new TypeError('No ordering relation is defined for complex numbers');
    },

    'Unit, Unit': function (x, y) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return largerEq(x.value, y.value);
    },

    'string, string': function (x, y) {
      return x >= y;
    },

    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse + sparse
              c = algorithm07(x, y, largerEq);
              break;
            default:
              // sparse + dense
              c = algorithm03(y, x, largerEq, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense + sparse
              c = algorithm03(x, y, largerEq, false);
              break;
            default:
              // dense + dense
              c = algorithm13(x, y, largerEq);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return largerEq(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return largerEq(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return largerEq(x, matrix(y));
    },

    'Matrix, any': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm12(x, y, largerEq, false);
          break;
        default:
          c = algorithm14(x, y, largerEq, false);
          break;
      }
      return c;
    },

    'any, Matrix': function (x, y) {
      // result
      var c;
      // check storage format
      switch (y.storage()) {
        case 'sparse':
          c = algorithm12(y, x, largerEq, true);
          break;
        default:
          c = algorithm14(y, x, largerEq, true);
          break;
      }
      return c;
    },

    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, largerEq, false).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, largerEq, true).valueOf();
    }
  });

  largerEq.toTex = {
    2: '\\left(${args[0]}' + latex.operators['largerEq'] + '${args[1]}\\right)'
  };

  return largerEq;
}

exports.name = 'largerEq';
exports.factory = factory;
