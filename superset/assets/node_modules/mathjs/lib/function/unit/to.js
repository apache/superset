'use strict';

function factory (type, config, load, typed) {
  var latex = require('../../utils/latex');

  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Change the unit of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.to(x, unit)
   *
   * Examples:
   *
   *    math.to(math.unit('2 inch'), 'cm');                   // returns Unit 5.08 cm
   *    math.to(math.unit('2 inch'), math.unit(null, 'cm'));  // returns Unit 5.08 cm
   *    math.to(math.unit(16, 'bytes'), 'bits');              // returns Unit 128 bits
   *
   * See also:
   *
   *    unit
   *
   * @param {Unit | Array | Matrix} x     The unit to be converted.
   * @param {Unit | Array | Matrix} unit  New unit. Can be a string like "cm"
   *                                      or a unit without value.
   * @return {Unit | Array | Matrix} value with changed, fixed unit.
   */
  var to = typed('to', {

    'Unit, Unit | string': function (x, unit) {
      return x.to(unit);
    },

    'Matrix, Matrix': function (x, y) {
      // SparseMatrix does not support Units
      return algorithm13(x, y, to);
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return to(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return to(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return to(x, matrix(y));
    },

    'Matrix, any': function (x, y) {
      // SparseMatrix does not support Units
      return algorithm14(x, y, to, false);
    },

    'any, Matrix': function (x, y) {
      // SparseMatrix does not support Units
      return algorithm14(y, x, to, true);
    },

    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, to, false).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, to, true).valueOf();
    }
  });

  to.toTex = {
    2: '\\left(${args[0]}' + latex.operators['to'] + '${args[1]}\\right)'
  };

  return to;
}

exports.name = 'to';
exports.factory = factory;
