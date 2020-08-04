"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  /**
   * An icon name without "glyphicon-" prefix. See e.g. http://getbootstrap.com/components/#glyphicons
   */
  glyph: _propTypes.default.string.isRequired
};

var Glyphicon =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Glyphicon, _React$Component);

  function Glyphicon() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Glyphicon.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        glyph = _this$props.glyph,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["glyph", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, glyph)] = true, _extends2));
    return _react.default.createElement("span", (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return Glyphicon;
}(_react.default.Component);

Glyphicon.propTypes = propTypes;

var _default = (0, _bootstrapUtils.bsClass)('glyphicon', Glyphicon);

exports.default = _default;
module.exports = exports["default"];