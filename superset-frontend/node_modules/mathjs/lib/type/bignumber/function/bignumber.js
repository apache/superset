'use strict';

var deepMap = require('../../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Create a BigNumber, which can store numbers with arbitrary precision.
   * When a matrix is provided, all elements will be converted to BigNumber.
   *
   * Syntax:
   *
   *    math.bignumber(x)
   *
   * Examples:
   *
   *    0.1 + 0.2;                                  // returns number 0.30000000000000004
   *    math.bignumber(0.1) + math.bignumber(0.2);  // returns BigNumber 0.3
   *
   *
   *    7.2e500;                                    // returns number Infinity
   *    math.bignumber('7.2e500');                  // returns BigNumber 7.2e500
   *
   * See also:
   *
   *    boolean, complex, index, matrix, string, unit
   *
   * @param {number | string | Fraction | BigNumber | Array | Matrix | boolean | null} [value]  Value for the big number,
   *                                                    0 by default.
   * @returns {BigNumber} The created bignumber
   */
  var bignumber = typed('bignumber', {
    '': function () {
      return new type.BigNumber(0);
    },

    'number': function (x) {
      // convert to string to prevent errors in case of >15 digits
      return new type.BigNumber(x + '');
    },

    'string': function (x) {
      return new type.BigNumber(x);
    },

    'BigNumber': function (x) {
      // we assume a BigNumber is immutable
      return x;
    },

    'Fraction': function (x) {
      return new type.BigNumber(x.n).div(x.d);
    },

    'Array | Matrix': function (x) {
      return deepMap(x, bignumber);
    }
  });

  bignumber.toTex = {
    0: '0',
    1: '\\left(${args[0]}\\right)'
  };

  return bignumber;
}

exports.name = 'bignumber';
exports.factory = factory;
