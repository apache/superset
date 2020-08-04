import _Object$values from "@babel/runtime-corejs2/core-js/object/values";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';
import { bsClass, bsSizes, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { Size, State, Style } from './utils/StyleConfig';
import SafeAnchor from './SafeAnchor';
var propTypes = {
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  block: PropTypes.bool,
  onClick: PropTypes.func,
  componentClass: elementType,
  href: PropTypes.string,

  /**
   * Defines HTML button type attribute
   * @defaultValue 'button'
   */
  type: PropTypes.oneOf(['button', 'reset', 'submit'])
};
var defaultProps = {
  active: false,
  block: false,
  disabled: false
};

var Button =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Button, _React$Component);

  function Button() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Button.prototype;

  _proto.renderAnchor = function renderAnchor(elementProps, className) {
    return React.createElement(SafeAnchor, _extends({}, elementProps, {
      className: classNames(className, elementProps.disabled && 'disabled')
    }));
  };

  _proto.renderButton = function renderButton(_ref, className) {
    var componentClass = _ref.componentClass,
        elementProps = _objectWithoutPropertiesLoose(_ref, ["componentClass"]);

    var Component = componentClass || 'button';
    return React.createElement(Component, _extends({}, elementProps, {
      type: elementProps.type || 'button',
      className: className
    }));
  };

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        active = _this$props.active,
        block = _this$props.block,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["active", "block", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {
      active: active
    }, _extends2[prefix(bsProps, 'block')] = block, _extends2));

    var fullClassName = classNames(className, classes);

    if (elementProps.href) {
      return this.renderAnchor(elementProps, fullClassName);
    }

    return this.renderButton(elementProps, fullClassName);
  };

  return Button;
}(React.Component);

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;
export default bsClass('btn', bsSizes([Size.LARGE, Size.SMALL, Size.XSMALL], bsStyles(_Object$values(State).concat([Style.DEFAULT, Style.PRIMARY, Style.LINK]), Style.DEFAULT, Button)));