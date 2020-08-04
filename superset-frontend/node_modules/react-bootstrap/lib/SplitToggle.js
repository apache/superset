"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _react = _interopRequireDefault(require("react"));

var _DropdownToggle = _interopRequireDefault(require("./DropdownToggle"));

var SplitToggle =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(SplitToggle, _React$Component);

  function SplitToggle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = SplitToggle.prototype;

  _proto.render = function render() {
    return _react.default.createElement(_DropdownToggle.default, (0, _extends2.default)({}, this.props, {
      useAnchor: false,
      noCaret: false
    }));
  };

  return SplitToggle;
}(_react.default.Component);

SplitToggle.defaultProps = _DropdownToggle.default.defaultProps;
var _default = SplitToggle;
exports.default = _default;
module.exports = exports["default"];