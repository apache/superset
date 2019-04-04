'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _DropdownToggle = require('./DropdownToggle');

var _DropdownToggle2 = _interopRequireDefault(_DropdownToggle);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SplitToggle = function (_React$Component) {
  (0, _inherits3.default)(SplitToggle, _React$Component);

  function SplitToggle() {
    (0, _classCallCheck3.default)(this, SplitToggle);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  SplitToggle.prototype.render = function render() {
    return _react2.default.createElement(_DropdownToggle2.default, (0, _extends3.default)({}, this.props, {
      useAnchor: false,
      noCaret: false
    }));
  };

  return SplitToggle;
}(_react2.default.Component);

SplitToggle.defaultProps = _DropdownToggle2.default.defaultProps;

exports.default = SplitToggle;
module.exports = exports['default'];