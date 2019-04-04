'use strict';

exports.__esModule = true;

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _keycode = require('keycode');

var _keycode2 = _interopRequireDefault(_keycode);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _all = require('prop-types-extra/lib/all');

var _all2 = _interopRequireDefault(_all);

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: Should we expose `<NavItem>` as `<Nav.Item>`?

// TODO: This `bsStyle` is very unlike the others. Should we rename it?

// TODO: `pullRight` and `pullLeft` don't render right outside of `navbar`.
// Consider renaming or replacing them.

var propTypes = {
  /**
   * Marks the NavItem with a matching `eventKey` as active. Has a
   * higher precedence over `activeHref`.
   */
  activeKey: _propTypes2.default.any,

  /**
   * Marks the child NavItem with a matching `href` prop as active.
   */
  activeHref: _propTypes2.default.string,

  /**
   * NavItems are be positioned vertically.
   */
  stacked: _propTypes2.default.bool,

  justified: (0, _all2.default)(_propTypes2.default.bool, function (_ref) {
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
  onSelect: _propTypes2.default.func,

  /**
   * ARIA role for the Nav, in the context of a TabContainer, the default will
   * be set to "tablist", but can be overridden by the Nav when set explicitly.
   *
   * When the role is set to "tablist" NavItem focus is managed according to
   * the ARIA authoring practices for tabs:
   * https://www.w3.org/TR/2013/WD-wai-aria-practices-20130307/#tabpanel
   */
  role: _propTypes2.default.string,

  /**
   * Apply styling an alignment for use in a Navbar. This prop will be set
   * automatically when the Nav is used inside a Navbar.
   */
  navbar: _propTypes2.default.bool,

  /**
   * Float the Nav to the right. When `navbar` is `true` the appropriate
   * contextual classes are added as well.
   */
  pullRight: _propTypes2.default.bool,

  /**
   * Float the Nav to the left. When `navbar` is `true` the appropriate
   * contextual classes are added as well.
   */
  pullLeft: _propTypes2.default.bool
};

var defaultProps = {
  justified: false,
  pullRight: false,
  pullLeft: false,
  stacked: false
};

var contextTypes = {
  $bs_navbar: _propTypes2.default.shape({
    bsClass: _propTypes2.default.string,
    onSelect: _propTypes2.default.func
  }),

  $bs_tabContainer: _propTypes2.default.shape({
    activeKey: _propTypes2.default.any,
    onSelect: _propTypes2.default.func.isRequired,
    getTabId: _propTypes2.default.func.isRequired,
    getPaneId: _propTypes2.default.func.isRequired
  })
};

var Nav = function (_React$Component) {
  (0, _inherits3.default)(Nav, _React$Component);

  function Nav() {
    (0, _classCallCheck3.default)(this, Nav);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Nav.prototype.componentDidUpdate = function componentDidUpdate() {
    var _this2 = this;

    if (!this._needsRefocus) {
      return;
    }

    this._needsRefocus = false;

    var children = this.props.children;

    var _getActiveProps = this.getActiveProps(),
        activeKey = _getActiveProps.activeKey,
        activeHref = _getActiveProps.activeHref;

    var activeChild = _ValidComponentChildren2.default.find(children, function (child) {
      return _this2.isActive(child, activeKey, activeHref);
    });

    var childrenArray = _ValidComponentChildren2.default.toArray(children);
    var activeChildIndex = childrenArray.indexOf(activeChild);

    var childNodes = _reactDom2.default.findDOMNode(this).children;
    var activeNode = childNodes && childNodes[activeChildIndex];

    if (!activeNode || !activeNode.firstChild) {
      return;
    }

    activeNode.firstChild.focus();
  };

  Nav.prototype.getActiveProps = function getActiveProps() {
    var tabContainer = this.context.$bs_tabContainer;

    if (tabContainer) {
      process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(this.props.activeKey == null && !this.props.activeHref, 'Specifying a `<Nav>` `activeKey` or `activeHref` in the context of ' + 'a `<TabContainer>` is not supported. Instead use `<TabContainer ' + ('activeKey={' + this.props.activeKey + '} />`.')) : void 0;

      return tabContainer;
    }

    return this.props;
  };

  Nav.prototype.getNextActiveChild = function getNextActiveChild(offset) {
    var _this3 = this;

    var children = this.props.children;

    var validChildren = children.filter(function (child) {
      return child.props.eventKey != null && !child.props.disabled;
    });

    var _getActiveProps2 = this.getActiveProps(),
        activeKey = _getActiveProps2.activeKey,
        activeHref = _getActiveProps2.activeHref;

    var activeChild = _ValidComponentChildren2.default.find(children, function (child) {
      return _this3.isActive(child, activeKey, activeHref);
    });

    // This assumes the active child is not disabled.
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

  Nav.prototype.getTabProps = function getTabProps(child, tabContainer, navRole, active, onSelect) {
    var _this4 = this;

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
      process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(!id && !controls, 'In the context of a `<TabContainer>`, `<NavItem>`s are given ' + 'generated `id` and `aria-controls` attributes for the sake of ' + 'proper component accessibility. Any provided ones will be ignored. ' + 'To control these attributes directly, provide a `generateChildId` ' + 'prop to the parent `<TabContainer>`.') : void 0;

      id = tabContainer.getTabId(eventKey);
      controls = tabContainer.getPaneId(eventKey);
    }

    if (navRole === 'tablist') {
      role = role || 'tab';
      onKeyDown = (0, _createChainedFunction2.default)(function (event) {
        return _this4.handleTabKeyDown(onSelect, event);
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

  Nav.prototype.handleTabKeyDown = function handleTabKeyDown(onSelect, event) {
    var nextActiveChild = void 0;

    switch (event.keyCode) {
      case _keycode2.default.codes.left:
      case _keycode2.default.codes.up:
        nextActiveChild = this.getNextActiveChild(-1);
        break;
      case _keycode2.default.codes.right:
      case _keycode2.default.codes.down:
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

  Nav.prototype.isActive = function isActive(_ref2, activeKey, activeHref) {
    var props = _ref2.props;

    if (props.active || activeKey != null && props.eventKey === activeKey || activeHref && props.href === activeHref) {
      return true;
    }

    return props.active;
  };

  Nav.prototype.render = function render() {
    var _extends2,
        _this5 = this;

    var _props = this.props,
        stacked = _props.stacked,
        justified = _props.justified,
        onSelect = _props.onSelect,
        propsRole = _props.role,
        propsNavbar = _props.navbar,
        pullRight = _props.pullRight,
        pullLeft = _props.pullLeft,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['stacked', 'justified', 'onSelect', 'role', 'navbar', 'pullRight', 'pullLeft', 'className', 'children']);


    var tabContainer = this.context.$bs_tabContainer;
    var role = propsRole || (tabContainer ? 'tablist' : null);

    var _getActiveProps3 = this.getActiveProps(),
        activeKey = _getActiveProps3.activeKey,
        activeHref = _getActiveProps3.activeHref;

    delete props.activeKey; // Accessed via this.getActiveProps().
    delete props.activeHref; // Accessed via this.getActiveProps().

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends4.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'stacked')] = stacked, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'justified')] = justified, _extends2));

    var navbar = propsNavbar != null ? propsNavbar : this.context.$bs_navbar;
    var pullLeftClassName = void 0;
    var pullRightClassName = void 0;

    if (navbar) {
      var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

      classes[(0, _bootstrapUtils.prefix)(navbarProps, 'nav')] = true;

      pullRightClassName = (0, _bootstrapUtils.prefix)(navbarProps, 'right');
      pullLeftClassName = (0, _bootstrapUtils.prefix)(navbarProps, 'left');
    } else {
      pullRightClassName = 'pull-right';
      pullLeftClassName = 'pull-left';
    }

    classes[pullRightClassName] = pullRight;
    classes[pullLeftClassName] = pullLeft;

    return _react2.default.createElement(
      'ul',
      (0, _extends4.default)({}, elementProps, {
        role: role,
        className: (0, _classnames2.default)(className, classes)
      }),
      _ValidComponentChildren2.default.map(children, function (child) {
        var active = _this5.isActive(child, activeKey, activeHref);
        var childOnSelect = (0, _createChainedFunction2.default)(child.props.onSelect, onSelect, navbar && navbar.onSelect, tabContainer && tabContainer.onSelect);

        return (0, _react.cloneElement)(child, (0, _extends4.default)({}, _this5.getTabProps(child, tabContainer, role, active, childOnSelect), {
          active: active,
          activeKey: activeKey,
          activeHref: activeHref,
          onSelect: childOnSelect
        }));
      })
    );
  };

  return Nav;
}(_react2.default.Component);

Nav.propTypes = propTypes;
Nav.defaultProps = defaultProps;
Nav.contextTypes = contextTypes;

exports.default = (0, _bootstrapUtils.bsClass)('nav', (0, _bootstrapUtils.bsStyles)(['tabs', 'pills'], Nav));
module.exports = exports['default'];