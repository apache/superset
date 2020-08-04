import _Object$values from "@babel/runtime-corejs2/core-js/object/values";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import { bsClass, bsStyles, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import { State, Style } from './utils/StyleConfig';

var Label =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Label, _React$Component);

  function Label() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Label.prototype;

  _proto.hasContent = function hasContent(children) {
    var result = false;
    React.Children.forEach(children, function (child) {
      if (result) {
        return;
      }

      if (child || child === 0) {
        result = true;
      }
    });
    return result;
  };

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["className", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), {
      // Hack for collapsing on IE8.
      hidden: !this.hasContent(children)
    });

    return React.createElement("span", _extends({}, elementProps, {
      className: classNames(className, classes)
    }), children);
  };

  return Label;
}(React.Component);

export default bsClass('label', bsStyles(_Object$values(State).concat([Style.DEFAULT, Style.PRIMARY]), Style.DEFAULT, Label));