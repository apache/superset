"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _values = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/object/values"));

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _StyleConfig = require("./utils/StyleConfig");

var _CloseButton = _interopRequireDefault(require("./CloseButton"));

var propTypes = {
  onDismiss: _propTypes.default.func,
  closeLabel: _propTypes.default.string
};
var defaultProps = {
  closeLabel: 'Close alert'
};

var Alert =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Alert, _React$Component);

  function Alert() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Alert.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        onDismiss = _this$props.onDismiss,
        closeLabel = _this$props.closeLabel,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["onDismiss", "closeLabel", "className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var dismissable = !!onDismiss;
    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'dismissable')] = dismissable, _extends2));
    return _react.default.createElement("div", (0, _extends3.default)({}, elementProps, {
      role: "alert",
      className: (0, _classnames.default)(className, classes)
    }), dismissable && _react.default.createElement(_CloseButton.default, {
      onClick: onDismiss,
      label: closeLabel
    }), children);
  };

  return Alert;
}(_react.default.Component);

Alert.propTypes = propTypes;
Alert.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsStyles)((0, _values.default)(_StyleConfig.State), _StyleConfig.State.INFO, (0, _bootstrapUtils.bsClass)('alert', Alert));

exports.default = _default;
module.exports = exports["default"];