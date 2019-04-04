import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';
import BaseOverlay from 'react-overlays/lib/Overlay';
import elementType from 'prop-types-extra/lib/elementType';

import Fade from './Fade';

var propTypes = _extends({}, BaseOverlay.propTypes, {

  /**
   * Set the visibility of the Overlay
   */
  show: PropTypes.bool,
  /**
   * Specify whether the overlay should trigger onHide when the user clicks outside the overlay
   */
  rootClose: PropTypes.bool,
  /**
   * A callback invoked by the overlay when it wishes to be hidden. Required if
   * `rootClose` is specified.
   */
  onHide: PropTypes.func,

  /**
   * Use animation
   */
  animation: PropTypes.oneOfType([PropTypes.bool, elementType]),

  /**
   * Callback fired before the Overlay transitions in
   */
  onEnter: PropTypes.func,

  /**
   * Callback fired as the Overlay begins to transition in
   */
  onEntering: PropTypes.func,

  /**
   * Callback fired after the Overlay finishes transitioning in
   */
  onEntered: PropTypes.func,

  /**
   * Callback fired right before the Overlay transitions out
   */
  onExit: PropTypes.func,

  /**
   * Callback fired as the Overlay begins to transition out
   */
  onExiting: PropTypes.func,

  /**
   * Callback fired after the Overlay finishes transitioning out
   */
  onExited: PropTypes.func,

  /**
   * Sets the direction of the Overlay.
   */
  placement: PropTypes.oneOf(['top', 'right', 'bottom', 'left'])
});

var defaultProps = {
  animation: Fade,
  rootClose: false,
  show: false,
  placement: 'right'
};

var Overlay = function (_React$Component) {
  _inherits(Overlay, _React$Component);

  function Overlay() {
    _classCallCheck(this, Overlay);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Overlay.prototype.render = function render() {
    var _props = this.props,
        animation = _props.animation,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['animation', 'children']);

    var transition = animation === true ? Fade : animation || null;

    var child = void 0;

    if (!transition) {
      child = cloneElement(children, {
        className: classNames(children.props.className, 'in')
      });
    } else {
      child = children;
    }

    return React.createElement(
      BaseOverlay,
      _extends({}, props, {
        transition: transition
      }),
      child
    );
  };

  return Overlay;
}(React.Component);

Overlay.propTypes = propTypes;
Overlay.defaultProps = defaultProps;

export default Overlay;