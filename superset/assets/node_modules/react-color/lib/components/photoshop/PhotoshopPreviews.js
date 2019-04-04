'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PhotoshopPreviews = undefined;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactcss = require('reactcss');

var _reactcss2 = _interopRequireDefault(_reactcss);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var PhotoshopPreviews = exports.PhotoshopPreviews = function PhotoshopPreviews(_ref) {
  var rgb = _ref.rgb,
      currentColor = _ref.currentColor;

  var styles = (0, _reactcss2.default)({
    'default': {
      swatches: {
        border: '1px solid #B3B3B3',
        borderBottom: '1px solid #F0F0F0',
        marginBottom: '2px',
        marginTop: '1px'
      },
      new: {
        height: '34px',
        background: 'rgb(' + rgb.r + ',' + rgb.g + ', ' + rgb.b + ')',
        boxShadow: 'inset 1px 0 0 #000, inset -1px 0 0 #000, inset 0 1px 0 #000'
      },
      current: {
        height: '34px',
        background: currentColor,
        boxShadow: 'inset 1px 0 0 #000, inset -1px 0 0 #000, inset 0 -1px 0 #000'
      },
      label: {
        fontSize: '14px',
        color: '#000',
        textAlign: 'center'
      }
    }
  });

  return _react2.default.createElement(
    'div',
    null,
    _react2.default.createElement(
      'div',
      { style: styles.label },
      'new'
    ),
    _react2.default.createElement(
      'div',
      { style: styles.swatches },
      _react2.default.createElement('div', { style: styles.new }),
      _react2.default.createElement('div', { style: styles.current })
    ),
    _react2.default.createElement(
      'div',
      { style: styles.label },
      'current'
    )
  );
};

exports.default = PhotoshopPreviews;