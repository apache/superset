"use strict";

// Map the characters to escape to their escaped values. The list is derived
// from http://www.cespedes.org/blog/85/how-to-escape-latex-special-characters

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var defaultEscapes = {
  "{": "\\{",
  "}": "\\}",
  "\\": "\\textbackslash{}",
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "~": "\\textasciitilde{}"
};
var formatEscapes = {
  "\u2013": "\\--",
  "\u2014": "\\---",
  " ": "~",
  "\t": "\\qquad{}",
  "\r\n": "\\newline{}",
  "\n": "\\newline{}"
};

var defaultEscapeMapFn = function defaultEscapeMapFn(defaultEscapes, formatEscapes) {
  return _extends({}, defaultEscapes, formatEscapes);
};

/**
 * Escape a string to be used in LaTeX documents.
 * @param {string} str the string to be escaped.
 * @param {boolean} params.preserveFormatting whether formatting escapes should
 *  be performed (default: false).
 * @param {function} params.escapeMapFn the function to modify the escape maps.
 * @return {string} the escaped string, ready to be used in LaTeX.
 */
module.exports = function (str) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      _ref$preserveFormatti = _ref.preserveFormatting,
      preserveFormatting = _ref$preserveFormatti === undefined ? false : _ref$preserveFormatti,
      _ref$escapeMapFn = _ref.escapeMapFn,
      escapeMapFn = _ref$escapeMapFn === undefined ? defaultEscapeMapFn : _ref$escapeMapFn;

  var runningStr = String(str);
  var result = "";

  var escapes = escapeMapFn(_extends({}, defaultEscapes), preserveFormatting ? _extends({}, formatEscapes) : {});
  var escapeKeys = Object.keys(escapes); // as it is reused later on

  // Algorithm: Go through the string character by character, if it matches
  // with one of the special characters then we'll replace it with the escaped
  // version.

  var _loop = function _loop() {
    var specialCharFound = false;
    escapeKeys.forEach(function (key, index) {
      if (specialCharFound) {
        return;
      }
      if (runningStr.length >= key.length && runningStr.slice(0, key.length) === key) {
        result += escapes[escapeKeys[index]];
        runningStr = runningStr.slice(key.length, runningStr.length);
        specialCharFound = true;
      }
    });
    if (!specialCharFound) {
      result += runningStr.slice(0, 1);
      runningStr = runningStr.slice(1, runningStr.length);
    }
  };

  while (runningStr) {
    _loop();
  }
  return result;
};