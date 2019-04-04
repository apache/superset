'use strict';

/**
 * Attach a transform function to math.index
 * Adds a property transform containing the transform function.
 *
 * This transform creates a one-based index instead of a zero-based index
 */
function factory (type, config, load) {

  return function indexTransform() {
    var args = [];
    for (var i = 0, ii = arguments.length; i < ii; i++) {
      var arg = arguments[i];

      // change from one-based to zero based, and convert BigNumber to number
      if (type.isRange(arg)) {
        arg.start--;
        arg.end -= (arg.step > 0 ? 0 : 2);
      }
      else if (arg && arg.isSet === true) {
        arg = arg.map(function (v) { return v - 1; });
      }
      else if (type.isArray(arg) || type.isMatrix(arg)) {
        arg = arg.map(function (v) { return v - 1; });
      }
      else if (type.isNumber(arg)) {
        arg--;
      }
      else if (type.isBigNumber(arg)) {
        arg = arg.toNumber() - 1;
      }
      else if (typeof arg === 'string') {
        // leave as is
      }
      else {
        throw new TypeError('Dimension must be an Array, Matrix, number, string, or Range');
      }

      args[i] = arg;
    }

    var res = new type.Index();
    type.Index.apply(res, args);
    return res;
  };
}

exports.name = 'index';
exports.path = 'expression.transform';
exports.factory = factory;
