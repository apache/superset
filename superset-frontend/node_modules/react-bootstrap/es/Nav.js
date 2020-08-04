import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import keycode from 'keycode';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import all from 'prop-types-extra/lib/all';
import warning from 'warning';
import { bsClass, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import ValidComponentChildren from './utils/ValidComponentChildren'; // TODO: Should we expose `<NavItem>` as `<Nav.Item>`?
// TODO: This `bsStyle` is very unlike the others. Should we rename it?
// TODO: `pullRight` and `pullLeft` don't render right outside of `navbar`.
// Consider renaming or replacing them.

var propTypes = {
  /**
   * Marks the NavItem with a matching `eventKey` as active. Has a
   * higher precedence over `activeHref`.
   */
  activeKey: PropTypes.any,

  /**
   * Marks the child NavItem with a matching `href` prop as active.
   */
  activeHref: PropTypes.string,

  /**
   * NavItems are be positioned vertically.
   */
  stacked: PropTypes.bool,
  justified: all(PropTypes.bool, function (_ref) {
    var justified = _ref.justified,
        navbar = _ref.navbar;
    return justified && navbar ? Error('justified navbar `Nav`s are not supported') : null;
  }),

  /**
   * A callback fired when a NavItem is selected.
   *
   * ```js
   * function (
   *  Any eventKey,
   *  SyntheticEvent event?
   * )
   * ```
   */
  onSelect: PropTypes.func,

  /**
   * ARIA role for the Nav, in the context of a TabContainer, the default will
   * be set to "tablist", but can be overridden by the Nav when set explicitly.
   *
   * When the role is set to "tablist" NavItem focus is managed according to
   * the ARIA authoring practices for tabs:
   * https://www.w3.org/TR/2013/WD-wai-aria-practices-20130307/#tabpanel
   */
  role: PropTypes.string,

  /**
   * Apply styling an alignment for use in a Navbar. This prop will be set
   * automatically when the Nav is used inside a Navbar.
   */
  navbar: PropTypes.bool,

  /**
   * Float the Nav to the right. When `navbar` is `true` the appropriate
   * contextual classes are added as well.
   */
  pullRight: PropTypes.bool,

  /**
   * Float the Nav to the left. When `navbar` is `true` the appropriate
   * contextual classes are added as well.
   */
  pullLeft: PropTypes.bool
};
var defaultProps = {
  justified: false,
  pullRight: false,
  pullLeft: false,
  stacked: false
};
var contextTypes = {
  $bs_navbar: PropTypes.shape({
    bsClass: PropTypes.string,
    onSelect: PropTypes.func
  }),
  $bs_tabContainer: PropTypes.shape({
    activeKey: PropTypes.any,
    onSelect: PropTypes.func.isRequired,
    getTabId: PropTypes.func.isRequired,
    getPaneId: PropTypes.func.isRequired
  })
};

var Nav =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Nav, _React$Component);

  function Nav() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Nav.prototype;

  _proto.componentDidUpdate = function componentDidUpdate() {
    var _this = this;

    if (!this._needsRefocus) {
      return;
    }

    this._needsRefocus = false;
    var children = this.props.children;

    var _this$getActiveProps = this.getActiveProps(),
        activeKey = _this$getActiveProps.activeKey,
        activeHref = _this$getActiveProps.activeHref;

    var activeChild = ValidComponentChildren.find(children, function (child) {
      return _this.isActive(child, activeKey, activeHref);
    });
    var childrenArray = ValidComponentChildren.toArray(children);
    var activeChildIndex = childrenArray.indexOf(activeChild);
    var childNodes = ReactDOM.findDOMNode(this).children;
    var activeNode = childNodes && childNodes[activeChildIndex];

    if (!activeNode || !activeNode.firstChild) {
      return;
    }

    activeNode.firstChild.focus();
  };

  _proto.getActiveProps = function getActiveProps() {
    var tabContainer = this.context.$bs_tabContainer;

    if (tabContainer) {
      process.env.NODE_ENV !== "production" ? warning(this.props.activeKey == null && !this.props.activeHref, 'Specifying a `<Nav>` `activeKey` or `activeHref` in the context of ' + 'a `<TabContainer>` is not supported. Instead use `<TabContainer ' + ("activeKey={" + this.props.activeKey + "} />`.")) : void 0;
      return tabContainer;
    }

    return this.props;
  };

  _proto.getNextActiveChild = function getNextActiveChild(offset) {
    var _this2 = this;

    var children = this.props.children;
    var validChildren = ValidComponentChildren.filter(children, function (child) {
      return child.props.eventKey != null && !child.props.disabled;
    });

    var _this$getActiveProps2 = this.getActiveProps(),
        activeKey = _this$getActiveProps2.activeKey,
        activeHref = _this$getActiveProps2.activeHref;

    var activeChild = ValidComponentChildren.find(children, function (child) {
      return _this2.isActive(child, activeKey, activeHref);
    }); // This assumes the active child is not disabled.

    var activeChildIndex = validChildren.indexOf(activeChild);

    if (activeChildIndex === -1) {
      // Something has gone wrong. Select the first valid child we can find.
      return validChildren[0];
    }

    var nextIndex = activeChildIndex + offset;
    var numValidChildren = validChildren.length;

    if (nextIndex >= numValidChildren) {
      nextIndex = 0;
    } else if (nextIndex < 0) {
      nextIndex = numValidChildren - 1;
    }

    return validChildren[nextIndex];
  };

  _proto.getTabProps = function getTabProps(child, tabContainer, navRole, active, onSelect) {
    var _this3 = this;

    if (!tabContainer && navRole !== 'tablist') {
      // No tab props here.
      return null;
    }

    var _child$props = child.props,
        id = _child$props.id,
        controls = _child$props['aria-controls'],
        eventKey = _child$props.eventKey,
        role = _child$props.role,
        onKeyDown = _child$props.onKeyDown,
        tabIndex = _child$props.tabIndex;

    if (tabContainer) {
      process.env.NODE_ENV !== "production" ? warning(!id && !controls, 'In the context of a `<TabContainer>`, `<NavItem>`s are given ' + 'generated `id` and `aria-controls` attributes for the sake of ' + 'proper component accessibility. Any provided ones will be ignored. ' + 'To control these attributes directly, provide a `generateChildId` ' + 'prop to the parent `<TabContainer>`.') : void 0;
      id = tabContainer.getTabId(eventKey);
      controls = tabContainer.getPaneId(eventKey);
    }

    if (navRole === 'tablist') {
      role = role || 'tab';
      onKeyDown = createChainedFunction(function (event) {
        return _this3.handleTabKeyDown(onSelect, event);
      }, onKeyDown);
      tabIndex = active ? tabIndex : -1;
    }

    return {
      id: id,
      role: role,
      onKeyDown: onKeyDown,
      'aria-controls': controls,
      tabIndex: tabIndex
    };
  };

  _proto.handleTabKeyDown = function handleTabKeyDown(onSelect, event) {
    var nextActiveChild;

    switch (event.keyCode) {
      case keycode.codes.left:
      case keycode.codes.up:
        nextActiveChild = this.getNextActiveChild(-1);
        break;

      case keycode.codes.right:
      case keycode.codes.down:
        nextActiveChild = this.getNextActiveChild(1);
        break;

      default:
        // It was a different key; don't handle this keypress.
        return;
    }

    event.preventDefault();

    if (onSelect && nextActiveChild && nextActiveChild.props.eventKey != null) {
      onSelect(nextActiveChild.props.eventKey);
    }

    this._needsRefocus = true;
  };

  _proto.isActive = function isActive(_ref2, activeKey, activeHref) {
    var props = _ref2.props;

    if (props.active || activeKey != null && props.eventKey === activeKey || activeHref && props.href === activeHref) {
      return true;
    }

    return props.active;
  };

  _proto.render = function render() {
    var _extends2,
        _this4 = this;

    var _this$props = this.props,
        stacked = _this$props.stacked,
        justified = _this$props.justified,
        onSelect = _this$props.onSelect,
        propsRole = _this$props.role,
        propsNavbar = _this$props.navbar,
        pullRight = _this$props.pullRight,
        pullLeft = _this$props.pullLeft,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["stacked", "justified", "onSelect", "role", "navbar", "pullRight", "pullLeft", "className", "children"]);

    var tabContainer = this.context.$bs_tabContainer;
    var role = propsRole || (tabContainer ? 'tablist' : null);

    var _this$getActiveProps3 = this.getActiveProps(),
        activeKey = _this$getActiveProps3.activeKey,
        activeHref = _this$getActiveProps3.activeHref;

    delete props.activeKey; // Accessed via this.getActiveProps().

    delete props.activeHref; // Accessed via this.getActiveProps().

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'stacked')] = stacked, _extends2[prefix(bsProps, 'justified')] = justified, _extends2));

    var navbar = propsNavbar != null ? propsNavbar : this.context.$bs_navbar;
    var pullLeftClassName;
    var pullRightClassName;

    if (navbar) {
      var navbarProps = this.context.$bs_navbar || {
        bsClass: 'navbar'
      };
      classes[prefix(navbarProps, 'nav')] = true;
      pullRightClassName = prefix(navbarProps, 'right');
      pullLeftClassName = prefix(navbarProps, 'left');
    } else {
      pullRightClassName = 'pull-right';
      pullLeftClassName = 'pull-left';
    }

    classes[pullRightClassName] = pullRight;
    classes[pullLeftClassName] = pullLeft;
    return React.createElement("ul", _extends({}, elementProps, {
      role: role,
      className: classNames(className, classes)
    }), ValidComponentChildren.map(children, function (child) {
      var active = _this4.isActive(child, activeKey, activeHref);

      var childOnSelect = createChainedFunction(child.props.onSelect, onSelect, navbar && navbar.onSelect, tabContainer && tabContainer.onSelect);
      return cloneElement(child, _extends({}, _this4.getTabProps(child, tabContainer, role, active, childOnSelect), {
        active: active,
        activeKey: activeKey,
        activeHref: activeHref,
        onSelect: childOnSelect
      }));
    }));
  };

  return Nav;
}(React.Component);

Nav.propTypes = propTypes;
Nav.defaultProps = defaultProps;
Nav.contextTypes = contextTypes;
export default bsClass('nav', bsStyles(['tabs', 'pills'], Nav));