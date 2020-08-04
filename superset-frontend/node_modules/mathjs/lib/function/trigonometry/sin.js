'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {

  /**
   * Calculate the sine of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sin(x)
   *
   * Examples:
   *
   *    math.sin(2);                      // returns number 0.9092974268256813
   *    math.sin(math.pi / 4);            // returns number 0.7071067811865475
   *    math.sin(math.unit(90, 'deg'));   // returns number 1
   *    math.sin(math.unit(30, 'deg'));   // returns number 0.5
   *
   *    var angle = 0.2;
   *    math.pow(math.sin(angle), 2) + math.pow(math.cos(angle), 2); // returns number ~1
   *
   * See also:
   *
   *    cos, tan
   *
   * @param {number | BigNumber | Complex | Unit | Array | Matrix} x  Function input
   * @return {number | BigNumber | Complex | Array | Matrix} Sine of x
   */
  var sin = typed('sin', {
    'number': Math.sin,

    'Complex': function (x) {
      return x.sin();
    },

    'BigNumber': function (x) {
      return x.sin();
    },

    'Unit': function (x) {
      if (!x.hasBase(type.Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sin is no angle');
      }
      return sin(x.value);
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since sin(0) = 0
      return deepMap(x, sin, true);
    }
  });

  sin.toTex = {1: '\\sin\\left(${args[0]}\\right)'};

  return sin;
}

exports.name = 'sin';
exports.factory = factory;
