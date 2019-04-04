'use strict';

var filter = require('../../utils/array').filter;
var filterRegExp = require('../../utils/array').filterRegExp;
var maxArgumentCount = require('../../utils/function').maxArgumentCount;

/**
 * Attach a transform function to math.filter
 * Adds a property transform containing the transform function.
 *
 * This transform adds support for equations as test function for math.filter,
 * so you can do something like 'filter([3, -2, 5], x > 0)'.
 */
function factory (type, config, load, typed) {
  var compileInlineExpression = load(require('./utils/compileInlineExpression'));
  var matrix = load(require('../../type/matrix/function/matrix'));

  function filterTransform(args, math, scope) {
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

    return filter(x, callback);
  }
  filterTransform.rawArgs = true;

  // one based version of function filter
  var filter = typed('filter', {
    'Array, function': _filter,

    'Matrix, function': function (x, test) {
      return matrix(_filter(x.toArray(), test));
    },

    'Array, RegExp': filterRegExp,

    'Matrix, RegExp': function (x, test) {
      return matrix(filterRegExp(x.toArray(), test));
    }
  });

  filter.toTex = undefined; // use default template

  return filterTransform;
}

/**
 * Filter values in a callback given a callback function
 *
 * !!! Passes a one-based index !!!
 *
 * @param {Array} x
 * @param {Function} callback
 * @return {Array} Returns the filtered array
 * @private
 */
function _filter (x, callback) {
  // figure out what number of arguments the callback function expects
  var args = maxArgumentCount(callback);

  return filter(x, function (value, index, array) {
    // invoke the callback function with the right number of arguments
    if (args === 1) {
      return callback(value);
    }
    else if (args === 2) {
      return callback(value, [index + 1]);
    }
    else { // 3 or -1
      return callback(value, [index + 1], array);
    }
  });
}

exports.name = 'filter';
exports.path = 'expression.transform';
exports.factory = factory;
