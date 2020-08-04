import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";

/* eslint-disable jsx-a11y/label-has-for */
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import warning from 'warning';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
var propTypes = {
  inline: PropTypes.bool,
  disabled: PropTypes.bool,
  title: PropTypes.string,

  /**
   * Only valid if `inline` is not set.
   */
  validationState: PropTypes.oneOf(['success', 'warning', 'error', null]),

  /**
   * Attaches a ref to the `<input>` element. Only functions can be used here.
   *
   * ```js
   * <Checkbox inputRef={ref => { this.input = ref; }} />
   * ```
   */
  inputRef: PropTypes.func
};
var defaultProps = {
  inline: false,
  disabled: false,
  title: ''
};

var Checkbox =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Checkbox, _React$Component);

  function Checkbox() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Checkbox.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        inline = _this$props.inline,
        disabled = _this$props.disabled,
        validationState = _this$props.validationState,
        inputRef = _this$props.inputRef,
        className = _this$props.className,
        style = _this$props.style,
        title = _this$props.title,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["inline", "disabled", "validationState", "inputRef", "className", "style", "title", "children"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var input = React.createElement("input", _extends({}, elementProps, {
      ref: inputRef,
      type: "checkbox",
      disabled: disabled
    }));

    if (inline) {
      var _classes2;

      var _classes = (_classes2 = {}, _classes2[prefix(bsProps, 'inline')] = true, _classes2.disabled = disabled, _classes2); // Use a warning here instead of in propTypes to get better-looking
      // generated documentation.


      process.env.NODE_ENV !== "production" ? warning(!validationState, '`validationState` is ignored on `<Checkbox inline>`. To display ' + 'validation state on an inline checkbox, set `validationState` on a ' + 'parent `<FormGroup>` or other element instead.') : void 0;
      return React.createElement("label", {
        className: classNames(className, _classes),
        style: style,
        title: title
      }, input, children);
    }

    var classes = _extends({}, getClassSet(bsProps), {
      disabled: disabled
    });

    if (validationState) {
      classes["has-" + validationState] = true;
    }

    return React.createElement("div", {
      className: classNames(className, classes),
      style: style
    }, React.createElement("label", {
      title: title
    }, input, children));
  };

  return Checkbox;
}(React.Component);

Checkbox.propTypes = propTypes;
Checkbox.defaultProps = defaultProps;
export default bsClass('checkbox', Checkbox);