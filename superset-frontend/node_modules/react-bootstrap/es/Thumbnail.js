import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";

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

var Thumbnail =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Thumbnail, _React$Component);

  function Thumbnail() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Thumbnail.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        src = _this$props.src,
        alt = _this$props.alt,
        onError = _this$props.onError,
        onLoad = _this$props.onLoad,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["src", "alt", "onError", "onLoad", "className", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var Component = elementProps.href ? SafeAnchor : 'div';
    var classes = getClassSet(bsProps);
    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }), React.createElement("img", {
      src: src,
      alt: alt,
      onError: onError,
      onLoad: onLoad
    }), children && React.createElement("div", {
      className: "caption"
    }, children));
  };

  return Thumbnail;
}(React.Component);

Thumbnail.propTypes = propTypes;
export default bsClass('thumbnail', Thumbnail);