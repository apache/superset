'use strict';

var extend = require('../../utils/object').extend;

function factory (type, config, load, typed) {

  var matrix = load(require('../../type/matrix/function/matrix'));
  var addScalar = load(require('./addScalar'));
  var latex = require('../../utils/latex.js');
  
  var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
  var algorithm04 = load(require('../../type/matrix/utils/algorithm04'));
  var algorithm10 = load(require('../../type/matrix/utils/algorithm10'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Add two or more values, `x + y`.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.add(x, y)
   *    math.add(x, y, z, ...)
   *
   * Examples:
   *
   *    math.add(2, 3);               // returns number 5
   *    math.add(2, 3, 4);            // returns number 9
   *
   *    var a = math.complex(2, 3);
   *    var b = math.complex(-4, 1);
   *    math.add(a, b);               // returns Complex -2 + 4i
   *
   *    math.add([1, 2, 3], 4);       // returns Array [5, 6, 7]
   *
   *    var c = math.unit('5 cm');
   *    var d = math.unit('2.1 mm');
   *    math.add(c, d);               // returns Unit 52.1 mm
   *
   *    math.add("2.3", "4");         // returns number 6.3
   *
   * See also:
   *
   *    subtract, sum
   *
   * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x First value to add
   * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} y Second value to add
   * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} Sum of `x` and `y`
   */
  var add = typed('add', extend({
    // we extend the signatures of addScalar with signatures dealing with matrices

    'Matrix, Matrix': function (x, y) {
      // result
      var c;
      
      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse + sparse
              c = algorithm04(x, y, addScalar);
              break;
            default:
              // sparse + dense
              c = algorithm01(y, x, addScalar, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense + sparse
              c = algorithm01(x, y, addScalar, false);
              break;
            default:
              // dense + dense
              c = algorithm13(x, y, addScalar);
              break;
          }
          break;
      }
      return c;
    },
    
    'Array, Array': function (x, y) {
      // use matrix implementation
      return add(matrix(x), matrix(y)).valueOf();
    },
    
    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return add(matrix(x), y);
    },
    
    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return add(x, matrix(y));
    },
    
    'Matrix, any': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm10(x, y, addScalar, false);
          break;
        default:
          c = algorithm14(x, y, addScalar, false);
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
          c = algorithm10(y, x, addScalar, true);
          break;
        default:
          c = algorithm14(y, x, addScalar, true);
          break;
      }
      return c;
    },
    
    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, addScalar, false).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, addScalar, true).valueOf();
    },

    'any, any': addScalar,

    'Array | Matrix | any, Array | Matrix | any, ...any': function (x, y, rest) {
      var result = add(x, y);

      for (var i = 0; i < rest.length; i++) {
        result = add(result, rest[i]);
      }

      return result;
    }
  }, addScalar.signatures));

  add.toTex = {
    2: '\\left(${args[0]}' + latex.operators['add'] + '${args[1]}\\right)'
  };
  
  return add;
}

exports.name = 'add';
exports.factory = factory;
