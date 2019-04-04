import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
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

var ToggleButton = function (_React$Component) {
  _inherits(ToggleButton, _React$Component);

  function ToggleButton() {
    _classCallCheck(this, ToggleButton);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ToggleButton.prototype.render = function render() {
    var _props = this.props,
        children = _props.children,
        name = _props.name,
        checked = _props.checked,
        type = _props.type,
        onChange = _props.onChange,
        value = _props.value,
        props = _objectWithoutProperties(_props, ['children', 'name', 'checked', 'type', 'onChange', 'value']);

    var disabled = props.disabled;

    return React.createElement(
      Button,
      _extends({}, props, {
        active: !!checked,
        componentClass: 'label'
      }),
      React.createElement('input', {
        name: name,
        type: type,
        autoComplete: 'off',
        value: value,
        checked: !!checked,
        disabled: !!disabled,
        onChange: onChange
      }),
      children
    );
  };

  return ToggleButton;
}(React.Component);

ToggleButton.propTypes = propTypes;

export default ToggleButton;