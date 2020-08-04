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

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  horizontal: _propTypes.default.bool,
  inline: _propTypes.default.bool,
  componentClass: _elementType.default
};
var defaultProps = {
  horizontal: false,
  inline: false,
  componentClass: 'form'
};

var Form =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Form, _React$Component);

  function Form() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Form.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        horizontal = _this$props.horizontal,
        inline = _this$props.inline,
        Component = _this$props.componentClass,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["horizontal", "inline", "componentClass", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = [];

    if (horizontal) {
      classes.push((0, _bootstrapUtils.prefix)(bsProps, 'horizontal'));
    }

    if (inline) {
      classes.push((0, _bootstrapUtils.prefix)(bsProps, 'inline'));
    }

    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return Form;
}(_react.default.Component);

Form.propTypes = propTypes;
Form.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('form', Form);

exports.default = _default;
module.exports = exports["default"];