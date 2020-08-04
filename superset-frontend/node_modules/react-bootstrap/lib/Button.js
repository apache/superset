"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _values = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/object/values"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _StyleConfig = require("./utils/StyleConfig");

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var propTypes = {
  active: _propTypes.default.bool,
  disabled: _propTypes.default.bool,
  block: _propTypes.default.bool,
  onClick: _propTypes.default.func,
  componentClass: _elementType.default,
  href: _propTypes.default.string,

  /**
   * Defines HTML button type attribute
   * @defaultValue 'button'
   */
  type: _propTypes.default.oneOf(['button', 'reset', 'submit'])
};
var defaultProps = {
  active: false,
  block: false,
  disabled: false
};

var Button =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Button, _React$Component);

  function Button() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Button.prototype;

  _proto.renderAnchor = function renderAnchor(elementProps, className) {
    return _react.default.createElement(_SafeAnchor.default, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames.default)(className, elementProps.disabled && 'disabled')
    }));
  };

  _proto.renderButton = function renderButton(_ref, className) {
    var componentClass = _ref.componentClass,
        elementProps = (0, _objectWithoutPropertiesLoose2.default)(_ref, ["componentClass"]);
    var Component = componentClass || 'button';
    return _react.default.createElement(Component, (0, _extends3.default)({}, elementProps, {
      type: elementProps.type || 'button',
      className: className
    }));
  };

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        active = _this$props.active,
        block = _this$props.block,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["active", "block", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {
      active: active
    }, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'block')] = block, _extends2));
    var fullClassName = (0, _classnames.default)(className, classes);

    if (elementProps.href) {
      return this.renderAnchor(elementProps, fullClassName);
    }

    return this.renderButton(elementProps, fullClassName);
  };

  return Button;
}(_react.default.Component);

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('btn', (0, _bootstrapUtils.bsSizes)([_StyleConfig.Size.LARGE, _StyleConfig.Size.SMALL, _StyleConfig.Size.XSMALL], (0, _bootstrapUtils.bsStyles)((0, _values.default)(_StyleConfig.State).concat([_StyleConfig.Style.DEFAULT, _StyleConfig.Style.PRIMARY, _StyleConfig.Style.LINK]), _StyleConfig.Style.DEFAULT, Button)));

exports.default = _default;
module.exports = exports["default"];