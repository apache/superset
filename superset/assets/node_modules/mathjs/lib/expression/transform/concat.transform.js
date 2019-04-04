'use strict';

var errorTransform = require('./error.transform').transform;

/**
 * Attach a transform function to math.range
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `dim` parameter of function concat
 * from one-based to zero based
 */
function factory (type, config, load, typed) {
  var concat = load(require('../../function/matrix/concat'));

  // @see: comment of concat itself
 return typed('concat', {
    '...any': function (args) {
      // change last argument from one-based to zero-based
      var lastIndex = args.length - 1;
      var last = args[lastIndex];
      if (type.isNumber(last)) {
        args[lastIndex] = last - 1;
      }
      else if (type.isBigNumber(last)) {
        args[lastIndex] = last.minus(1);
      }

      try {
        return concat.apply(null, args);
      }
      catch (err) {
        throw errorTransform(err);
      }
    }
  });
}

exports.name = 'concat';
exports.path = 'expression.transform';
exports.factory = factory;
