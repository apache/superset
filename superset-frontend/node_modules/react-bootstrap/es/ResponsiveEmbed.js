import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';
import warning from 'warning';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils'; // TODO: This should probably take a single `aspectRatio` prop.

var propTypes = {
  /**
   * This component requires a single child element
   */
  children: PropTypes.element.isRequired,

  /**
   * 16by9 aspect ratio
   */
  a16by9: PropTypes.bool,

  /**
   * 4by3 aspect ratio
   */
  a4by3: PropTypes.bool
};
var defaultProps = {
  a16by9: false,
  a4by3: false
};

var ResponsiveEmbed =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ResponsiveEmbed, _React$Component);

  function ResponsiveEmbed() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ResponsiveEmbed.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        a16by9 = _this$props.a16by9,
        a4by3 = _this$props.a4by3,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["a16by9", "a4by3", "className", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== "production" ? warning(a16by9 || a4by3, 'Either `a16by9` or `a4by3` must be set.') : void 0;
    process.env.NODE_ENV !== "production" ? warning(!(a16by9 && a4by3), 'Only one of `a16by9` or `a4by3` can be set.') : void 0;

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, '16by9')] = a16by9, _extends2[prefix(bsProps, '4by3')] = a4by3, _extends2));

    return React.createElement("div", {
      className: classNames(classes)
    }, cloneElement(children, _extends({}, elementProps, {
      className: classNames(className, prefix(bsProps, 'item'))
    })));
  };

  return ResponsiveEmbed;
}(React.Component);

ResponsiveEmbed.propTypes = propTypes;
ResponsiveEmbed.defaultProps = defaultProps;
export default bsClass('embed-responsive', ResponsiveEmbed);