"use strict";

exports.__esModule = true;
exports.isNumeric = isNumeric;
exports.hyphenToCamelCase = hyphenToCamelCase;
exports.trimEnd = trimEnd;
exports.kebabCase = kebabCase;
exports.replaceSpaces = replaceSpaces;

/**
 * Determines if the specified string consists entirely of numeric characters.
 *
 * @param {*} [value]
 * @returns {boolean}
 */
function isNumeric(value) {
  return !Number.isNaN(value - parseFloat(value));
}
/**
 * Convert a hyphenated string to camelCase.
 *
 * @param {string} string
 * @returns {string}
 */


function hyphenToCamelCase(string) {
  return string.replace(/-(.)/g, (match, chr) => chr.toUpperCase());
}
/**
 * Trim the specified substring off the string. If the string does not end
 * with the specified substring, this is a no-op.
 *
 * @param {string} haystack String to search in
 * @param {string} needle   String to search for
 * @return {string}
 */


function trimEnd(haystack, needle) {
  return haystack.endsWith(needle) ? haystack.slice(0, -needle.length) : haystack;
}

const KEBAB_REGEX = /[A-Z\u00C0-\u00D6\u00D8-\u00DE]/g;

function kebabCase(str) {
  return str.replace(KEBAB_REGEX, match => `-${match.toLowerCase()}`);
}

const SPACES_REGEXP = /[\t\r\n\u0085\u2028\u2029]+/g;

function replaceSpaces(str) {
  return str.replace(SPACES_REGEXP, ' ');
}