import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import Glyphicon from './Glyphicon';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
var defaultProps = {
  bsRole: 'feedback'
};
var contextTypes = {
  $bs_formGroup: PropTypes.object
};

var FormControlFeedback =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(FormControlFeedback, _React$Component);

  function FormControlFeedback() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = FormControlFeedback.prototype;

  _proto.getGlyph = function getGlyph(validationState) {
    switch (validationState) {
      case 'success':
        return 'ok';

      case 'warning':
        return 'warning-sign';

      case 'error':
        return 'remove';

      default:
        return null;
    }
  };

  _proto.renderDefaultFeedback = function renderDefaultFeedback(formGroup, className, classes, elementProps) {
    var glyph = this.getGlyph(formGroup && formGroup.validationState);

    if (!glyph) {
      return null;
    }

    return React.createElement(Glyphicon, _extends({}, elementProps, {
      glyph: glyph,
      className: classNames(className, classes)
    }));
  };

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["className", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    if (!children) {
      return this.renderDefaultFeedback(this.context.$bs_formGroup, className, classes, elementProps);
    }

    var child = React.Children.only(children);
    return React.cloneElement(child, _extends({}, elementProps, {
      className: classNames(child.props.className, className, classes)
    }));
  };

  return FormControlFeedback;
}(React.Component);

FormControlFeedback.defaultProps = defaultProps;
FormControlFeedback.contextTypes = contextTypes;
export default bsClass('form-control-feedback', FormControlFeedback);