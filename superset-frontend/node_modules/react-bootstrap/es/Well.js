import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import { bsClass, bsSizes, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';

var Well =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Well, _React$Component);

  function Well() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Well.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);
    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Well;
}(React.Component);

export default bsClass('well', bsSizes([Size.LARGE, Size.SMALL], Well));