import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import isRequiredForA11y from 'prop-types-extra/lib/isRequiredForA11y';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
var propTypes = {
  /**
   * An html id attribute, necessary for accessibility
   * @type {string|number}
   * @required
   */
  id: isRequiredForA11y(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),

  /**
   * Sets the direction the Tooltip is positioned towards.
   */
  placement: PropTypes.oneOf(['top', 'right', 'bottom', 'left']),

  /**
   * The "top" position value for the Tooltip.
   */
  positionTop: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  /**
   * The "left" position value for the Tooltip.
   */
  positionLeft: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  /**
   * The "top" position value for the Tooltip arrow.
   */
  arrowOffsetTop: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  /**
   * The "left" position value for the Tooltip arrow.
   */
  arrowOffsetLeft: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};
var defaultProps = {
  placement: 'right'
};

var Tooltip =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Tooltip, _React$Component);

  function Tooltip() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Tooltip.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        placement = _this$props.placement,
        positionTop = _this$props.positionTop,
        positionLeft = _this$props.positionLeft,
        arrowOffsetTop = _this$props.arrowOffsetTop,
        arrowOffsetLeft = _this$props.arrowOffsetLeft,
        className = _this$props.className,
        style = _this$props.style,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["placement", "positionTop", "positionLeft", "arrowOffsetTop", "arrowOffsetLeft", "className", "style", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[placement] = true, _extends2));

    var outerStyle = _extends({
      top: positionTop,
      left: positionLeft
    }, style);

    var arrowStyle = {
      top: arrowOffsetTop,
      left: arrowOffsetLeft
    };
    return React.createElement("div", _extends({}, elementProps, {
      role: "tooltip",
      className: classNames(className, classes),
      style: outerStyle
    }), React.createElement("div", {
      className: prefix(bsProps, 'arrow'),
      style: arrowStyle
    }), React.createElement("div", {
      className: prefix(bsProps, 'inner')
    }, children));
  };

  return Tooltip;
}(React.Component);

Tooltip.propTypes = propTypes;
Tooltip.defaultProps = defaultProps;
export default bsClass('tooltip', Tooltip);