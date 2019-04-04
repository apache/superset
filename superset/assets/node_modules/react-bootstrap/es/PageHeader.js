import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var PageHeader = function (_React$Component) {
  _inherits(PageHeader, _React$Component);

  function PageHeader() {
    _classCallCheck(this, PageHeader);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  PageHeader.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      React.createElement(
        'h1',
        null,
        children
      )
    );
  };

  return PageHeader;
}(React.Component);

export default bsClass('page-header', PageHeader);