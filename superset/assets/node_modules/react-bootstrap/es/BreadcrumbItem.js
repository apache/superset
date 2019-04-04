import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
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

var BreadcrumbItem = function (_React$Component) {
  _inherits(BreadcrumbItem, _React$Component);

  function BreadcrumbItem() {
    _classCallCheck(this, BreadcrumbItem);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  BreadcrumbItem.prototype.render = function render() {
    var _props = this.props,
        active = _props.active,
        href = _props.href,
        title = _props.title,
        target = _props.target,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['active', 'href', 'title', 'target', 'className']);

    // Don't try to render these props on non-active <span>.


    var linkProps = { href: href, title: title, target: target };

    return React.createElement(
      'li',
      { className: classNames(className, { active: active }) },
      active ? React.createElement('span', props) : React.createElement(SafeAnchor, _extends({}, props, linkProps))
    );
  };

  return BreadcrumbItem;
}(React.Component);

BreadcrumbItem.propTypes = propTypes;
BreadcrumbItem.defaultProps = defaultProps;

export default BreadcrumbItem;