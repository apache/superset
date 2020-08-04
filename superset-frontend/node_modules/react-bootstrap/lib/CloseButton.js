"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var propTypes = {
  label: _propTypes.default.string.isRequired,
  onClick: _propTypes.default.func
};
var defaultProps = {
  label: 'Close'
};

var CloseButton =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(CloseButton, _React$Component);

  function CloseButton() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = CloseButton.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        label = _this$props.label,
        onClick = _this$props.onClick;
    return _react.default.createElement("button", {
      type: "button",
      className: "close",
      onClick: onClick
    }, _react.default.createElement("span", {
      "aria-hidden": "true"
    }, "\xD7"), _react.default.createElement("span", {
      className: "sr-only"
    }, label));
  };

  return CloseButton;
}(_react.default.Component);

CloseButton.propTypes = propTypes;
CloseButton.defaultProps = defaultProps;
var _default = CloseButton;
exports.default = _default;
module.exports = exports["default"];