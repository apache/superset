import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { bsClass, bsSizes, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';
var propTypes = {
  /**
   * A css class to apply to the Modal dialog DOM node.
   */
  dialogClassName: PropTypes.string
};

var ModalDialog =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ModalDialog, _React$Component);

  function ModalDialog() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ModalDialog.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        dialogClassName = _this$props.dialogClassName,
        className = _this$props.className,
        style = _this$props.style,
        children = _this$props.children,
        onMouseDownDialog = _this$props.onMouseDownDialog,
        props = _objectWithoutPropertiesLoose(_this$props, ["dialogClassName", "className", "style", "children", "onMouseDownDialog"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var bsClassName = prefix(bsProps);

    var modalStyle = _extends({
      display: 'block'
    }, style);

    var dialogClasses = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[bsClassName] = false, _extends2[prefix(bsProps, 'dialog')] = true, _extends2));

    return React.createElement("div", _extends({}, elementProps, {
      tabIndex: "-1",
      role: "dialog",
      style: modalStyle,
      className: classNames(className, bsClassName)
    }), React.createElement("div", {
      className: classNames(dialogClassName, dialogClasses),
      onMouseDown: onMouseDownDialog
    }, React.createElement("div", {
      className: prefix(bsProps, 'content'),
      role: "document"
    }, children)));
  };

  return ModalDialog;
}(React.Component);

ModalDialog.propTypes = propTypes;
export default bsClass('modal', bsSizes([Size.LARGE, Size.SMALL], ModalDialog));