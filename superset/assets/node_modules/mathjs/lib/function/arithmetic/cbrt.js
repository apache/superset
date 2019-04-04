'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  var unaryMinus = load(require('./unaryMinus'));
  var isNegative = load(require('../utils/isNegative'));
  var matrix = load(require('../../type/matrix/function/matrix'));

  /**
   * Calculate the cubic root of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.cbrt(x)
   *    math.cbrt(x, allRoots)
   *
   * Examples:
   *
   *    math.cbrt(27);                  // returns 3
   *    math.cube(3);                   // returns 27
   *    math.cbrt(-64);                 // returns -4
   *    math.cbrt(math.unit('27 m^3')); // returns Unit 3 m
   *    math.cbrt([27, 64, 125]);       // returns [3, 4, 5]
   *
   *    var x = math.complex('8i');
   *    math.cbrt(x);                   // returns Complex 1.7320508075689 + i
   *    math.cbrt(x, true);             // returns Matrix [
   *                                    //    1.7320508075689 + i
   *                                    //   -1.7320508075689 + i
   *                                    //   -2i
   *                                    // ]
   *
   * See also:
   *
   *    square, sqrt, cube
   *
   * @param {number | BigNumber | Complex | Unit | Array | Matrix} x
   *            Value for which to calculate the cubic root.
   * @param {boolean} [allRoots]  Optional, false by default. Only applicable
   *            when `x` is a number or complex number. If true, all complex
   *            roots are returned, if false (default) the principal root is
   *            returned.
   * @return {number | BigNumber | Complex | Unit | Array | Matrix}
   *            Returns the cubic root of `x`
   */
  var cbrt = typed('cbrt', {
    'number': _cbrtNumber,
    // note: signature 'number, boolean' is also supported,
    //       created by typed as it knows how to convert number to Complex

    'Complex': _cbrtComplex,

    'Complex, boolean': _cbrtComplex,

    'BigNumber': function (x) {
      return x.cbrt();
    },

    'Unit': _cbrtUnit,

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since cbrt(0) = 0
      return deepMap(x, cbrt, true);
    }
  });

  /**
   * Calculate the cubic root for a complex number
   * @param {Complex} x
   * @param {boolean} [allRoots]   If true, the function will return an array
   *                               with all three roots. If false or undefined,
   *                               the principal root is returned.
   * @returns {Complex | Array.<Complex> | Matrix.<Complex>} Returns the cubic root(s) of x
   * @private
   */
  function _cbrtComplex(x, allRoots) {
    // https://www.wikiwand.com/en/Cube_root#/Complex_numbers

    var arg_3 = x.arg() / 3;
    var abs = x.abs();

    // principal root:
    var principal = new type.Complex(_cbrtNumber(abs), 0).mul(
        new type.Complex(0, arg_3).exp());

    if (allRoots) {
      var all = [
          principal,
          new type.Complex(_cbrtNumber(abs), 0).mul(
            new type.Complex(0, arg_3 + Math.PI * 2 / 3).exp()),
          new type.Complex(_cbrtNumber(abs), 0).mul(
            new type.Complex(0, arg_3 - Math.PI * 2 / 3).exp())
      ];

      return (config.matrix === 'Array') ? all : matrix(all);
    }
    else {
      return principal;
    }
  }

  /**
   * Calculate the cubic root for a Unit
   * @param {Unit} x
   * @return {Unit} Returns the cubic root of x
   * @private
   */
  function _cbrtUnit(x) {
    if(x.value && type.isComplex(x.value)) {
      var result = x.clone();
      result.value = 1.0;
      result = result.pow(1.0/3);           // Compute the units
      result.value = _cbrtComplex(x.value); // Compute the value
      return result;
    }
    else {
      var negate = isNegative(x.value);
      if (negate) {
        x.value = unaryMinus(x.value);
      }

      // TODO: create a helper function for this
      var third;
      if (type.isBigNumber(x.value)) {
        third = new type.BigNumber(1).div(3);
      }
      else if (type.isFraction(x.value)) {
        third = new type.Fraction(1, 3);
      }
      else {
        third = 1/3;
      }

      var result = x.pow(third);

      if (negate) {
        result.value = unaryMinus(result.value);
      }

      return result;
    }
  }

  cbrt.toTex = {1: '\\sqrt[3]{${args[0]}}'};

  return cbrt;
}

/**
 * Calculate cbrt for a number
 *
 * Code from es6-shim.js:
 *   https://github.com/paulmillr/es6-shim/blob/master/es6-shim.js#L1564-L1577
 *
 * @param {number} x
 * @returns {number | Complex} Returns the cubic root of x
 * @private
 */
var _cbrtNumber = Math.cbrt || function (x) {
  if (x === 0) {
    return x;
  }

  var negate = x < 0;
  var result;
  if (negate) {
    x = -x;
  }

  if (isFinite(x)) {
    result = Math.exp(Math.log(x) / 3);
    // from http://en.wikipedia.org/wiki/Cube_root#Numerical_methods
    result = (x / (result * result) + (2 * result)) / 3;
  } else {
    result = x;
  }

  return negate ? -result : result;
};

exports.name = 'cbrt';
exports.factory = factory;
