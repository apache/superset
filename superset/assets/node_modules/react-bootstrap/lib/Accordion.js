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

var _PanelGroup = require('./PanelGroup');

var _PanelGroup2 = _interopRequireDefault(_PanelGroup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Accordion = function (_React$Component) {
  (0, _inherits3.default)(Accordion, _React$Component);

  function Accordion() {
    (0, _classCallCheck3.default)(this, Accordion);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Accordion.prototype.render = function render() {
    return _react2.default.createElement(
      _PanelGroup2.default,
      (0, _extends3.default)({}, this.props, { accordion: true }),
      this.props.children
    );
  };

  return Accordion;
}(_react2.default.Component);

exports.default = Accordion;
module.exports = exports['default'];