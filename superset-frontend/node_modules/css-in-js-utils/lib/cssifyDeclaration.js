'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = cssifyDeclaration;

var _hyphenateProperty = require('./hyphenateProperty');

var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cssifyDeclaration(property, value) {
  return (0, _hyphenateProperty2.default)(property) + ':' + value;
}
module.exports = exports['default'];