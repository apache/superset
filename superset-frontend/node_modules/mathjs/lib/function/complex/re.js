'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Get the real part of a complex number.
   * For a complex number `a + bi`, the function returns `a`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.re(x)
   *
   * Examples:
   *
   *    var a = math.complex(2, 3);
   *    math.re(a);                     // returns number 2
   *    math.im(a);                     // returns number 3
   *
   *    math.re(math.complex('-5.2i')); // returns number 0
   *    math.re(math.complex(2.4));     // returns number 2.4
   *
   * See also:
   *
   *    im, conj, abs, arg
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x
   *            A complex number or array with complex numbers
   * @return {number | BigNumber | Array | Matrix} The real part of x
   */
  var re = typed('re', {
    'number': function (x) {
      return x;
    },

    'BigNumber': function (x) {
      return x;
    },

    'Complex': function (x) {
      return x.re;
    },

    'Array | Matrix': function (x) {
      return deepMap(x, re);
    }
  });

  re.toTex = {1: '\\Re\\left\\lbrace${args[0]}\\right\\rbrace'};

  return re;
}

exports.name = 're';
exports.factory = factory;
