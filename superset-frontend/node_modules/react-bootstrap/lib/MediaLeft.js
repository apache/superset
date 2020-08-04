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

var _Media = _interopRequireDefault(require("./Media"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  /**
   * Align the media to the top, middle, or bottom of the media object.
   */
  align: _propTypes.default.oneOf(['top', 'middle', 'bottom'])
};

var MediaLeft =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(MediaLeft, _React$Component);

  function MediaLeft() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = MediaLeft.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        align = _this$props.align,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["align", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    if (align) {
      // The class is e.g. `media-top`, not `media-left-top`.
      classes[(0, _bootstrapUtils.prefix)(_Media.default.defaultProps, align)] = true;
    }

    return _react.default.createElement("div", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return MediaLeft;
}(_react.default.Component);

MediaLeft.propTypes = propTypes;

var _default = (0, _bootstrapUtils.bsClass)('media-left', MediaLeft);

exports.default = _default;
module.exports = exports["default"];