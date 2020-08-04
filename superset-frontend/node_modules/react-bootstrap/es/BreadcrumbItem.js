import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import SafeAnchor from './SafeAnchor';
var propTypes = {
  /**
   * If set to true, renders `span` instead of `a`
   */
  active: PropTypes.bool,

  /**
   * `href` attribute for the inner `a` element
   */
  href: PropTypes.string,

  /**
   * `title` attribute for the inner `a` element
   */
  title: PropTypes.node,

  /**
   * `target` attribute for the inner `a` element
   */
  target: PropTypes.string
};
var defaultProps = {
  active: false
};

var BreadcrumbItem =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(BreadcrumbItem, _React$Component);

  function BreadcrumbItem() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = BreadcrumbItem.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        active = _this$props.active,
        href = _this$props.href,
        title = _this$props.title,
        target = _this$props.target,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["active", "href", "title", "target", "className"]); // Don't try to render these props on non-active <span>.


    var linkProps = {
      href: href,
      title: title,
      target: target
    };
    return React.createElement("li", {
      className: classNames(className, {
        active: active
      })
    }, active ? React.createElement("span", props) : React.createElement(SafeAnchor, _extends({}, props, linkProps)));
  };

  return BreadcrumbItem;
}(React.Component);

BreadcrumbItem.propTypes = propTypes;
BreadcrumbItem.defaultProps = defaultProps;
export default BreadcrumbItem;