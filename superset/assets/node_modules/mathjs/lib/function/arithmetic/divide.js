'use strict';

var extend = require('../../utils/object').extend;

function factory (type, config, load, typed) {

  var divideScalar = load(require('./divideScalar'));
  var multiply     = load(require('./multiply'));
  var inv          = load(require('../matrix/inv'));
  var matrix       = load(require('../../type/matrix/function/matrix'));

  var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));
  
  /**
   * Divide two values, `x / y`.
   * To divide matrices, `x` is multiplied with the inverse of `y`: `x * inv(y)`.
   *
   * Syntax:
   *
   *    math.divide(x, y)
   *
   * Examples:
   *
   *    math.divide(2, 3);            // returns number 0.6666666666666666
   *
   *    var a = math.complex(5, 14);
   *    var b = math.complex(4, 1);
   *    math.divide(a, b);            // returns Complex 2 + 3i
   *
   *    var c = [[7, -6], [13, -4]];
   *    var d = [[1, 2], [4, 3]];
   *    math.divide(c, d);            // returns Array [[-9, 4], [-11, 6]]
   *
   *    var e = math.unit('18 km');
   *    math.divide(e, 4.5);          // returns Unit 4 km
   *
   * See also:
   *
   *    multiply
   *
   * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x   Numerator
   * @param  {number | BigNumber | Fraction | Complex | Array | Matrix} y          Denominator
   * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix}                      Quotient, `x / y`
   */
  var divide = typed('divide', extend({
    // we extend the signatures of divideScalar with signatures dealing with matrices

    'Array | Matrix, Array | Matrix': function (x, y) {
      // TODO: implement matrix right division using pseudo inverse
      // http://www.mathworks.nl/help/matlab/ref/mrdivide.html
      // http://www.gnu.org/software/octave/doc/interpreter/Arithmetic-Ops.html
      // http://stackoverflow.com/questions/12263932/how-does-gnu-octave-matrix-division-work-getting-unexpected-behaviour
      return multiply(x, inv(y));
    },

    'Matrix, any': function (x, y) {
      // result
      var c;

      // process storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm11(x, y, divideScalar, false);
          break;
        case 'dense':
          c = algorithm14(x, y, divideScalar, false);
          break;
      }
      return c;
    },
    
    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, divideScalar, false).valueOf();
    },

    'any, Array | Matrix': function (x, y) {
      return multiply(x, inv(y));
    }
  }, divideScalar.signatures));

  divide.toTex = {2: '\\frac{${args[0]}}{${args[1]}}'};

  return divide;
}

exports.name = 'divide';
exports.factory = factory;
