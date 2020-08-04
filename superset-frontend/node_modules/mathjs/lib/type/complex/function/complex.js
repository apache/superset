'use strict';

var deepMap = require('../../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  var latex = require('../../../utils/latex');

  /**
   * Create a complex value or convert a value to a complex value.
   *
   * Syntax:
   *
   *     math.complex()                           // creates a complex value with zero
   *                                              // as real and imaginary part.
   *     math.complex(re : number, im : string)   // creates a complex value with provided
   *                                              // values for real and imaginary part.
   *     math.complex(re : number)                // creates a complex value with provided
   *                                              // real value and zero imaginary part.
   *     math.complex(complex : Complex)          // clones the provided complex value.
   *     math.complex(arg : string)               // parses a string into a complex value.
   *     math.complex(array : Array)              // converts the elements of the array
   *                                              // or matrix element wise into a
   *                                              // complex value.
   *     math.complex({re: number, im: number})   // creates a complex value with provided
   *                                              // values for real an imaginary part.
   *     math.complex({r: number, phi: number})   // creates a complex value with provided
   *                                              // polar coordinates
   *
   * Examples:
   *
   *    var a = math.complex(3, -4);     // a = Complex 3 - 4i
   *    a.re = 5;                        // a = Complex 5 - 4i
   *    var i = a.im;                    // Number -4;
   *    var b = math.complex('2 + 6i');  // Complex 2 + 6i
   *    var c = math.complex();          // Complex 0 + 0i
   *    var d = math.add(a, b);          // Complex 5 + 2i
   *
   * See also:
   *
   *    bignumber, boolean, index, matrix, number, string, unit
   *
   * @param {* | Array | Matrix} [args]
   *            Arguments specifying the real and imaginary part of the complex number
   * @return {Complex | Array | Matrix} Returns a complex value
   */
  var complex = typed('complex', {
    '': function () {
      return type.Complex.ZERO;
    },

    'number': function (x) {
      return new type.Complex(x, 0);
    },

    'number, number': function (re, im) {
      return new type.Complex(re, im);
    },

    // TODO: this signature should be redundant
    'BigNumber, BigNumber': function (re, im) {
      return new type.Complex(re.toNumber(), im.toNumber());
    },

    'Complex': function (x) {
      return x.clone();
    },

    'string': function (x) {
      return type.Complex(x); // for example '2 + 3i'
    },

    'Object': function (x) {
      if('re' in x && 'im' in x) {
        return new type.Complex(x.re, x.im);
      }

      if ('r' in x && 'phi' in x) {
        return new type.Complex(x);
      }

      throw new Error('Expected object with either properties re and im, or properties r and phi.');
    },

    'Array | Matrix': function (x) {
      return deepMap(x, complex);
    }
  });

  complex.toTex = {
    0: '0',
    1: '\\left(${args[0]}\\right)',
    2: '\\left(\\left(${args[0]}\\right)+'
      + latex.symbols['i'] + '\\cdot\\left(${args[1]}\\right)\\right)'
  };

  return complex;
}

exports.name = 'complex';
exports.factory = factory;
