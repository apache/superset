import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import elementType from 'prop-types-extra/lib/elementType';

import ListGroupItem from './ListGroupItem';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = {
  /**
   * You can use a custom element type for this component.
   *
   * If not specified, it will be treated as `'li'` if every child is a
   * non-actionable `<ListGroupItem>`, and `'div'` otherwise.
   */
  componentClass: elementType
};

function getDefaultComponent(children) {
  if (!children) {
    // FIXME: This is the old behavior. Is this right?
    return 'div';
  }

  if (ValidComponentChildren.some(children, function (child) {
    return child.type !== ListGroupItem || child.props.href || child.props.onClick;
  })) {
    return 'div';
  }

  return 'ul';
}

var ListGroup = function (_React$Component) {
  _inherits(ListGroup, _React$Component);

  function ListGroup() {
    _classCallCheck(this, ListGroup);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ListGroup.prototype.render = function render() {
    var _props = this.props,
        children = _props.children,
        _props$componentClass = _props.componentClass,
        Component = _props$componentClass === undefined ? getDefaultComponent(children) : _props$componentClass,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['children', 'componentClass', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    var useListItem = Component === 'ul' && ValidComponentChildren.every(children, function (child) {
      return child.type === ListGroupItem;
    });

    return React.createElement(
      Component,
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      useListItem ? ValidComponentChildren.map(children, function (child) {
        return cloneElement(child, { listItem: true });
      }) : children
    );
  };

  return ListGroup;
}(React.Component);

ListGroup.propTypes = propTypes;

export default bsClass('list-group', ListGroup);