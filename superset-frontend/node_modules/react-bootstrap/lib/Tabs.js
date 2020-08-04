"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _isRequiredForA11y = _interopRequireDefault(require("prop-types-extra/lib/isRequiredForA11y"));

var _uncontrollable = require("uncontrollable");

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _Nav = _interopRequireDefault(require("./Nav"));

var _NavItem = _interopRequireDefault(require("./NavItem"));

var _TabContainer = _interopRequireDefault(require("./TabContainer"));

var _TabContent = _interopRequireDefault(require("./TabContent"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _ValidComponentChildren = _interopRequireDefault(require("./utils/ValidComponentChildren"));

var TabContainer = _TabContainer.default.ControlledComponent;
var propTypes = {
  /**
   * Mark the Tab with a matching `eventKey` as active.
   *
   * @controllable onSelect
   */
  activeKey: _propTypes.default.any,

  /**
   * Navigation style
   */
  bsStyle: _propTypes.default.oneOf(['tabs', 'pills']),

  /**
   * Sets a default animation strategy. Use `false` to disable, `true`
   * to enable the default `<Fade>` animation, or a react-transition-group
   * v2 `<Transition/>` component.
   */
  animation: _propTypes.default.oneOfType([_propTypes.default.bool, _elementType.default]),
  id: (0, _isRequiredForA11y.default)(_propTypes.default.oneOfType([_propTypes.default.string, _propTypes.default.number])),

  /**
   * Callback fired when a Tab is selected.
   *
   * ```js
   * function (
   *   Any eventKey,
   *   SyntheticEvent event?
   * )
   * ```
   *
   * @controllable activeKey
   */
  onSelect: _propTypes.default.func,

  /**
   * Wait until the first "enter" transition to mount tabs (add them to the DOM)
   */
  mountOnEnter: _propTypes.default.bool,

  /**
   * Unmount tabs (remove it from the DOM) when it is no longer visible
   */
  unmountOnExit: _propTypes.default.bool
};
var defaultProps = {
  bsStyle: 'tabs',
  animation: true,
  mountOnEnter: false,
  unmountOnExit: false
};

function getDefaultActiveKey(children) {
  var defaultActiveKey;

  _ValidComponentChildren.default.forEach(children, function (child) {
    if (defaultActiveKey == null) {
      defaultActiveKey = child.props.eventKey;
    }
  });

  return defaultActiveKey;
}

var Tabs =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Tabs, _React$Component);

  function Tabs() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Tabs.prototype;

  _proto.renderTab = function renderTab(child) {
    var _child$props = child.props,
        title = _child$props.title,
        eventKey = _child$props.eventKey,
        disabled = _child$props.disabled,
        tabClassName = _child$props.tabClassName;

    if (title == null) {
      return null;
    }

    return _react.default.createElement(_NavItem.default, {
      eventKey: eventKey,
      disabled: disabled,
      className: tabClassName
    }, title);
  };

  _proto.render = function render() {
    var _this$props = this.props,
        id = _this$props.id,
        onSelect = _this$props.onSelect,
        animation = _this$props.animation,
        mountOnEnter = _this$props.mountOnEnter,
        unmountOnExit = _this$props.unmountOnExit,
        bsClass = _this$props.bsClass,
        className = _this$props.className,
        style = _this$props.style,
        children = _this$props.children,
        _this$props$activeKey = _this$props.activeKey,
        activeKey = _this$props$activeKey === void 0 ? getDefaultActiveKey(children) : _this$props$activeKey,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["id", "onSelect", "animation", "mountOnEnter", "unmountOnExit", "bsClass", "className", "style", "children", "activeKey"]);
    return _react.default.createElement(TabContainer, {
      id: id,
      activeKey: activeKey,
      onSelect: onSelect,
      className: className,
      style: style
    }, _react.default.createElement("div", null, _react.default.createElement(_Nav.default, (0, _extends2.default)({}, props, {
      role: "tablist"
    }), _ValidComponentChildren.default.map(children, this.renderTab)), _react.default.createElement(_TabContent.default, {
      bsClass: bsClass,
      animation: animation,
      mountOnEnter: mountOnEnter,
      unmountOnExit: unmountOnExit
    }, children)));
  };

  return Tabs;
}(_react.default.Component);

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;
(0, _bootstrapUtils.bsClass)('tab', Tabs);

var _default = (0, _uncontrollable.uncontrollable)(Tabs, {
  activeKey: 'onSelect'
});

exports.default = _default;
module.exports = exports["default"];