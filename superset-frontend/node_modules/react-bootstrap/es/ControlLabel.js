import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import warning from 'warning';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
var propTypes = {
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  htmlFor: PropTypes.string,
  srOnly: PropTypes.bool
};
var defaultProps = {
  srOnly: false
};
var contextTypes = {
  $bs_formGroup: PropTypes.object
};

var ControlLabel =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ControlLabel, _React$Component);

  function ControlLabel() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ControlLabel.prototype;

  _proto.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _this$props = this.props,
        _this$props$htmlFor = _this$props.htmlFor,
        htmlFor = _this$props$htmlFor === void 0 ? controlId : _this$props$htmlFor,
        srOnly = _this$props.srOnly,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["htmlFor", "srOnly", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== "production" ? warning(controlId == null || htmlFor === controlId, '`controlId` is ignored on `<ControlLabel>` when `htmlFor` is specified.') : void 0;

    var classes = _extends({}, getClassSet(bsProps), {
      'sr-only': srOnly
    });

    return React.createElement("label", _extends({}, elementProps, {
      htmlFor: htmlFor,
      className: classNames(className, classes)
    }));
  };

  return ControlLabel;
}(React.Component);

ControlLabel.propTypes = propTypes;
ControlLabel.defaultProps = defaultProps;
ControlLabel.contextTypes = contextTypes;
export default bsClass('control-label', ControlLabel);