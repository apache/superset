'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Compute the complex conjugate of a complex value.
   * If `x = a+bi`, the complex conjugate of `x` is `a - bi`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.conj(x)
   *
   * Examples:
   *
   *    math.conj(math.complex('2 + 3i'));  // returns Complex 2 - 3i
   *    math.conj(math.complex('2 - 3i'));  // returns Complex 2 + 3i
   *    math.conj(math.complex('-5.2i'));  // returns Complex 5.2i
   *
   * See also:
   *
   *    re, im, arg, abs
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x
   *            A complex number or array with complex numbers
   * @return {number | BigNumber | Complex | Array | Matrix}
   *            The complex conjugate of x
   */
  var conj = typed('conj', {
    'number': function (x) {
      return x;
    },

    'BigNumber': function (x) {
      return x;
    },

    'Complex': function (x) {
      return x.conjugate();
    },

    'Array | Matrix': function (x) {
      return deepMap(x, conj);
    }
  });

  conj.toTex = {1: '\\left(${args[0]}\\right)^*'};

  return conj;
}

exports.name = 'conj';
exports.factory = factory;
