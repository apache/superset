'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SliderSwatches = undefined;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactcss = require('reactcss');

var _reactcss2 = _interopRequireDefault(_reactcss);

var _SliderSwatch = require('./SliderSwatch');

var _SliderSwatch2 = _interopRequireDefault(_SliderSwatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SliderSwatches = exports.SliderSwatches = function SliderSwatches(_ref) {
  var onClick = _ref.onClick,
      hsl = _ref.hsl;

  var styles = (0, _reactcss2.default)({
    'default': {
      swatches: {
        marginTop: '20px'
      },
      swatch: {
        boxSizing: 'border-box',
        width: '20%',
        paddingRight: '1px',
        float: 'left'
      },
      clear: {
        clear: 'both'
      }
    }
  });

  return _react2.default.createElement(
    'div',
    { style: styles.swatches },
    _react2.default.createElement(
      'div',
      { style: styles.swatch },
      _react2.default.createElement(_SliderSwatch2.default, {
        hsl: hsl,
        offset: '.80',
        active: Math.round(hsl.l * 100) / 100 === 0.80 && Math.round(hsl.s * 100) / 100 === 0.50,
        onClick: onClick,
        first: true
      })
    ),
    _react2.default.createElement(
      'div',
      { style: styles.swatch },
      _react2.default.createElement(_SliderSwatch2.default, {
        hsl: hsl,
        offset: '.65',
        active: Math.round(hsl.l * 100) / 100 === 0.65 && Math.round(hsl.s * 100) / 100 === 0.50,
        onClick: onClick
      })
    ),
    _react2.default.createElement(
      'div',
      { style: styles.swatch },
      _react2.default.createElement(_SliderSwatch2.default, {
        hsl: hsl,
        offset: '.50',
        active: Math.round(hsl.l * 100) / 100 === 0.50 && Math.round(hsl.s * 100) / 100 === 0.50,
        onClick: onClick
      })
    ),
    _react2.default.createElement(
      'div',
      { style: styles.swatch },
      _react2.default.createElement(_SliderSwatch2.default, {
        hsl: hsl,
        offset: '.35',
        active: Math.round(hsl.l * 100) / 100 === 0.35 && Math.round(hsl.s * 100) / 100 === 0.50,
        onClick: onClick
      })
    ),
    _react2.default.createElement(
      'div',
      { style: styles.swatch },
      _react2.default.createElement(_SliderSwatch2.default, {
        hsl: hsl,
        offset: '.20',
        active: Math.round(hsl.l * 100) / 100 === 0.20 && Math.round(hsl.s * 100) / 100 === 0.50,
        onClick: onClick,
        last: true
      })
    ),
    _react2.default.createElement('div', { style: styles.clear })
  );
};

exports.default = SliderSwatches;