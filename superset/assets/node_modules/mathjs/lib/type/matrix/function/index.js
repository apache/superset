'use strict';

function factory (type, config, load, typed) {
  /**
   * Create an index. An Index can store ranges having start, step, and end
   * for multiple dimensions.
   * Matrix.get, Matrix.set, and math.subset accept an Index as input.
   *
   * Syntax:
   *
   *     math.index(range1, range2, ...)
   *
   * Where each range can be any of:
   *
   * - A number
   * - A string for getting/setting an object property
   * - An instance of `Range`
   * - A one-dimensional Array or a Matrix with numbers
   *
   * Indexes must be zero-based, integer numbers.
   *
   * Examples:
   *
   *    var math = math.js
   *
   *    var b = [1, 2, 3, 4, 5];
   *    math.subset(b, math.index([1, 2, 3]));     // returns [2, 3, 4]
   *
   *    var a = math.matrix([[1, 2], [3, 4]]);
   *    a.subset(math.index(0, 1));             // returns 2
   *
   * See also:
   *
   *    bignumber, boolean, complex, matrix, number, string, unit
   *
   * @param {...*} ranges   Zero or more ranges or numbers.
   * @return {Index}        Returns the created index
   */
  return typed('index', {
    '...number | string | BigNumber | Range | Array | Matrix': function (args) {
      var ranges = args.map(function (arg) {
        if (type.isBigNumber(arg)) {
          return arg.toNumber(); // convert BigNumber to Number
        }
        else if (Array.isArray(arg) || type.isMatrix(arg)) {
          return arg.map(function (elem) {
            // convert BigNumber to Number
            return type.isBigNumber(elem) ? elem.toNumber() : elem;
          });
        }
        else {
          return arg;
        }
      });

      var res = new type.Index();
      type.Index.apply(res, ranges);
      return res;
    }
  });
}

exports.name = 'index';
exports.factory = factory;
