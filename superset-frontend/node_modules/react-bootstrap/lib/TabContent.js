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

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  componentClass: _elementType.default,

  /**
   * Sets a default animation strategy for all children `<TabPane>`s. Use
   * `false` to disable, `true` to enable the default `<Fade>` animation or
   * a react-transition-group v2 `<Transition/>` component.
   */
  animation: _propTypes.default.oneOfType([_propTypes.default.bool, _elementType.default]),

  /**
   * Wait until the first "enter" transition to mount tabs (add them to the DOM)
   */
  mountOnEnter: _propTypes.default.bool,

  /**
   * Unmount tabs (remove it from the DOM) when they are no longer visible
   */
  unmountOnExit: _propTypes.default.bool
};
var defaultProps = {
  componentClass: 'div',
  animation: true,
  mountOnEnter: false,
  unmountOnExit: false
};
var contextTypes = {
  $bs_tabContainer: _propTypes.default.shape({
    activeKey: _propTypes.default.any
  })
};
var childContextTypes = {
  $bs_tabContent: _propTypes.default.shape({
    bsClass: _propTypes.default.string,
    animation: _propTypes.default.oneOfType([_propTypes.default.bool, _elementType.default]),
    activeKey: _propTypes.default.any,
    mountOnEnter: _propTypes.default.bool,
    unmountOnExit: _propTypes.default.bool,
    onPaneEnter: _propTypes.default.func.isRequired,
    onPaneExited: _propTypes.default.func.isRequired,
    exiting: _propTypes.default.bool.isRequired
  })
};

var TabContent =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(TabContent, _React$Component);

  function TabContent(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handlePaneEnter = _this.handlePaneEnter.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handlePaneExited = _this.handlePaneExited.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this))); // Active entries in state will be `null` unless `animation` is set. Need
    // to track active child in case keys swap and the active child changes
    // but the active key does not.

    _this.state = {
      activeKey: null,
      activeChild: null
    };
    return _this;
  }

  var _proto = TabContent.prototype;

  _proto.getChildContext = function getChildContext() {
    var _this$props = this.props,
        bsClass = _this$props.bsClass,
        animation = _this$props.animation,
        mountOnEnter = _this$props.mountOnEnter,
        unmountOnExit = _this$props.unmountOnExit;
    var stateActiveKey = this.state.activeKey;
    var containerActiveKey = this.getContainerActiveKey();
    var activeKey = stateActiveKey != null ? stateActiveKey : containerActiveKey;
    var exiting = stateActiveKey != null && stateActiveKey !== containerActiveKey;
    return {
      $bs_tabContent: {
        bsClass: bsClass,
        animation: animation,
        activeKey: activeKey,
        mountOnEnter: mountOnEnter,
        unmountOnExit: unmountOnExit,
        onPaneEnter: this.handlePaneEnter,
        onPaneExited: this.handlePaneExited,
        exiting: exiting
      }
    };
  };

  _proto.UNSAFE_componentWillReceiveProps = function UNSAFE_componentWillReceiveProps(nextProps) {
    // eslint-disable-line
    if (!nextProps.animation && this.state.activeChild) {
      this.setState({
        activeKey: null,
        activeChild: null
      });
    }
  };

  _proto.componentWillUnmount = function componentWillUnmount() {
    this.isUnmounted = true;
  };

  _proto.getContainerActiveKey = function getContainerActiveKey() {
    var tabContainer = this.context.$bs_tabContainer;
    return tabContainer && tabContainer.activeKey;
  };

  _proto.handlePaneEnter = function handlePaneEnter(child, childKey) {
    if (!this.props.animation) {
      return false;
    } // It's possible that this child should be transitioning out.


    if (childKey !== this.getContainerActiveKey()) {
      return false;
    }

    this.setState({
      activeKey: childKey,
      activeChild: child
    });
    return true;
  };

  _proto.handlePaneExited = function handlePaneExited(child) {
    // This might happen as everything is unmounting.
    if (this.isUnmounted) {
      return;
    }

    this.setState(function (_ref) {
      var activeChild = _ref.activeChild;

      if (activeChild !== child) {
        return null;
      }

      return {
        activeKey: null,
        activeChild: null
      };
    });
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        Component = _this$props2.componentClass,
        className = _this$props2.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props2, ["componentClass", "className"]);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['animation', 'mountOnEnter', 'unmountOnExit']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'content'))
    }));
  };

  return TabContent;
}(_react.default.Component);

TabContent.propTypes = propTypes;
TabContent.defaultProps = defaultProps;
TabContent.contextTypes = contextTypes;
TabContent.childContextTypes = childContextTypes;

var _default = (0, _bootstrapUtils.bsClass)('tab', TabContent);

exports.default = _default;
module.exports = exports["default"];