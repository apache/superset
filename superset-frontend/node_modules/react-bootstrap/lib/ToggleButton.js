"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _Button = _interopRequireDefault(require("./Button"));

var propTypes = {
  /**
   * The `<input>` `type`
   * @type {[type]}
   */
  type: _propTypes.default.oneOf(['checkbox', 'radio']),

  /**
   * The HTML input name, used to group like checkboxes or radio buttons together
   * semantically
   */
  name: _propTypes.default.string,

  /**
   * The checked state of the input, managed by `<ToggleButtonGroup>`` automatically
   */
  checked: _propTypes.default.bool,

  /**
   * The disabled state of both the label and input
   */
  disabled: _propTypes.default.bool,

  /**
   * [onChange description]
   */
  onChange: _propTypes.default.func,

  /**
   * The value of the input, and unique identifier in the ToggleButtonGroup
   */
  value: _propTypes.default.any.isRequired
};

var ToggleButton =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(ToggleButton, _React$Component);

  function ToggleButton() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ToggleButton.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        name = _this$props.name,
        checked = _this$props.checked,
        type = _this$props.type,
        onChange = _this$props.onChange,
        value = _this$props.value,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["children", "name", "checked", "type", "onChange", "value"]);
    var disabled = props.disabled;
    return _react.default.createElement(_Button.default, (0, _extends2.default)({}, props, {
      active: !!checked,
      componentClass: "label"
    }), _react.default.createElement("input", {
      name: name,
      type: type,
      autoComplete: "off",
      value: value,
      checked: !!checked,
      disabled: !!disabled,
      onChange: onChange
    }), children);
  };

  return ToggleButton;
}(_react.default.Component);

ToggleButton.propTypes = propTypes;
var _default = ToggleButton;
exports.default = _default;
module.exports = exports["default"];