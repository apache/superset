'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Block = undefined;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _reactcss = require('reactcss');

var _reactcss2 = _interopRequireDefault(_reactcss);

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

var _common = require('../common');

var _BlockSwatches = require('./BlockSwatches');

var _BlockSwatches2 = _interopRequireDefault(_BlockSwatches);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Block = exports.Block = function Block(_ref) {
  var onChange = _ref.onChange,
      onSwatchHover = _ref.onSwatchHover,
      hex = _ref.hex,
      colors = _ref.colors,
      width = _ref.width,
      triangle = _ref.triangle,
      _ref$className = _ref.className,
      className = _ref$className === undefined ? '' : _ref$className;

  var transparent = hex === 'transparent';
  var handleChange = function handleChange(hexCode, e) {
    _color2.default.isValidHex(hexCode) && onChange({
      hex: hexCode,
      source: 'hex'
    }, e);
  };

  var styles = (0, _reactcss2.default)({
    'default': {
      card: {
        width: width,
        background: '#fff',
        boxShadow: '0 1px rgba(0,0,0,.1)',
        borderRadius: '6px',
        position: 'relative'
      },
      head: {
        height: '110px',
        background: hex,
        borderRadius: '6px 6px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      },
      body: {
        padding: '10px'
      },
      label: {
        fontSize: '18px',
        color: _color2.default.getContrastingColor(hex),
        position: 'relative'
      },
      triangle: {
        width: '0px',
        height: '0px',
        borderStyle: 'solid',
        borderWidth: '0 10px 10px 10px',
        borderColor: 'transparent transparent ' + hex + ' transparent',
        position: 'absolute',
        top: '-10px',
        left: '50%',
        marginLeft: '-10px'
      },
      input: {
        width: '100%',
        fontSize: '12px',
        color: '#666',
        border: '0px',
        outline: 'none',
        height: '22px',
        boxShadow: 'inset 0 0 0 1px #ddd',
        borderRadius: '4px',
        padding: '0 7px',
        boxSizing: 'border-box'
      }
    },
    'hide-triangle': {
      triangle: {
        display: 'none'
      }
    }
  }, { 'hide-triangle': triangle === 'hide' });

  return _react2.default.createElement(
    'div',
    { style: styles.card, className: 'block-picker ' + className },
    _react2.default.createElement('div', { style: styles.triangle }),
    _react2.default.createElement(
      'div',
      { style: styles.head },
      transparent && _react2.default.createElement(_common.Checkboard, { borderRadius: '6px 6px 0 0' }),
      _react2.default.createElement(
        'div',
        { style: styles.label },
        hex
      )
    ),
    _react2.default.createElement(
      'div',
      { style: styles.body },
      _react2.default.createElement(_BlockSwatches2.default, { colors: colors, onClick: handleChange, onSwatchHover: onSwatchHover }),
      _react2.default.createElement(_common.EditableInput, {
        style: { input: styles.input },
        value: hex,
        onChange: handleChange
      })
    )
  );
};

Block.propTypes = {
  width: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number]),
  colors: _propTypes2.default.arrayOf(_propTypes2.default.string),
  triangle: _propTypes2.default.oneOf(['top', 'hide'])
};

Block.defaultProps = {
  width: 170,
  colors: ['#D9E3F0', '#F47373', '#697689', '#37D67A', '#2CCCE4', '#555555', '#dce775', '#ff8a65', '#ba68c8'],
  triangle: 'top'
};

exports.default = (0, _common.ColorWrap)(Block);