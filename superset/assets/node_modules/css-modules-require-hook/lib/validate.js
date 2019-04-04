'use strict';

var _require = require('lodash'),
    difference = _require.difference,
    forEach = _require.forEach,
    isArray = _require.isArray,
    isBoolean = _require.isBoolean,
    isFunction = _require.isFunction,
    isPlainObject = _require.isPlainObject,
    isRegExp = _require.isRegExp,
    isString = _require.isString,
    keys = _require.keys;

var rules = {
  // hook
  camelCase: 'boolean|string',
  devMode: 'boolean',
  extensions: 'array|string',
  ignore: 'function|regex|string',
  preprocessCss: 'function',
  processCss: 'function',
  processorOpts: 'object',
  // plugins
  append: 'array',
  prepend: 'array',
  use: 'array',
  createImportedName: 'function',
  generateScopedName: 'function|string',
  hashPrefix: 'string',
  mode: 'string',
  resolve: 'object',
  rootDir: 'string'
};

var tests = {
  array: isArray,
  boolean: isBoolean,
  function: isFunction,
  object: isPlainObject,
  regex: isRegExp,
  string: isString
};

module.exports = function validate(options) {
  var unknownOptions = difference(keys(options), keys(rules));
  if (unknownOptions.length) throw new Error(`unknown arguments: ${unknownOptions.join(', ')}.`);

  forEach(rules, function (types, rule) {
    if (typeof options[rule] === 'undefined') return;

    if (!types.split('|').some(function (type) {
      return tests[type](options[rule]);
    })) throw new TypeError(`should specify ${types} as ${rule}`);
  });
};