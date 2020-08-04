'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Compute the argument of a complex value.
   * For a complex number `a + bi`, the argument is computed as `atan2(b, a)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.arg(x)
   *
   * Examples:
   *
   *    var a = math.complex(2, 2);
   *    math.arg(a) / math.pi;          // returns number 0.25
   *
   *    var b = math.complex('2 + 3i');
   *    math.arg(b);                    // returns number 0.982793723247329
   *    math.atan2(3, 2);               // returns number 0.982793723247329
   *
   * See also:
   *
   *    re, im, conj, abs
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x
   *            A complex number or array with complex numbers
   * @return {number | BigNumber | Array | Matrix} The argument of x
   */
  var arg = typed('arg', {
    'number': function (x) {
      return Math.atan2(0, x);
    },

    'BigNumber': function (x) {
      return type.BigNumber.atan2(0, x);
    },

    'Complex': function (x) {
      return x.arg();
    },

    // TODO: implement BigNumber support for function arg

    'Array | Matrix': function (x) {
      return deepMap(x, arg);
    }
  });

  arg.toTex = {1: '\\arg\\left(${args[0]}\\right)'};

  return arg;
}

exports.name = 'arg';
exports.factory = factory;
