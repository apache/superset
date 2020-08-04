import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
var propTypes = {
  /**
   * An icon name without "glyphicon-" prefix. See e.g. http://getbootstrap.com/components/#glyphicons
   */
  glyph: PropTypes.string.isRequired
};

var Glyphicon =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Glyphicon, _React$Component);

  function Glyphicon() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Glyphicon.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        glyph = _this$props.glyph,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["glyph", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, glyph)] = true, _extends2));

    return React.createElement("span", _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Glyphicon;
}(React.Component);

Glyphicon.propTypes = propTypes;
export default bsClass('glyphicon', Glyphicon);