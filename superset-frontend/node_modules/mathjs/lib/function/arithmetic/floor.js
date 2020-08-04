'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Round a value towards minus infinity.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.floor(x)
   *
   * Examples:
   *
   *    math.floor(3.2);              // returns number 3
   *    math.floor(3.8);              // returns number 3
   *    math.floor(-4.2);             // returns number -5
   *    math.floor(-4.7);             // returns number -5
   *
   *    var c = math.complex(3.2, -2.7);
   *    math.floor(c);                // returns Complex 3 - 3i
   *
   *    math.floor([3.2, 3.8, -4.7]); // returns Array [3, 3, -5]
   *
   * See also:
   *
   *    ceil, fix, round
   *
   * @param  {number | BigNumber | Fraction | Complex | Array | Matrix} x  Number to be rounded
   * @return {number | BigNumber | Fraction | Complex | Array | Matrix} Rounded value
   */
  var floor = typed('floor', {
    'number': Math.floor,

    'Complex': function (x) {
      return x.floor();
    },

    'BigNumber': function (x) {
      return x.floor();
    },

    'Fraction': function (x) {
      return x.floor();
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since floor(0) = 0
      return deepMap(x, floor, true);
    }
  });

  floor.toTex = {1: '\\left\\lfloor${args[0]}\\right\\rfloor'};

  return floor;
}

exports.name = 'floor';
exports.factory = factory;
