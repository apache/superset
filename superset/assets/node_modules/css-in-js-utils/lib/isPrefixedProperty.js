"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isPrefixedProperty;
var regex = /^(Webkit|Moz|O|ms)/;

function isPrefixedProperty(property) {
  return regex.test(property);
}
module.exports = exports["default"];