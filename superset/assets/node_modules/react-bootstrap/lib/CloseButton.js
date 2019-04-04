'use strict';

exports.__esModule = true;

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  label: _propTypes2.default.string.isRequired,
  onClick: _propTypes2.default.func
};

var defaultProps = {
  label: 'Close'
};

var CloseButton = function (_React$Component) {
  (0, _inherits3.default)(CloseButton, _React$Component);

  function CloseButton() {
    (0, _classCallCheck3.default)(this, CloseButton);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  CloseButton.prototype.render = function render() {
    var _props = this.props,
        label = _props.label,
        onClick = _props.onClick;

    return _react2.default.createElement(
      'button',
      {
        type: 'button',
        className: 'close',
        onClick: onClick
      },
      _react2.default.createElement(
        'span',
        { 'aria-hidden': 'true' },
        '\xD7'
      ),
      _react2.default.createElement(
        'span',
        { className: 'sr-only' },
        label
      )
    );
  };

  return CloseButton;
}(_react2.default.Component);

CloseButton.propTypes = propTypes;
CloseButton.defaultProps = defaultProps;

exports.default = CloseButton;
module.exports = exports['default'];