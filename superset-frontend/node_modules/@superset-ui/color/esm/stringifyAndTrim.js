"use strict";

exports.__esModule = true;
exports.default = stringifyAndTrim;

/**
 * Ensure value is a string
 * @param {any} value
 */
function stringifyAndTrim(value) {
  return String(value).trim();
}