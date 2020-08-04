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

var propTypes = {
  /**
   * If set to true, renders `span` instead of `a`
   */
  active: _propTypes.default.bool,

  /**
   * `href` attribute for the inner `a` element
   */
  href: _propTypes.default.string,

  /**
   * `title` attribute for the inner `a` element
   */
  title: _propTypes.default.node,

  /**
   * `target` attribute for the inner `a` element
   */
  target: _propTypes.default.string
};
var defaultProps = {
  active: false
};

var BreadcrumbItem =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(BreadcrumbItem, _React$Component);

  function BreadcrumbItem() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = BreadcrumbItem.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        active = _this$props.active,
        href = _this$props.href,
        title = _this$props.title,
        target = _this$props.target,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["active", "href", "title", "target", "className"]); // Don't try to render these props on non-active <span>.

    var linkProps = {
      href: href,
      title: title,
      target: target
    };
    return _react.default.createElement("li", {
      className: (0, _classnames.default)(className, {
        active: active
      })
    }, active ? _react.default.createElement("span", props) : _react.default.createElement(_SafeAnchor.default, (0, _extends2.default)({}, props, linkProps)));
  };

  return BreadcrumbItem;
}(_react.default.Component);

BreadcrumbItem.propTypes = propTypes;
BreadcrumbItem.defaultProps = defaultProps;
var _default = BreadcrumbItem;
exports.default = _default;
module.exports = exports["default"];