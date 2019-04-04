'use strict';

/**
 * Determine the type of a variable
 *
 *     type(x)
 *
 * The following types are recognized:
 *
 *     'undefined'
 *     'null'
 *     'boolean'
 *     'number'
 *     'string'
 *     'Array'
 *     'Function'
 *     'Date'
 *     'RegExp'
 *     'Object'
 *
 * @param {*} x
 * @return {string} Returns the name of the type. Primitive types are lower case,
 *                  non-primitive types are upper-camel-case.
 *                  For example 'number', 'string', 'Array', 'Date'.
 */
exports.type = function(x) {
  var type = typeof x;

  if (type === 'object') {
    if (x === null)           return 'null';
    if (Array.isArray(x))     return 'Array';
    if (x instanceof Date)    return 'Date';
    if (x instanceof RegExp)  return 'RegExp';
    if (x instanceof Boolean) return 'boolean';
    if (x instanceof Number)  return 'number';
    if (x instanceof String)  return 'string';

    return 'Object';
  }

  if (type === 'function')    return 'Function';

  return type;
};
