'use strict';

var deepMap = require('./../utils/collection/deepMap');
var number = require('../utils/number');

function factory (type, config, load, typed) {
  /**
   * Create a string or convert any object into a string.
   * Elements of Arrays and Matrices are processed element wise.
   *
   * Syntax:
   *
   *    math.string(value)
   *
   * Examples:
   *
   *    math.string(4.2);               // returns string '4.2'
   *    math.string(math.complex(3, 2); // returns string '3 + 2i'
   *
   *    var u = math.unit(5, 'km');
   *    math.string(u.to('m'));         // returns string '5000 m'
   *
   *    math.string([true, false]);     // returns ['true', 'false']
   *
   * See also:
   *
   *    bignumber, boolean, complex, index, matrix, number, unit
   *
   * @param {* | Array | Matrix | null} [value]  A value to convert to a string
   * @return {string | Array | Matrix} The created string
   */
  var string = typed('string', {
    '': function () {
      return '';
    },

    'number': number.format,

    'null': function (x) {
      return 'null';
    },

    'boolean': function (x) {
      return x + '';
    },

    'string': function (x) {
      return x;
    },

    'Array | Matrix': function (x) {
      return deepMap(x, string);
    },

    'any': function (x) {
      return String(x);
    }
  });

  string.toTex = {
    0: '\\mathtt{""}',
    1: '\\mathrm{string}\\left(${args[0]}\\right)'
  };

  return string;
}

exports.name = 'string';
exports.factory = factory;
