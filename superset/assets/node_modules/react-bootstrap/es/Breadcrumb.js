import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import BreadcrumbItem from './BreadcrumbItem';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var Breadcrumb = function (_React$Component) {
  _inherits(Breadcrumb, _React$Component);

  function Breadcrumb() {
    _classCallCheck(this, Breadcrumb);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Breadcrumb.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    return React.createElement('ol', _extends({}, elementProps, {
      role: 'navigation',
      'aria-label': 'breadcrumbs',
      className: classNames(className, classes)
    }));
  };

  return Breadcrumb;
}(React.Component);

Breadcrumb.Item = BreadcrumbItem;

export default bsClass('breadcrumb', Breadcrumb);