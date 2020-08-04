"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _warning = _interopRequireDefault(require("warning"));

var _FormControlFeedback = _interopRequireDefault(require("./FormControlFeedback"));

var _FormControlStatic = _interopRequireDefault(require("./FormControlStatic"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _StyleConfig = require("./utils/StyleConfig");

var propTypes = {
  componentClass: _elementType.default,

  /**
   * Only relevant if `componentClass` is `'input'`.
   */
  type: _propTypes.default.string,

  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  id: _propTypes.default.string,

  /**
   * Attaches a ref to the `<input>` element. Only functions can be used here.
   *
   * ```js
   * <FormControl inputRef={ref => { this.input = ref; }} />
   * ```
   */
  inputRef: _propTypes.default.func
};
var defaultProps = {
  componentClass: 'input'
};
var contextTypes = {
  $bs_formGroup: _propTypes.default.object
};

var FormControl =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(FormControl, _React$Component);

  function FormControl() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = FormControl.prototype;

  _proto.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;
    var _this$props = this.props,
        Component = _this$props.componentClass,
        type = _this$props.type,
        _this$props$id = _this$props.id,
        id = _this$props$id === void 0 ? controlId : _this$props$id,
        inputRef = _this$props.inputRef,
        className = _this$props.className,
        bsSize = _this$props.bsSize,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["componentClass", "type", "id", "inputRef", "className", "bsSize"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== "production" ? (0, _warning.default)(controlId == null || id === controlId, '`controlId` is ignored on `<FormControl>` when `id` is specified.') : void 0; // input[type="file"] should not have .form-control.

    var classes;

    if (type !== 'file') {
      classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    } // If user provides a size, make sure to append it to classes as input-
    // e.g. if bsSize is small, it will append input-sm


    if (bsSize) {
      var size = _StyleConfig.SIZE_MAP[bsSize] || bsSize;
      classes[(0, _bootstrapUtils.prefix)({
        bsClass: 'input'
      }, size)] = true;
    }

    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      type: type,
      id: id,
      ref: inputRef,
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return FormControl;
}(_react.default.Component);

FormControl.propTypes = propTypes;
FormControl.defaultProps = defaultProps;
FormControl.contextTypes = contextTypes;
FormControl.Feedback = _FormControlFeedback.default;
FormControl.Static = _FormControlStatic.default;

var _default = (0, _bootstrapUtils.bsClass)('form-control', (0, _bootstrapUtils.bsSizes)([_StyleConfig.Size.SMALL, _StyleConfig.Size.LARGE], FormControl));

exports.default = _default;
module.exports = exports["default"];