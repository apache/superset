'use strict';

var deepMap = require('./../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Create a number or convert a string, boolean, or unit to a number.
   * When value is a matrix, all elements will be converted to number.
   *
   * Syntax:
   *
   *    math.number(value)
   *    math.number(unit, valuelessUnit)
   *
   * Examples:
   *
   *    math.number(2);                         // returns number 2
   *    math.number('7.2');                     // returns number 7.2
   *    math.number(true);                      // returns number 1
   *    math.number([true, false, true, true]); // returns [1, 0, 1, 1]
   *    math.number(math.unit('52cm'), 'm');    // returns 0.52
   *
   * See also:
   *
   *    bignumber, boolean, complex, index, matrix, string, unit
   *
   * @param {string | number | BigNumber | Fraction | boolean | Array | Matrix | Unit | null} [value]  Value to be converted
   * @param {Unit | string} [valuelessUnit] A valueless unit, used to convert a unit to a number
   * @return {number | Array | Matrix} The created number
   */
  var number = typed('number', {
    '': function () {
      return 0;
    },

    'number': function (x) {
      return x;
    },

    'string': function (x) {
      var num = Number(x);
      if (isNaN(num)) {
        throw new SyntaxError('String "' + x + '" is no valid number');
      }
      return num;
    },

    'BigNumber': function (x) {
      return x.toNumber();
    },

    'Fraction': function (x) {
      return x.valueOf();
    },

    'Unit': function (x) {
      throw new Error('Second argument with valueless unit expected');
    },

    'Unit, string | Unit': function (unit, valuelessUnit) {
      return unit.toNumber(valuelessUnit);
    },

    'Array | Matrix': function (x) {
      return deepMap(x, number);
    }
  });

  number.toTex = {
    0: '0',
    1: '\\left(${args[0]}\\right)',
    2: '\\left(\\left(${args[0]}\\right)${args[1]}\\right)'
  };

  return number;
}

exports.name = 'number';
exports.factory = factory;
