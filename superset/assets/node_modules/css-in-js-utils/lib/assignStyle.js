'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = assignStyle;

var _isobject = require('isobject');

var _isobject2 = _interopRequireDefault(_isobject);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function assignStyle(base) {
  for (var _len = arguments.length, extendingStyles = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    extendingStyles[_key - 1] = arguments[_key];
  }

  for (var i = 0, len = extendingStyles.length; i < len; ++i) {
    var style = extendingStyles[i];

    for (var property in style) {
      var value = style[property];
      var baseValue = base[property];

      if ((0, _isobject2.default)(value)) {
        base[property] = assignStyle({}, baseValue, value);
        continue;
      }

      base[property] = value;
    }
  }

  return base;
}
module.exports = exports['default'];