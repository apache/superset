import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
/* eslint-disable jsx-a11y/alt-text */

import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import SafeAnchor from './SafeAnchor';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * src property that is passed down to the image inside this component
   */
  src: PropTypes.string,
  /**
   * alt property that is passed down to the image inside this component
   */
  alt: PropTypes.string,
  /**
   * href property that is passed down to the image inside this component
   */
  href: PropTypes.string,
  /**
   * onError callback that is passed down to the image inside this component
   */
  onError: PropTypes.func,
  /**
   * onLoad callback that is passed down to the image inside this component
   */
  onLoad: PropTypes.func
};

var Thumbnail = function (_React$Component) {
  _inherits(Thumbnail, _React$Component);

  function Thumbnail() {
    _classCallCheck(this, Thumbnail);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Thumbnail.prototype.render = function render() {
    var _props = this.props,
        src = _props.src,
        alt = _props.alt,
        onError = _props.onError,
        onLoad = _props.onLoad,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['src', 'alt', 'onError', 'onLoad', 'className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var Component = elementProps.href ? SafeAnchor : 'div';
    var classes = getClassSet(bsProps);

    return React.createElement(
      Component,
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      React.createElement('img', { src: src, alt: alt, onError: onError, onLoad: onLoad }),
      children && React.createElement(
        'div',
        { className: 'caption' },
        children
      )
    );
  };

  return Thumbnail;
}(React.Component);

Thumbnail.propTypes = propTypes;

export default bsClass('thumbnail', Thumbnail);