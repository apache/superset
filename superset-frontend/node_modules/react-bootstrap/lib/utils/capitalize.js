"use strict";

exports.__esModule = true;
exports.default = capitalize;

function capitalize(string) {
  return "" + string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = exports["default"];