import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import Media from './Media';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
var propTypes = {
  /**
   * Align the media to the top, middle, or bottom of the media object.
   */
  align: PropTypes.oneOf(['top', 'middle', 'bottom'])
};

var MediaLeft =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(MediaLeft, _React$Component);

  function MediaLeft() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = MediaLeft.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        align = _this$props.align,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["align", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    if (align) {
      // The class is e.g. `media-top`, not `media-left-top`.
      classes[prefix(Media.defaultProps, align)] = true;
    }

    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return MediaLeft;
}(React.Component);

MediaLeft.propTypes = propTypes;
export default bsClass('media-left', MediaLeft);