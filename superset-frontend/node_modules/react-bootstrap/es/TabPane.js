import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';
import warning from 'warning';
import { bsClass, getClassSet, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import Fade from './Fade';
var propTypes = {
  /**
   * Uniquely identify the `<TabPane>` among its siblings.
   */
  eventKey: PropTypes.any,

  /**
   * Use animation when showing or hiding `<TabPane>`s. Use `false` to disable,
   * `true` to enable the default `<Fade>` animation or
   * a react-transition-group v2 `<Transition/>` component.
   */
  animation: PropTypes.oneOfType([PropTypes.bool, elementType]),

  /** @private * */
  id: PropTypes.string,

  /** @private * */
  'aria-labelledby': PropTypes.string,

  /**
   * If not explicitly specified and rendered in the context of a
   * `<TabContent>`, the `bsClass` of the `<TabContent>` suffixed by `-pane`.
   * If otherwise not explicitly specified, `tab-pane`.
   */
  bsClass: PropTypes.string,

  /**
   * Transition onEnter callback when animation is not `false`
   */
  onEnter: PropTypes.func,

  /**
   * Transition onEntering callback when animation is not `false`
   */
  onEntering: PropTypes.func,

  /**
   * Transition onEntered callback when animation is not `false`
   */
  onEntered: PropTypes.func,

  /**
   * Transition onExit callback when animation is not `false`
   */
  onExit: PropTypes.func,

  /**
   * Transition onExiting callback when animation is not `false`
   */
  onExiting: PropTypes.func,

  /**
   * Transition onExited callback when animation is not `false`
   */
  onExited: PropTypes.func,

  /**
   * Wait until the first "enter" transition to mount the tab (add it to the DOM)
   */
  mountOnEnter: PropTypes.bool,

  /**
   * Unmount the tab (remove it from the DOM) when it is no longer visible
   */
  unmountOnExit: PropTypes.bool
};
var contextTypes = {
  $bs_tabContainer: PropTypes.shape({
    getTabId: PropTypes.func,
    getPaneId: PropTypes.func
  }),
  $bs_tabContent: PropTypes.shape({
    bsClass: PropTypes.string,
    animation: PropTypes.oneOfType([PropTypes.bool, elementType]),
    activeKey: PropTypes.any,
    mountOnEnter: PropTypes.bool,
    unmountOnExit: PropTypes.bool,
    onPaneEnter: PropTypes.func.isRequired,
    onPaneExited: PropTypes.func.isRequired,
    exiting: PropTypes.bool.isRequired
  })
};
/**
 * We override the `<TabContainer>` context so `<Nav>`s in `<TabPane>`s don't
 * conflict with the top level one.
 */

var childContextTypes = {
  $bs_tabContainer: PropTypes.oneOf([null])
};

var TabPane =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(TabPane, _React$Component);

  function TabPane(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleEnter = _this.handleEnter.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleExited = _this.handleExited.bind(_assertThisInitialized(_assertThisInitialized(_this)));
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
        props = _objectWithoutPropertiesLoose(_this$props, ["eventKey", "className", "onEnter", "onEntering", "onEntered", "onExit", "onExiting", "onExited", "mountOnEnter", "unmountOnExit"]);

    var _this$context = this.context,
        tabContent = _this$context.$bs_tabContent,
        tabContainer = _this$context.$bs_tabContainer;

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['animation']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var active = this.isActive();
    var animation = this.getAnimation();
    var mountOnEnter = propsMountOnEnter != null ? propsMountOnEnter : tabContent && tabContent.mountOnEnter;
    var unmountOnExit = propsUnmountOnExit != null ? propsUnmountOnExit : tabContent && tabContent.unmountOnExit;

    if (!active && !animation && unmountOnExit) {
      return null;
    }

    var Transition = animation === true ? Fade : animation || null;

    if (tabContent) {
      bsProps.bsClass = prefix(tabContent, 'pane');
    }

    var classes = _extends({}, getClassSet(bsProps), {
      active: active
    });

    if (tabContainer) {
      process.env.NODE_ENV !== "production" ? warning(!elementProps.id && !elementProps['aria-labelledby'], 'In the context of a `<TabContainer>`, `<TabPanes>` are given ' + 'generated `id` and `aria-labelledby` attributes for the sake of ' + 'proper component accessibility. Any provided ones will be ignored. ' + 'To control these attributes directly provide a `generateChildId` ' + 'prop to the parent `<TabContainer>`.') : void 0;
      elementProps.id = tabContainer.getPaneId(eventKey);
      elementProps['aria-labelledby'] = tabContainer.getTabId(eventKey);
    }

    var pane = React.createElement("div", _extends({}, elementProps, {
      role: "tabpanel",
      "aria-hidden": !active,
      className: classNames(className, classes)
    }));

    if (Transition) {
      var exiting = tabContent && tabContent.exiting;
      return React.createElement(Transition, {
        in: active && !exiting,
        onEnter: createChainedFunction(this.handleEnter, onEnter),
        onEntering: onEntering,
        onEntered: onEntered,
        onExit: onExit,
        onExiting: onExiting,
        onExited: createChainedFunction(this.handleExited, onExited),
        mountOnEnter: mountOnEnter,
        unmountOnExit: unmountOnExit
      }, pane);
    }

    return pane;
  };

  return TabPane;
}(React.Component);

TabPane.propTypes = propTypes;
TabPane.contextTypes = contextTypes;
TabPane.childContextTypes = childContextTypes;
export default bsClass('tab-pane', TabPane);