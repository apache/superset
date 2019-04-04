import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';

import { bsClass as setBsClass, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';

var propTypes = {
  componentClass: elementType,

  /**
   * Sets a default animation strategy for all children `<TabPane>`s. Use
   * `false` to disable, `true` to enable the default `<Fade>` animation or any
   * `<Transition>` component.
   */
  animation: PropTypes.oneOfType([PropTypes.bool, elementType]),

  /**
   * Wait until the first "enter" transition to mount tabs (add them to the DOM)
   */
  mountOnEnter: PropTypes.bool,

  /**
   * Unmount tabs (remove it from the DOM) when they are no longer visible
   */
  unmountOnExit: PropTypes.bool
};

var defaultProps = {
  componentClass: 'div',
  animation: true,
  mountOnEnter: false,
  unmountOnExit: false
};

var contextTypes = {
  $bs_tabContainer: PropTypes.shape({
    activeKey: PropTypes.any
  })
};

var childContextTypes = {
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

var TabContent = function (_React$Component) {
  _inherits(TabContent, _React$Component);

  function TabContent(props, context) {
    _classCallCheck(this, TabContent);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handlePaneEnter = _this.handlePaneEnter.bind(_this);
    _this.handlePaneExited = _this.handlePaneExited.bind(_this);

    // Active entries in state will be `null` unless `animation` is set. Need
    // to track active child in case keys swap and the active child changes
    // but the active key does not.
    _this.state = {
      activeKey: null,
      activeChild: null
    };
    return _this;
  }

  TabContent.prototype.getChildContext = function getChildContext() {
    var _props = this.props,
        bsClass = _props.bsClass,
        animation = _props.animation,
        mountOnEnter = _props.mountOnEnter,
        unmountOnExit = _props.unmountOnExit;


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

  TabContent.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    if (!nextProps.animation && this.state.activeChild) {
      this.setState({ activeKey: null, activeChild: null });
    }
  };

  TabContent.prototype.componentWillUnmount = function componentWillUnmount() {
    this.isUnmounted = true;
  };

  TabContent.prototype.getContainerActiveKey = function getContainerActiveKey() {
    var tabContainer = this.context.$bs_tabContainer;
    return tabContainer && tabContainer.activeKey;
  };

  TabContent.prototype.handlePaneEnter = function handlePaneEnter(child, childKey) {
    if (!this.props.animation) {
      return false;
    }

    // It's possible that this child should be transitioning out.
    if (childKey !== this.getContainerActiveKey()) {
      return false;
    }

    this.setState({
      activeKey: childKey,
      activeChild: child
    });

    return true;
  };

  TabContent.prototype.handlePaneExited = function handlePaneExited(child) {
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

  TabContent.prototype.render = function render() {
    var _props2 = this.props,
        Component = _props2.componentClass,
        className = _props2.className,
        props = _objectWithoutProperties(_props2, ['componentClass', 'className']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['animation', 'mountOnEnter', 'unmountOnExit']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, prefix(bsProps, 'content'))
    }));
  };

  return TabContent;
}(React.Component);

TabContent.propTypes = propTypes;
TabContent.defaultProps = defaultProps;
TabContent.contextTypes = contextTypes;
TabContent.childContextTypes = childContextTypes;

export default setBsClass('tab', TabContent);