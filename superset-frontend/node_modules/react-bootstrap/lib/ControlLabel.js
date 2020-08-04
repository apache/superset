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

var _warning = _interopRequireDefault(require("warning"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  htmlFor: _propTypes.default.string,
  srOnly: _propTypes.default.bool
};
var defaultProps = {
  srOnly: false
};
var contextTypes = {
  $bs_formGroup: _propTypes.default.object
};

var ControlLabel =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(ControlLabel, _React$Component);

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
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["htmlFor", "srOnly", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== "production" ? (0, _warning.default)(controlId == null || htmlFor === controlId, '`controlId` is ignored on `<ControlLabel>` when `htmlFor` is specified.') : void 0;
    var classes = (0, _extends2.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      'sr-only': srOnly
    });
    return _react.default.createElement("label", (0, _extends2.default)({}, elementProps, {
      htmlFor: htmlFor,
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return ControlLabel;
}(_react.default.Component);

ControlLabel.propTypes = propTypes;
ControlLabel.defaultProps = defaultProps;
ControlLabel.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('control-label', ControlLabel);

exports.default = _default;
module.exports = exports["default"];