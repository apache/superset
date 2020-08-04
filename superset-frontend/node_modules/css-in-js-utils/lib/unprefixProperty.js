'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unprefixProperty;
var prefixRegex = /^(ms|Webkit|Moz|O)/;

function unprefixProperty(property) {
  var propertyWithoutPrefix = property.replace(prefixRegex, '');
  return propertyWithoutPrefix.charAt(0).toLowerCase() + propertyWithoutPrefix.slice(1);
}
module.exports = exports['default'];