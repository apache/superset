import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
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

var Tooltip = function (_React$Component) {
  _inherits(Tooltip, _React$Component);

  function Tooltip() {
    _classCallCheck(this, Tooltip);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Tooltip.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        placement = _props.placement,
        positionTop = _props.positionTop,
        positionLeft = _props.positionLeft,
        arrowOffsetTop = _props.arrowOffsetTop,
        arrowOffsetLeft = _props.arrowOffsetLeft,
        className = _props.className,
        style = _props.style,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['placement', 'positionTop', 'positionLeft', 'arrowOffsetTop', 'arrowOffsetLeft', 'className', 'style', 'children']);

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

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        role: 'tooltip',
        className: classNames(className, classes),
        style: outerStyle
      }),
      React.createElement('div', { className: prefix(bsProps, 'arrow'), style: arrowStyle }),
      React.createElement(
        'div',
        { className: prefix(bsProps, 'inner') },
        children
      )
    );
  };

  return Tooltip;
}(React.Component);

Tooltip.propTypes = propTypes;
Tooltip.defaultProps = defaultProps;

export default bsClass('tooltip', Tooltip);