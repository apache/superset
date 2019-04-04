'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PhotoshopPointerCircle = undefined;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactcss = require('reactcss');

var _reactcss2 = _interopRequireDefault(_reactcss);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var PhotoshopPointerCircle = exports.PhotoshopPointerCircle = function PhotoshopPointerCircle(_ref) {
  var hsl = _ref.hsl;

  var styles = (0, _reactcss2.default)({
    'default': {
      picker: {
        width: '12px',
        height: '12px',
        borderRadius: '6px',
        boxShadow: 'inset 0 0 0 1px #fff',
        transform: 'translate(-6px, -6px)'
      }
    },
    'black-outline': {
      picker: {
        boxShadow: 'inset 0 0 0 1px #000'
      }
    }
  }, { 'black-outline': hsl.l > 0.5 });

  return _react2.default.createElement('div', { style: styles.picker });
};

exports.default = PhotoshopPointerCircle;