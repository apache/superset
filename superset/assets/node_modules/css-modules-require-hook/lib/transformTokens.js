'use strict';

var _require = require('lodash'),
    assign = _require.assign,
    camelCase = _require.camelCase,
    reduce = _require.reduce;

var camelizeKeys = function camelizeKeys(acc, value, key) {
  var camelizedKey = camelCase(key);
  if (camelizedKey !== key) acc[camelizedKey] = value;
  return acc;
};

var camelizeDashedKeys = function camelizeDashedKeys(acc, value, key) {
  var camelizedKey = camelizeDashes(key);
  if (camelizedKey !== key) acc[camelizedKey] = value;
  return acc;
};

var camelizeOnlyKeys = function camelizeOnlyKeys(acc, value, key) {
  var camelizedKey = camelCase(key);
  if (camelizedKey !== key) acc[camelizedKey] = value;else acc[key] = value;
  return acc;
};

var camelizeOnlyDashedKeys = function camelizeOnlyDashedKeys(acc, value, key) {
  var camelizedKey = camelizeDashes(key);
  if (camelizedKey !== key) acc[camelizedKey] = value;else acc[key] = value;
  return acc;
};

exports.camelizeDashes = camelizeDashes;
exports.transformTokens = transformTokens;

/**
 * @param  {string} str
 * @return {string}
 */
function camelizeDashes(str) {
  return str.replace(/-+(\w)/g, function (m, letter) {
    return letter.toUpperCase();
  });
}

/**
 * @param  {object} tokens
 * @param  {boolean|string} camelCase 'dashes|dashesOnly|only'
 * @return {object}
 */
function transformTokens(tokens, camelCase) {
  switch (camelCase) {
    case true:
      return reduce(tokens, camelizeKeys, assign({}, tokens));

    case 'dashes':
      return reduce(tokens, camelizeDashedKeys, assign({}, tokens));

    case 'dashesOnly':
      return reduce(tokens, camelizeOnlyDashedKeys, {});

    case 'only':
      return reduce(tokens, camelizeOnlyKeys, {});
  }

  return tokens;
}