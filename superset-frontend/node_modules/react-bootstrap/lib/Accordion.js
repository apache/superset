"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _react = _interopRequireDefault(require("react"));

var _PanelGroup = _interopRequireDefault(require("./PanelGroup"));

var Accordion =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Accordion, _React$Component);

  function Accordion() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Accordion.prototype;

  _proto.render = function render() {
    return _react.default.createElement(_PanelGroup.default, (0, _extends2.default)({}, this.props, {
      accordion: true
    }), this.props.children);
  };

  return Accordion;
}(_react.default.Component);

var _default = Accordion;
exports.default = _default;
module.exports = exports["default"];