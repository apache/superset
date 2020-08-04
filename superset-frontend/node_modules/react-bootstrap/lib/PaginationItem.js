"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = PaginationItem;
exports.Last = exports.Next = exports.Ellipsis = exports.Prev = exports.First = void 0;

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

/* eslint-disable react/no-multi-comp */
var propTypes = {
  eventKey: _propTypes.default.any,
  className: _propTypes.default.string,
  onSelect: _propTypes.default.func,
  disabled: _propTypes.default.bool,
  active: _propTypes.default.bool,
  activeLabel: _propTypes.default.string.isRequired
};
var defaultProps = {
  active: false,
  disabled: false,
  activeLabel: '(current)'
};

function PaginationItem(_ref) {
  var active = _ref.active,
      disabled = _ref.disabled,
      className = _ref.className,
      style = _ref.style,
      activeLabel = _ref.activeLabel,
      children = _ref.children,
      props = (0, _objectWithoutPropertiesLoose2.default)(_ref, ["active", "disabled", "className", "style", "activeLabel", "children"]);
  var Component = active || disabled ? 'span' : _SafeAnchor.default;
  return _react.default.createElement("li", {
    style: style,
    className: (0, _classnames.default)(className, {
      active: active,
      disabled: disabled
    })
  }, _react.default.createElement(Component, (0, _extends2.default)({
    disabled: disabled
  }, props), children, active && _react.default.createElement("span", {
    className: "sr-only"
  }, activeLabel)));
}

PaginationItem.propTypes = propTypes;
PaginationItem.defaultProps = defaultProps;

function createButton(name, defaultValue, label) {
  var _class, _temp;

  if (label === void 0) {
    label = name;
  }

  return _temp = _class =
  /*#__PURE__*/
  function (_React$Component) {
    (0, _inheritsLoose2.default)(_class, _React$Component);

    function _class() {
      return _React$Component.apply(this, arguments) || this;
    }

    var _proto = _class.prototype;

    _proto.render = function render() {
      var _this$props = this.props,
          disabled = _this$props.disabled,
          children = _this$props.children,
          className = _this$props.className,
          props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["disabled", "children", "className"]);
      var Component = disabled ? 'span' : _SafeAnchor.default;
      return _react.default.createElement("li", (0, _extends2.default)({
        "aria-label": label,
        className: (0, _classnames.default)(className, {
          disabled: disabled
        })
      }, props), _react.default.createElement(Component, null, children || defaultValue));
    };

    return _class;
  }(_react.default.Component), _class.displayName = name, _class.propTypes = {
    disabled: _propTypes.default.bool
  }, _temp;
}

var First = createButton('First', "\xAB");
exports.First = First;
var Prev = createButton('Prev', "\u2039");
exports.Prev = Prev;
var Ellipsis = createButton('Ellipsis', "\u2026", 'More');
exports.Ellipsis = Ellipsis;
var Next = createButton('Next', "\u203A");
exports.Next = Next;
var Last = createButton('Last', "\xBB");
exports.Last = Last;