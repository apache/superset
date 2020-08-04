"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireWildcard(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _warning = _interopRequireDefault(require("warning"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

// TODO: This should probably take a single `aspectRatio` prop.
var propTypes = {
  /**
   * This component requires a single child element
   */
  children: _propTypes.default.element.isRequired,

  /**
   * 16by9 aspect ratio
   */
  a16by9: _propTypes.default.bool,

  /**
   * 4by3 aspect ratio
   */
  a4by3: _propTypes.default.bool
};
var defaultProps = {
  a16by9: false,
  a4by3: false
};

var ResponsiveEmbed =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(ResponsiveEmbed, _React$Component);

  function ResponsiveEmbed() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ResponsiveEmbed.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        a16by9 = _this$props.a16by9,
        a4by3 = _this$props.a4by3,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["a16by9", "a4by3", "className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== "production" ? (0, _warning.default)(a16by9 || a4by3, 'Either `a16by9` or `a4by3` must be set.') : void 0;
    process.env.NODE_ENV !== "production" ? (0, _warning.default)(!(a16by9 && a4by3), 'Only one of `a16by9` or `a4by3` can be set.') : void 0;
    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, '16by9')] = a16by9, _extends2[(0, _bootstrapUtils.prefix)(bsProps, '4by3')] = a4by3, _extends2));
    return _react.default.createElement("div", {
      className: (0, _classnames.default)(classes)
    }, (0, _react.cloneElement)(children, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'item'))
    })));
  };

  return ResponsiveEmbed;
}(_react.default.Component);

ResponsiveEmbed.propTypes = propTypes;
ResponsiveEmbed.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('embed-responsive', ResponsiveEmbed);

exports.default = _default;
module.exports = exports["default"];