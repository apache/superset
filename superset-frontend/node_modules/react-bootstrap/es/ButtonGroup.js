import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import all from 'prop-types-extra/lib/all';
import Button from './Button';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
var propTypes = {
  vertical: PropTypes.bool,
  justified: PropTypes.bool,

  /**
   * Display block buttons; only useful when used with the "vertical" prop.
   * @type {bool}
   */
  block: all(PropTypes.bool, function (_ref) {
    var block = _ref.block,
        vertical = _ref.vertical;
    return block && !vertical ? new Error('`block` requires `vertical` to be set to have any effect') : null;
  })
};
var defaultProps = {
  block: false,
  justified: false,
  vertical: false
};

var ButtonGroup =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ButtonGroup, _React$Component);

  function ButtonGroup() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ButtonGroup.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        block = _this$props.block,
        justified = _this$props.justified,
        vertical = _this$props.vertical,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["block", "justified", "vertical", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps)] = !vertical, _extends2[prefix(bsProps, 'vertical')] = vertical, _extends2[prefix(bsProps, 'justified')] = justified, _extends2[prefix(Button.defaultProps, 'block')] = block, _extends2));

    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return ButtonGroup;
}(React.Component);

ButtonGroup.propTypes = propTypes;
ButtonGroup.defaultProps = defaultProps;
export default bsClass('btn-group', ButtonGroup);