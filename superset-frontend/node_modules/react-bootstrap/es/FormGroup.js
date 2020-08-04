import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { bsClass, bsSizes, getClassSet, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';
import ValidComponentChildren from './utils/ValidComponentChildren';
var propTypes = {
  /**
   * Sets `id` on `<FormControl>` and `htmlFor` on `<FormGroup.Label>`.
   */
  controlId: PropTypes.string,
  validationState: PropTypes.oneOf(['success', 'warning', 'error', null])
};
var childContextTypes = {
  $bs_formGroup: PropTypes.object.isRequired
};

var FormGroup =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(FormGroup, _React$Component);

  function FormGroup() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = FormGroup.prototype;

  _proto.getChildContext = function getChildContext() {
    var _this$props = this.props,
        controlId = _this$props.controlId,
        validationState = _this$props.validationState;
    return {
      $bs_formGroup: {
        controlId: controlId,
        validationState: validationState
      }
    };
  };

  _proto.hasFeedback = function hasFeedback(children) {
    var _this = this;

    return ValidComponentChildren.some(children, function (child) {
      return child.props.bsRole === 'feedback' || child.props.children && _this.hasFeedback(child.props.children);
    });
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        validationState = _this$props2.validationState,
        className = _this$props2.className,
        children = _this$props2.children,
        props = _objectWithoutPropertiesLoose(_this$props2, ["validationState", "className", "children"]);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['controlId']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var classes = _extends({}, getClassSet(bsProps), {
      'has-feedback': this.hasFeedback(children)
    });

    if (validationState) {
      classes["has-" + validationState] = true;
    }

    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes)
    }), children);
  };

  return FormGroup;
}(React.Component);

FormGroup.propTypes = propTypes;
FormGroup.childContextTypes = childContextTypes;
export default bsClass('form-group', bsSizes([Size.LARGE, Size.SMALL], FormGroup));