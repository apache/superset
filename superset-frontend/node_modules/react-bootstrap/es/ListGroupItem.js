import _Object$values from "@babel/runtime-corejs2/core-js/object/values";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
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

var ListGroupItem =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ListGroupItem, _React$Component);

  function ListGroupItem() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ListGroupItem.prototype;

  _proto.renderHeader = function renderHeader(header, headingClassName) {
    if (React.isValidElement(header)) {
      return cloneElement(header, {
        className: classNames(header.props.className, headingClassName)
      });
    }

    return React.createElement("h4", {
      className: headingClassName
    }, header);
  };

  _proto.render = function render() {
    var _this$props = this.props,
        active = _this$props.active,
        disabled = _this$props.disabled,
        className = _this$props.className,
        header = _this$props.header,
        listItem = _this$props.listItem,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["active", "disabled", "className", "header", "listItem", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), {
      active: active,
      disabled: disabled
    });

    var Component;

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

    elementProps.className = classNames(className, classes); // TODO: Deprecate `header` prop.

    if (header) {
      return React.createElement(Component, elementProps, this.renderHeader(header, prefix(bsProps, 'heading')), React.createElement("p", {
        className: prefix(bsProps, 'text')
      }, children));
    }

    return React.createElement(Component, elementProps, children);
  };

  return ListGroupItem;
}(React.Component);

ListGroupItem.propTypes = propTypes;
ListGroupItem.defaultProps = defaultProps;
export default bsClass('list-group-item', bsStyles(_Object$values(State), ListGroupItem));