import _Object$values from 'babel-runtime/core-js/object/values';
import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';

import { bsClass, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { State } from './utils/StyleConfig';

var propTypes = {
  active: PropTypes.any,
  disabled: PropTypes.any,
  header: PropTypes.node,
  listItem: PropTypes.bool,
  onClick: PropTypes.func,
  href: PropTypes.string,
  type: PropTypes.string
};

var defaultProps = {
  listItem: false
};

var ListGroupItem = function (_React$Component) {
  _inherits(ListGroupItem, _React$Component);

  function ListGroupItem() {
    _classCallCheck(this, ListGroupItem);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ListGroupItem.prototype.renderHeader = function renderHeader(header, headingClassName) {
    if (React.isValidElement(header)) {
      return cloneElement(header, {
        className: classNames(header.props.className, headingClassName)
      });
    }

    return React.createElement(
      'h4',
      { className: headingClassName },
      header
    );
  };

  ListGroupItem.prototype.render = function render() {
    var _props = this.props,
        active = _props.active,
        disabled = _props.disabled,
        className = _props.className,
        header = _props.header,
        listItem = _props.listItem,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['active', 'disabled', 'className', 'header', 'listItem', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), {
      active: active,
      disabled: disabled
    });

    var Component = void 0;

    if (elementProps.href) {
      Component = 'a';
    } else if (elementProps.onClick) {
      Component = 'button';
      elementProps.type = elementProps.type || 'button';
    } else if (listItem) {
      Component = 'li';
    } else {
      Component = 'span';
    }

    elementProps.className = classNames(className, classes);

    // TODO: Deprecate `header` prop.
    if (header) {
      return React.createElement(
        Component,
        elementProps,
        this.renderHeader(header, prefix(bsProps, 'heading')),
        React.createElement(
          'p',
          { className: prefix(bsProps, 'text') },
          children
        )
      );
    }

    return React.createElement(
      Component,
      elementProps,
      children
    );
  };

  return ListGroupItem;
}(React.Component);

ListGroupItem.propTypes = propTypes;
ListGroupItem.defaultProps = defaultProps;

export default bsClass('list-group-item', bsStyles(_Object$values(State), ListGroupItem));