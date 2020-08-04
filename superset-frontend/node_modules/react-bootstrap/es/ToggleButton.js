import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import PropTypes from 'prop-types';
import React from 'react';
import Button from './Button';
var propTypes = {
  /**
   * The `<input>` `type`
   * @type {[type]}
   */
  type: PropTypes.oneOf(['checkbox', 'radio']),

  /**
   * The HTML input name, used to group like checkboxes or radio buttons together
   * semantically
   */
  name: PropTypes.string,

  /**
   * The checked state of the input, managed by `<ToggleButtonGroup>`` automatically
   */
  checked: PropTypes.bool,

  /**
   * The disabled state of both the label and input
   */
  disabled: PropTypes.bool,

  /**
   * [onChange description]
   */
  onChange: PropTypes.func,

  /**
   * The value of the input, and unique identifier in the ToggleButtonGroup
   */
  value: PropTypes.any.isRequired
};

var ToggleButton =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ToggleButton, _React$Component);

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
        props = _objectWithoutPropertiesLoose(_this$props, ["children", "name", "checked", "type", "onChange", "value"]);

    var disabled = props.disabled;
    return React.createElement(Button, _extends({}, props, {
      active: !!checked,
      componentClass: "label"
    }), React.createElement("input", {
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
}(React.Component);

ToggleButton.propTypes = propTypes;
export default ToggleButton;