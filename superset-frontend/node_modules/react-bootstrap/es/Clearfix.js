import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import capitalize from './utils/capitalize';
import { DEVICE_SIZES } from './utils/StyleConfig';
var propTypes = {
  componentClass: elementType,

  /**
   * Apply clearfix
   *
   * on Extra small devices Phones
   *
   * adds class `visible-xs-block`
   */
  visibleXsBlock: PropTypes.bool,

  /**
   * Apply clearfix
   *
   * on Small devices Tablets
   *
   * adds class `visible-sm-block`
   */
  visibleSmBlock: PropTypes.bool,

  /**
   * Apply clearfix
   *
   * on Medium devices Desktops
   *
   * adds class `visible-md-block`
   */
  visibleMdBlock: PropTypes.bool,

  /**
   * Apply clearfix
   *
   * on Large devices Desktops
   *
   * adds class `visible-lg-block`
   */
  visibleLgBlock: PropTypes.bool
};
var defaultProps = {
  componentClass: 'div'
};

var Clearfix =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Clearfix, _React$Component);

  function Clearfix() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Clearfix.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        Component = _this$props.componentClass,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["componentClass", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);
    DEVICE_SIZES.forEach(function (size) {
      var propName = "visible" + capitalize(size) + "Block";

      if (elementProps[propName]) {
        classes["visible-" + size + "-block"] = true;
      }

      delete elementProps[propName];
    });
    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Clearfix;
}(React.Component);

Clearfix.propTypes = propTypes;
Clearfix.defaultProps = defaultProps;
export default bsClass('clearfix', Clearfix);