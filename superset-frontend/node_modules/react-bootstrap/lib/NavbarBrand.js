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

var contextTypes = {
  $bs_navbar: _propTypes.default.shape({
    bsClass: _propTypes.default.string
  })
};

var NavbarBrand =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(NavbarBrand, _React$Component);

  function NavbarBrand() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = NavbarBrand.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["className", "children"]);
    var navbarProps = this.context.$bs_navbar || {
      bsClass: 'navbar'
    };
    var bsClassName = (0, _bootstrapUtils.prefix)(navbarProps, 'brand');

    if (_react.default.isValidElement(children)) {
      return _react.default.cloneElement(children, {
        className: (0, _classnames.default)(children.props.className, className, bsClassName)
      });
    }

    return _react.default.createElement("span", (0, _extends2.default)({}, props, {
      className: (0, _classnames.default)(className, bsClassName)
    }), children);
  };

  return NavbarBrand;
}(_react.default.Component);

NavbarBrand.contextTypes = contextTypes;
var _default = NavbarBrand;
exports.default = _default;
module.exports = exports["default"];