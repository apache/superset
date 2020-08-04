"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _all = _interopRequireDefault(require("prop-types-extra/lib/all"));

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var propTypes = {
  /**
   * Highlight the menu item as active.
   */
  active: _propTypes.default.bool,

  /**
   * Disable the menu item, making it unselectable.
   */
  disabled: _propTypes.default.bool,

  /**
   * Styles the menu item as a horizontal rule, providing visual separation between
   * groups of menu items.
   */
  divider: (0, _all.default)(_propTypes.default.bool, function (_ref) {
    var divider = _ref.divider,
        children = _ref.children;
    return divider && children ? new Error('Children will not be rendered for dividers') : null;
  }),

  /**
   * Value passed to the `onSelect` handler, useful for identifying the selected menu item.
   */
  eventKey: _propTypes.default.any,

  /**
   * Styles the menu item as a header label, useful for describing a group of menu items.
   */
  header: _propTypes.default.bool,

  /**
   * HTML `href` attribute corresponding to `a.href`.
   */
  href: _propTypes.default.string,

  /**
   * Callback fired when the menu item is clicked.
   */
  onClick: _propTypes.default.func,

  /**
   * Callback fired when the menu item is selected.
   *
   * ```js
   * (eventKey: any, event: Object) => any
   * ```
   */
  onSelect: _propTypes.default.func
};
var defaultProps = {
  divider: false,
  disabled: false,
  header: false
};

var MenuItem =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(MenuItem, _React$Component);

  function MenuItem(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleClick = _this.handleClick.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    return _this;
  }

  var _proto = MenuItem.prototype;

  _proto.handleClick = function handleClick(event) {
    var _this$props = this.props,
        href = _this$props.href,
        disabled = _this$props.disabled,
        onSelect = _this$props.onSelect,
        eventKey = _this$props.eventKey;

    if (!href || disabled) {
      event.preventDefault();
    }

    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, event);
    }
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        active = _this$props2.active,
        disabled = _this$props2.disabled,
        divider = _this$props2.divider,
        header = _this$props2.header,
        onClick = _this$props2.onClick,
        className = _this$props2.className,
        style = _this$props2.style,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props2, ["active", "disabled", "divider", "header", "onClick", "className", "style"]);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['eventKey', 'onSelect']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    if (divider) {
      // Forcibly blank out the children; separators shouldn't render any.
      elementProps.children = undefined;
      return _react.default.createElement("li", (0, _extends2.default)({}, elementProps, {
        role: "separator",
        className: (0, _classnames.default)(className, 'divider'),
        style: style
      }));
    }

    if (header) {
      return _react.default.createElement("li", (0, _extends2.default)({}, elementProps, {
        role: "heading",
        className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'header')),
        style: style
      }));
    }

    return _react.default.createElement("li", {
      role: "presentation",
      className: (0, _classnames.default)(className, {
        active: active,
        disabled: disabled
      }),
      style: style
    }, _react.default.createElement(_SafeAnchor.default, (0, _extends2.default)({}, elementProps, {
      role: "menuitem",
      tabIndex: "-1",
      onClick: (0, _createChainedFunction.default)(onClick, this.handleClick)
    })));
  };

  return MenuItem;
}(_react.default.Component);

MenuItem.propTypes = propTypes;
MenuItem.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('dropdown', MenuItem);

exports.default = _default;
module.exports = exports["default"];