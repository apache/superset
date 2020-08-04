import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import InputGroupAddon from './InputGroupAddon';
import InputGroupButton from './InputGroupButton';
import { bsClass, bsSizes, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';

var InputGroup =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(InputGroup, _React$Component);

  function InputGroup() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = InputGroup.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);
    return React.createElement("span", _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return InputGroup;
}(React.Component);

InputGroup.Addon = InputGroupAddon;
InputGroup.Button = InputGroupButton;
export default bsClass('input-group', bsSizes([Size.LARGE, Size.SMALL], InputGroup));