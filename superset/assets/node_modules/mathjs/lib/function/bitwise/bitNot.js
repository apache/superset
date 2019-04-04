'use strict';

var deepMap = require('../../utils/collection/deepMap');
var bigBitNot = require('../../utils/bignumber/bitNot');
var isInteger = require('../../utils/number').isInteger;

function factory (type, config, load, typed) {
  var latex = require('../../utils/latex');

  /**
   * Bitwise NOT value, `~x`.
   * For matrices, the function is evaluated element wise.
   * For units, the function is evaluated on the best prefix base.
   *
   * Syntax:
   *
   *    math.bitNot(x)
   *
   * Examples:
   *
   *    math.bitNot(1);               // returns number -2
   *
   *    math.bitNot([2, -3, 4]);      // returns Array [-3, 2, 5]
   *
   * See also:
   *
   *    bitAnd, bitOr, bitXor, leftShift, rightArithShift, rightLogShift
   *
   * @param  {number | BigNumber | Array | Matrix} x Value to not
   * @return {number | BigNumber | Array | Matrix} NOT of `x`
   */
  var bitNot = typed('bitNot', {
    'number': function (x) {
      if (!isInteger(x)) {
        throw new Error('Integer expected in function bitNot');
      }

      return ~x;
    },

    'BigNumber': bigBitNot,

    'Array | Matrix': function (x) {
      return deepMap(x, bitNot);
    }
  });

  bitNot.toTex = {
    1: latex.operators['bitNot'] + '\\left(${args[0]}\\right)'
  };

  return bitNot;
}

exports.name = 'bitNot';
exports.factory = factory;
