"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _Dropdown = _interopRequireDefault(require("./Dropdown"));

var _splitComponentProps2 = _interopRequireDefault(require("./utils/splitComponentProps"));

var _ValidComponentChildren = _interopRequireDefault(require("./utils/ValidComponentChildren"));

var propTypes = (0, _extends2.default)({}, _Dropdown.default.propTypes, {
  // Toggle props.
  title: _propTypes.default.node.isRequired,
  noCaret: _propTypes.default.bool,
  active: _propTypes.default.bool,
  activeKey: _propTypes.default.any,
  activeHref: _propTypes.default.string,
  // Override generated docs from <Dropdown>.

  /**
   * @private
   */
  children: _propTypes.default.node
});

var NavDropdown =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(NavDropdown, _React$Component);

  function NavDropdown() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = NavDropdown.prototype;

  _proto.isActive = function isActive(_ref, activeKey, activeHref) {
    var _this = this;

    var props = _ref.props;

    if (props.active || activeKey != null && props.eventKey === activeKey || activeHref && props.href === activeHref) {
      return true;
    }

    if (_ValidComponentChildren.default.some(props.children, function (child) {
      return _this.isActive(child, activeKey, activeHref);
    })) {
      return true;
    }

    return props.active;
  };

  _proto.render = function render() {
    var _this2 = this;

    var _this$props = this.props,
        title = _this$props.title,
        activeKey = _this$props.activeKey,
        activeHref = _this$props.activeHref,
        className = _this$props.className,
        style = _this$props.style,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["title", "activeKey", "activeHref", "className", "style", "children"]);
    var active = this.isActive(this, activeKey, activeHref);
    delete props.active; // Accessed via this.isActive().

    delete props.eventKey; // Accessed via this.isActive().

    var _splitComponentProps = (0, _splitComponentProps2.default)(props, _Dropdown.default.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        toggleProps = _splitComponentProps[1]; // Unlike for the other dropdowns, styling needs to go to the `<Dropdown>`
    // rather than the `<Dropdown.Toggle>`.


    return _react.default.createElement(_Dropdown.default, (0, _extends2.default)({}, dropdownProps, {
      componentClass: "li",
      className: (0, _classnames.default)(className, {
        active: active
      }),
      style: style
    }), _react.default.createElement(_Dropdown.default.Toggle, (0, _extends2.default)({}, toggleProps, {
      useAnchor: true
    }), title), _react.default.createElement(_Dropdown.default.Menu, null, _ValidComponentChildren.default.map(children, function (child) {
      return _react.default.cloneElement(child, {
        active: _this2.isActive(child, activeKey, activeHref)
      });
    })));
  };

  return NavDropdown;
}(_react.default.Component);

NavDropdown.propTypes = propTypes;
var _default = NavDropdown;
exports.default = _default;
module.exports = exports["default"];