'use strict';

var maxArgumentCount = require('../../utils/function').maxArgumentCount;
var map = require('../../utils/array').map;

/**
 * Attach a transform function to math.map
 * Adds a property transform containing the transform function.
 *
 * This transform creates a one-based index instead of a zero-based index
 */
function factory (type, config, load, typed) {
  var compileInlineExpression = load(require('./utils/compileInlineExpression'));
  var matrix = load(require('../../type/matrix/function/matrix'));

  function mapTransform(args, math, scope) {
    var x, callback;

    if (args[0]) {
      x = args[0].compile().eval(scope);
    }

    if (args[1]) {
      if (type.isSymbolNode(args[1]) || type.isFunctionAssignmentNode(args[1])) {
        // a function pointer, like filter([3, -2, 5], myTestFunction);
        callback = args[1].compile().eval(scope);
      }
      else {
        // an expression like filter([3, -2, 5], x > 0)
        callback = compileInlineExpression(args[1], math, scope);
      }
    }

    return map(x, callback);
  }
  mapTransform.rawArgs = true;

  // one-based version of map function
  var map = typed('map', {
    'Array, function': function (x, callback) {
      return _map(x, callback, x);
    },

    'Matrix, function': function (x, callback) {
      return matrix(_map(x.valueOf(), callback, x));
    }
  });

  return mapTransform;
}

/**
 * Map for a multi dimensional array. One-based indexes
 * @param {Array} array
 * @param {function} callback
 * @param {Array} orig
 * @return {Array}
 * @private
 */
function _map (array, callback, orig) {
  // figure out what number of arguments the callback function expects
  var argsCount = maxArgumentCount(callback);

  function recurse(value, index) {
    if (Array.isArray(value)) {
      return map(value, function (child, i) {
        // we create a copy of the index array and append the new index value
        return recurse(child, index.concat(i + 1)); // one based index, hence i + 1
      });
    }
    else {
      // invoke the (typed) callback function with the right number of arguments
      if (argsCount === 1) {
        return callback(value);
      }
      else if (argsCount === 2) {
        return callback(value, index);
      }
      else { // 3 or -1
        return callback(value, index, orig);
      }
    }
  }

  return recurse(array, []);
}

exports.name = 'map';
exports.path = 'expression.transform';
exports.factory = factory;
