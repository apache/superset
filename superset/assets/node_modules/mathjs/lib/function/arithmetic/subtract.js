'use strict';

var DimensionError = require('../../error/DimensionError');

function factory (type, config, load, typed) {
  var latex = require('../../utils/latex');

  var matrix = load(require('../../type/matrix/function/matrix'));
  var addScalar = load(require('./addScalar'));
  var unaryMinus = load(require('./unaryMinus'));

  var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
  var algorithm03 = load(require('../../type/matrix/utils/algorithm03'));
  var algorithm05 = load(require('../../type/matrix/utils/algorithm05'));
  var algorithm10 = load(require('../../type/matrix/utils/algorithm10'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  // TODO: split function subtract in two: subtract and subtractScalar

  /**
   * Subtract two values, `x - y`.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.subtract(x, y)
   *
   * Examples:
   *
   *    math.subtract(5.3, 2);        // returns number 3.3
   *
   *    var a = math.complex(2, 3);
   *    var b = math.complex(4, 1);
   *    math.subtract(a, b);          // returns Complex -2 + 2i
   *
   *    math.subtract([5, 7, 4], 4);  // returns Array [1, 3, 0]
   *
   *    var c = math.unit('2.1 km');
   *    var d = math.unit('500m');
   *    math.subtract(c, d);          // returns Unit 1.6 km
   *
   * See also:
   *
   *    add
   *
   * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x
   *            Initial value
   * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} y
   *            Value to subtract from `x`
   * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix}
   *            Subtraction of `x` and `y`
   */
  var subtract = typed('subtract', {

    'number, number': function (x, y) {
      return x - y;
    },

    'Complex, Complex': function (x, y) {
      return x.sub(y);
    },

    'BigNumber, BigNumber': function (x, y) {
      return x.minus(y);
    },

    'Fraction, Fraction': function (x, y) {
      return x.sub(y);
    },

    'Unit, Unit': function (x, y) {
      if (x.value == null) {
        throw new Error('Parameter x contains a unit with undefined value');
      }

      if (y.value == null) {
        throw new Error('Parameter y contains a unit with undefined value');
      }

      if (!x.equalBase(y)) {
        throw new Error('Units do not match');
      }

      var res = x.clone();
      res.value = subtract(res.value, y.value);
      res.fixPrefix = false;

      return res;
    },
    
    'Matrix, Matrix': function (x, y) {
      // matrix sizes
      var xsize = x.size();
      var ysize = y.size();

      // check dimensions
      if (xsize.length !== ysize.length)
        throw new DimensionError(xsize.length, ysize.length);

      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse - sparse
              c = algorithm05(x, y, subtract);
              break;
            default:
              // sparse - dense
              c = algorithm03(y, x, subtract, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense - sparse
              c = algorithm01(x, y, subtract, false);
              break;
            default:
              // dense - dense
              c = algorithm13(x, y, subtract);
              break;
          }
          break;
      }
      return c;
    },
    
    'Array, Array': function (x, y) {
      // use matrix implementation
      return subtract(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return subtract(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return subtract(x, matrix(y));
    },
    
    'Matrix, any': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          // algorithm 7 is faster than 9 since it calls f() for nonzero items only!
          c = algorithm10(x, unaryMinus(y), addScalar);
          break;
        default:
          c = algorithm14(x, y, subtract);
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
          c = algorithm10(y, x, subtract, true);
          break;
        default:
          c = algorithm14(y, x, subtract, true);
          break;
      }
      return c;
    },

    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, subtract, false).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, subtract, true).valueOf();
    }
  });

  subtract.toTex = {
    2: '\\left(${args[0]}' + latex.operators['subtract'] + '${args[1]}\\right)'
  };

  return subtract;
}

exports.name = 'subtract';
exports.factory = factory;
