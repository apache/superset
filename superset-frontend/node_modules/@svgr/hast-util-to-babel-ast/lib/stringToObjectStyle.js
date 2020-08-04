"use strict";

exports.__esModule = true;
exports.default = void 0;

var t = _interopRequireWildcard(require("@babel/types"));

var _util = require("./util");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// Inspired by https://github.com/reactjs/react-magic/blob/master/src/htmltojsx.js

/**
 * Determines if the CSS value can be converted from a
 * 'px' suffixed string to a numeric value.
 *
 * @param {string} value CSS property value
 * @return {boolean}
 */
function isConvertiblePixelValue(value) {
  return /^\d+px$/.test(value);
}
/**
 * Format style key into JSX style object key.
 *
 * @param {string} key
 * @return {string}
 */


function formatKey(key) {
  key = key.toLowerCase(); // Don't capitalize -ms- prefix

  if (/^-ms-/.test(key)) key = key.substr(1);
  return t.identifier((0, _util.hyphenToCamelCase)(key));
}
/**
 * Format style value into JSX style object value.
 *
 * @param {string} key
 * @return {string}
 */


function formatValue(value) {
  if ((0, _util.isNumeric)(value)) return t.numericLiteral(Number(value));
  if (isConvertiblePixelValue(value)) return t.numericLiteral(Number((0, _util.trimEnd)(value, 'px')));
  return t.stringLiteral(value);
}
/**
 * Handle parsing of inline styles.
 *
 * @param {string} rawStyle
 * @returns {object}
 */


function stringToObjectStyle(rawStyle) {
  const entries = rawStyle.split(';');
  const properties = [];
  let index = -1;

  while (++index < entries.length) {
    const entry = entries[index];
    const style = entry.trim();
    const firstColon = style.indexOf(':');
    const value = style.substr(firstColon + 1).trim();
    const key = style.substr(0, firstColon);

    if (key !== '') {
      const property = t.objectProperty(formatKey(key), formatValue(value));
      properties.push(property);
    }
  }

  return t.objectExpression(properties);
}

var _default = stringToObjectStyle;
exports.default = _default;