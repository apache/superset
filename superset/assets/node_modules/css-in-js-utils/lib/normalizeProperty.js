'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = normalizeProperty;

var _camelCaseProperty = require('./camelCaseProperty');

var _camelCaseProperty2 = _interopRequireDefault(_camelCaseProperty);

var _unprefixProperty = require('./unprefixProperty');

var _unprefixProperty2 = _interopRequireDefault(_unprefixProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function normalizeProperty(property) {
  return (0, _unprefixProperty2.default)((0, _camelCaseProperty2.default)(property));
}
module.exports = exports['default'];