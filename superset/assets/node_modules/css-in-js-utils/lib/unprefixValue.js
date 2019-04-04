'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unprefixValue;
var prefixRegex = /(-ms-|-webkit-|-moz-|-o-)/g;

function unprefixValue(value) {
  if (typeof value === 'string') {
    return value.replace(prefixRegex, '');
  }

  return value;
}
module.exports = exports['default'];