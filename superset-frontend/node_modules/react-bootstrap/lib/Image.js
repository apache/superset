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

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  /**
   * Sets image as responsive image
   */
  responsive: _propTypes.default.bool,

  /**
   * Sets image shape as rounded
   */
  rounded: _propTypes.default.bool,

  /**
   * Sets image shape as circle
   */
  circle: _propTypes.default.bool,

  /**
   * Sets image shape as thumbnail
   */
  thumbnail: _propTypes.default.bool
};
var defaultProps = {
  responsive: false,
  rounded: false,
  circle: false,
  thumbnail: false
};

var Image =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Image, _React$Component);

  function Image() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Image.prototype;

  _proto.render = function render() {
    var _classes;

    var _this$props = this.props,
        responsive = _this$props.responsive,
        rounded = _this$props.rounded,
        circle = _this$props.circle,
        thumbnail = _this$props.thumbnail,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["responsive", "rounded", "circle", "thumbnail", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (_classes = {}, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'responsive')] = responsive, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'rounded')] = rounded, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'circle')] = circle, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'thumbnail')] = thumbnail, _classes);
    return _react.default.createElement("img", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return Image;
}(_react.default.Component);

Image.propTypes = propTypes;
Image.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('img', Image);

exports.default = _default;
module.exports = exports["default"];