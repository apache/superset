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

var _warning = _interopRequireDefault(require("warning"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _Fade = _interopRequireDefault(require("./Fade"));

var propTypes = {
  /**
   * Uniquely identify the `<TabPane>` among its siblings.
   */
  eventKey: _propTypes.default.any,

  /**
   * Use animation when showing or hiding `<TabPane>`s. Use `false` to disable,
   * `true` to enable the default `<Fade>` animation or
   * a react-transition-group v2 `<Transition/>` component.
   */
  animation: _propTypes.default.oneOfType([_propTypes.default.bool, _elementType.default]),

  /** @private * */
  id: _propTypes.default.string,

  /** @private * */
  'aria-labelledby': _propTypes.default.string,

  /**
   * If not explicitly specified and rendered in the context of a
   * `<TabContent>`, the `bsClass` of the `<TabContent>` suffixed by `-pane`.
   * If otherwise not explicitly specified, `tab-pane`.
   */
  bsClass: _propTypes.default.string,

  /**
   * Transition onEnter callback when animation is not `false`
   */
  onEnter: _propTypes.default.func,

  /**
   * Transition onEntering callback when animation is not `false`
   */
  onEntering: _propTypes.default.func,

  /**
   * Transition onEntered callback when animation is not `false`
   */
  onEntered: _propTypes.default.func,

  /**
   * Transition onExit callback when animation is not `false`
   */
  onExit: _propTypes.default.func,

  /**
   * Transition onExiting callback when animation is not `false`
   */
  onExiting: _propTypes.default.func,

  /**
   * Transition onExited callback when animation is not `false`
   */
  onExited: _propTypes.default.func,

  /**
   * Wait until the first "enter" transition to mount the tab (add it to the DOM)
   */
  mountOnEnter: _propTypes.default.bool,

  /**
   * Unmount the tab (remove it from the DOM) when it is no longer visible
   */
  unmountOnExit: _propTypes.default.bool
};
var contextTypes = {
  $bs_tabContainer: _propTypes.default.shape({
    getTabId: _propTypes.default.func,
    getPaneId: _propTypes.default.func
  }),
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
/**
 * We override the `<TabContainer>` context so `<Nav>`s in `<TabPane>`s don't
 * conflict with the top level one.
 */

var childContextTypes = {
  $bs_tabContainer: _propTypes.default.oneOf([null])
};

var TabPane =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(TabPane, _React$Component);

  function TabPane(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleEnter = _this.handleEnter.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleExited = _this.handleExited.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.in = false;
    return _this;
  }

  var _proto = TabPane.prototype;

  _proto.getChildContext = function getChildContext() {
    return {
      $bs_tabContainer: null
    };
  };

  _proto.componentDidMount = function componentDidMount() {
    if (this.shouldBeIn()) {
      // In lieu of the action event firing.
      this.handleEnter();
    }
  };

  _proto.componentDidUpdate = function componentDidUpdate() {
    if (this.in) {
      if (!this.shouldBeIn()) {
        // We shouldn't be active any more. Notify the parent.
        this.handleExited();
      }
    } else if (this.shouldBeIn()) {
      // We are the active child. Notify the parent.
      this.handleEnter();
    }
  };

  _proto.componentWillUnmount = function componentWillUnmount() {
    if (this.in) {
      // In lieu of the action event firing.
      this.handleExited();
    }
  };

  _proto.getAnimation = function getAnimation() {
    if (this.props.animation != null) {
      return this.props.animation;
    }

    var tabContent = this.context.$bs_tabContent;
    return tabContent && tabContent.animation;
  };

  _proto.handleEnter = function handleEnter() {
    var tabContent = this.context.$bs_tabContent;

    if (!tabContent) {
      return;
    }

    this.in = tabContent.onPaneEnter(this, this.props.eventKey);
  };

  _proto.handleExited = function handleExited() {
    var tabContent = this.context.$bs_tabContent;

    if (!tabContent) {
      return;
    }

    tabContent.onPaneExited(this);
    this.in = false;
  };

  _proto.isActive = function isActive() {
    var tabContent = this.context.$bs_tabContent;
    var activeKey = tabContent && tabContent.activeKey;
    return this.props.eventKey === activeKey;
  };

  _proto.shouldBeIn = function shouldBeIn() {
    return this.getAnimation() && this.isActive();
  };

  _proto.render = function render() {
    var _this$props = this.props,
        eventKey = _this$props.eventKey,
        className = _this$props.className,
        onEnter = _this$props.onEnter,
        onEntering = _this$props.onEntering,
        onEntered = _this$props.onEntered,
        onExit = _this$props.onExit,
        onExiting = _this$props.onExiting,
        onExited = _this$props.onExited,
        propsMountOnEnter = _this$props.mountOnEnter,
        propsUnmountOnExit = _this$props.unmountOnExit,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["eventKey", "className", "onEnter", "onEntering", "onEntered", "onExit", "onExiting", "onExited", "mountOnEnter", "unmountOnExit"]);
    var _this$context = this.context,
        tabContent = _this$context.$bs_tabContent,
        tabContainer = _this$context.$bs_tabContainer;

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['animation']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var active = this.isActive();
    var animation = this.getAnimation();
    var mountOnEnter = propsMountOnEnter != null ? propsMountOnEnter : tabContent && tabContent.mountOnEnter;
    var unmountOnExit = propsUnmountOnExit != null ? propsUnmountOnExit : tabContent && tabContent.unmountOnExit;

    if (!active && !animation && unmountOnExit) {
      return null;
    }

    var Transition = animation === true ? _Fade.default : animation || null;

    if (tabContent) {
      bsProps.bsClass = (0, _bootstrapUtils.prefix)(tabContent, 'pane');
    }

    var classes = (0, _extends2.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      active: active
    });

    if (tabContainer) {
      process.env.NODE_ENV !== "production" ? (0, _warning.default)(!elementProps.id && !elementProps['aria-labelledby'], 'In the context of a `<TabContainer>`, `<TabPanes>` are given ' + 'generated `id` and `aria-labelledby` attributes for the sake of ' + 'proper component accessibility. Any provided ones will be ignored. ' + 'To control these attributes directly provide a `generateChildId` ' + 'prop to the parent `<TabContainer>`.') : void 0;
      elementProps.id = tabContainer.getPaneId(eventKey);
      elementProps['aria-labelledby'] = tabContainer.getTabId(eventKey);
    }

    var pane = _react.default.createElement("div", (0, _extends2.default)({}, elementProps, {
      role: "tabpanel",
      "aria-hidden": !active,
      className: (0, _classnames.default)(className, classes)
    }));

    if (Transition) {
      var exiting = tabContent && tabContent.exiting;
      return _react.default.createElement(Transition, {
        in: active && !exiting,
        onEnter: (0, _createChainedFunction.default)(this.handleEnter, onEnter),
        onEntering: onEntering,
        onEntered: onEntered,
        onExit: onExit,
        onExiting: onExiting,
        onExited: (0, _createChainedFunction.default)(this.handleExited, onExited),
        mountOnEnter: mountOnEnter,
        unmountOnExit: unmountOnExit
      }, pane);
    }

    return pane;
  };

  return TabPane;
}(_react.default.Component);

TabPane.propTypes = propTypes;
TabPane.contextTypes = contextTypes;
TabPane.childContextTypes = childContextTypes;

var _default = (0, _bootstrapUtils.bsClass)('tab-pane', TabPane);

exports.default = _default;
module.exports = exports["default"];