'use strict';

var DimensionError = require('../../error/DimensionError');
var ArgumentsError = require('../../error/ArgumentsError');

var isInteger = require('../../utils/number').isInteger;
var format = require('../../utils/string').format;
var clone = require('../../utils/object').clone;
var array = require('../../utils/array');

function factory (type, config, load, typed) {
  var matrix = load(require('../../type/matrix/function/matrix'));

  /**
   * Resize a matrix
   *
   * Syntax:
   *
   *     math.resize(x, size)
   *     math.resize(x, size, defaultValue)
   *
   * Examples:
   *
   *     math.resize([1, 2, 3, 4, 5], [3]); // returns Array  [1, 2, 3]
   *     math.resize([1, 2, 3], [5], 0);    // returns Array  [1, 2, 3, 0, 0]
   *     math.resize(2, [2, 3], 0);         // returns Matrix [[2, 0, 0], [0, 0, 0]]
   *     math.resize("hello", [8], "!");    // returns string 'hello!!!'
   *
   * See also:
   *
   *     size, squeeze, subset, reshape
   *
   * @param {Array | Matrix | *} x             Matrix to be resized
   * @param {Array | Matrix} size              One dimensional array with numbers
   * @param {number | string} [defaultValue=0] Zero by default, except in
   *                                           case of a string, in that case
   *                                           defaultValue = ' '
   * @return {* | Array | Matrix} A resized clone of matrix `x`
   */
  // TODO: rework resize to a typed-function
  var resize = function resize (x, size, defaultValue) {
    if (arguments.length != 2 && arguments.length != 3) {
      throw new ArgumentsError('resize', arguments.length, 2, 3);
    }

    if (type.isMatrix(size)) {
      size = size.valueOf(); // get Array
    }

    if (type.isBigNumber(size[0])) {
      // convert bignumbers to numbers
      size = size.map(function (value) {
        return type.isBigNumber(value) ? value.toNumber() : value;
      });
    }
    
    // check x is a Matrix
    if (type.isMatrix(x)) {
      // use optimized matrix implementation, return copy
      return x.resize(size, defaultValue, true);
    }
    
    if (typeof x === 'string') {
      // resize string
      return _resizeString(x, size, defaultValue);
    }
    
    // check result should be a matrix
    var asMatrix = Array.isArray(x) ? false : (config.matrix !== 'Array');

    if (size.length == 0) {
      // output a scalar
      while (Array.isArray(x)) {
        x = x[0];
      }

      return clone(x);
    }
    else {
      // output an array/matrix
      if (!Array.isArray(x)) {
        x = [x];
      }
      x = clone(x);

      var res = array.resize(x, size, defaultValue);
      return asMatrix ? matrix(res) : res;
    }
  };

  resize.toTex = undefined; // use default template

  return resize;

  /**
   * Resize a string
   * @param {string} str
   * @param {number[]} size
   * @param {string} [defaultChar=' ']
   * @private
   */
  function _resizeString(str, size, defaultChar) {
    if (defaultChar !== undefined) {
      if (typeof defaultChar !== 'string' || defaultChar.length !== 1) {
        throw new TypeError('Single character expected as defaultValue');
      }
    }
    else {
      defaultChar = ' ';
    }

    if (size.length !== 1) {
      throw new DimensionError(size.length, 1);
    }
    var len = size[0];
    if (typeof len !== 'number' || !isInteger(len)) {
      throw new TypeError('Invalid size, must contain positive integers ' +
          '(size: ' + format(size) + ')');
    }

    if (str.length > len) {
      return str.substring(0, len);
    }
    else if (str.length < len) {
      var res = str;
      for (var i = 0, ii = len - str.length; i < ii; i++) {
        res += defaultChar;
      }
      return res;
    }
    else {
      return str;
    }
  }
}

exports.name = 'resize';
exports.factory = factory;
