import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import PropTypes from 'prop-types';
import React from 'react';
import invariant from 'invariant';
import uncontrollable from 'uncontrollable';

import chainFunction from './utils/createChainedFunction';
import ValidChildren from './utils/ValidComponentChildren';
import ButtonGroup from './ButtonGroup';
import ToggleButton from './ToggleButton';

var propTypes = {
  /**
   * An HTML `<input>` name for each child button.
   *
   * __Required if `type` is set to `'radio'`__
   */
  name: PropTypes.string,

  /**
   * The value, or array of values, of the active (pressed) buttons
   *
   * @controllable onChange
   */
  value: PropTypes.any,

  /**
   * Callback fired when a button is pressed, depending on whether the `type`
   * is `'radio'` or `'checkbox'`, `onChange` will be called with the value or
   * array of active values
   *
   * @controllable values
   */
  onChange: PropTypes.func,

  /**
   * The input `type` of the rendered buttons, determines the toggle behavior
   * of the buttons
   */
  type: PropTypes.oneOf(['checkbox', 'radio']).isRequired
};

var defaultProps = {
  type: 'radio'
};

var ToggleButtonGroup = function (_React$Component) {
  _inherits(ToggleButtonGroup, _React$Component);

  function ToggleButtonGroup() {
    _classCallCheck(this, ToggleButtonGroup);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ToggleButtonGroup.prototype.getValues = function getValues() {
    var value = this.props.value;

    return value == null ? [] : [].concat(value);
  };

  ToggleButtonGroup.prototype.handleToggle = function handleToggle(value) {
    var _props = this.props,
        type = _props.type,
        onChange = _props.onChange;

    var values = this.getValues();
    var isActive = values.indexOf(value) !== -1;

    if (type === 'radio') {
      if (!isActive) {
        onChange(value);
      }
      return;
    }

    if (isActive) {
      onChange(values.filter(function (n) {
        return n !== value;
      }));
    } else {
      onChange([].concat(values, [value]));
    }
  };

  ToggleButtonGroup.prototype.render = function render() {
    var _this2 = this;

    var _props2 = this.props,
        children = _props2.children,
        type = _props2.type,
        name = _props2.name,
        props = _objectWithoutProperties(_props2, ['children', 'type', 'name']);

    var values = this.getValues();

    !(type !== 'radio' || !!name) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'A `name` is required to group the toggle buttons when the `type` ' + 'is set to "radio"') : invariant(false) : void 0;

    delete props.onChange;
    delete props.value;

    // the data attribute is required b/c twbs css uses it in the selector
    return React.createElement(
      ButtonGroup,
      _extends({}, props, { 'data-toggle': 'buttons' }),
      ValidChildren.map(children, function (child) {
        var _child$props = child.props,
            value = _child$props.value,
            onChange = _child$props.onChange;

        var handler = function handler() {
          return _this2.handleToggle(value);
        };

        return React.cloneElement(child, {
          type: type,
          name: child.name || name,
          checked: values.indexOf(value) !== -1,
          onChange: chainFunction(onChange, handler)
        });
      })
    );
  };

  return ToggleButtonGroup;
}(React.Component);

ToggleButtonGroup.propTypes = propTypes;
ToggleButtonGroup.defaultProps = defaultProps;

var UncontrolledToggleButtonGroup = uncontrollable(ToggleButtonGroup, {
  value: 'onChange'
});

UncontrolledToggleButtonGroup.Button = ToggleButton;

export default UncontrolledToggleButtonGroup;