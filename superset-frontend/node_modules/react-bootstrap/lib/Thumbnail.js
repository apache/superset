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

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

/* eslint-disable jsx-a11y/alt-text */
var propTypes = {
  /**
   * src property that is passed down to the image inside this component
   */
  src: _propTypes.default.string,

  /**
   * alt property that is passed down to the image inside this component
   */
  alt: _propTypes.default.string,

  /**
   * href property that is passed down to the image inside this component
   */
  href: _propTypes.default.string,

  /**
   * onError callback that is passed down to the image inside this component
   */
  onError: _propTypes.default.func,

  /**
   * onLoad callback that is passed down to the image inside this component
   */
  onLoad: _propTypes.default.func
};

var Thumbnail =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Thumbnail, _React$Component);

  function Thumbnail() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Thumbnail.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        src = _this$props.src,
        alt = _this$props.alt,
        onError = _this$props.onError,
        onLoad = _this$props.onLoad,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["src", "alt", "onError", "onLoad", "className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var Component = elementProps.href ? _SafeAnchor.default : 'div';
    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), _react.default.createElement("img", {
      src: src,
      alt: alt,
      onError: onError,
      onLoad: onLoad
    }), children && _react.default.createElement("div", {
      className: "caption"
    }, children));
  };

  return Thumbnail;
}(_react.default.Component);

Thumbnail.propTypes = propTypes;

var _default = (0, _bootstrapUtils.bsClass)('thumbnail', Thumbnail);

exports.default = _default;
module.exports = exports["default"];