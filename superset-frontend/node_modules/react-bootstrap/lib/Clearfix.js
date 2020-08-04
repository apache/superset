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

var _capitalize = _interopRequireDefault(require("./utils/capitalize"));

var _StyleConfig = require("./utils/StyleConfig");

var propTypes = {
  componentClass: _elementType.default,

  /**
   * Apply clearfix
   *
   * on Extra small devices Phones
   *
   * adds class `visible-xs-block`
   */
  visibleXsBlock: _propTypes.default.bool,

  /**
   * Apply clearfix
   *
   * on Small devices Tablets
   *
   * adds class `visible-sm-block`
   */
  visibleSmBlock: _propTypes.default.bool,

  /**
   * Apply clearfix
   *
   * on Medium devices Desktops
   *
   * adds class `visible-md-block`
   */
  visibleMdBlock: _propTypes.default.bool,

  /**
   * Apply clearfix
   *
   * on Large devices Desktops
   *
   * adds class `visible-lg-block`
   */
  visibleLgBlock: _propTypes.default.bool
};
var defaultProps = {
  componentClass: 'div'
};

var Clearfix =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Clearfix, _React$Component);

  function Clearfix() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Clearfix.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        Component = _this$props.componentClass,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["componentClass", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    _StyleConfig.DEVICE_SIZES.forEach(function (size) {
      var propName = "visible" + (0, _capitalize.default)(size) + "Block";

      if (elementProps[propName]) {
        classes["visible-" + size + "-block"] = true;
      }

      delete elementProps[propName];
    });

    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return Clearfix;
}(_react.default.Component);

Clearfix.propTypes = propTypes;
Clearfix.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('clearfix', Clearfix);

exports.default = _default;
module.exports = exports["default"];