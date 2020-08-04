"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _uncontrollable = require("uncontrollable");

var _Grid = _interopRequireDefault(require("./Grid"));

var _NavbarBrand = _interopRequireDefault(require("./NavbarBrand"));

var _NavbarCollapse = _interopRequireDefault(require("./NavbarCollapse"));

var _NavbarHeader = _interopRequireDefault(require("./NavbarHeader"));

var _NavbarToggle = _interopRequireDefault(require("./NavbarToggle"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _StyleConfig = require("./utils/StyleConfig");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

// TODO: Remove this pragma once we upgrade eslint-config-airbnb.

/* eslint-disable react/no-multi-comp */
var propTypes = {
  /**
   * Create a fixed navbar along the top of the screen, that scrolls with the
   * page
   */
  fixedTop: _propTypes.default.bool,

  /**
   * Create a fixed navbar along the bottom of the screen, that scrolls with
   * the page
   */
  fixedBottom: _propTypes.default.bool,

  /**
   * Create a full-width navbar that scrolls away with the page
   */
  staticTop: _propTypes.default.bool,

  /**
   * An alternative dark visual style for the Navbar
   */
  inverse: _propTypes.default.bool,

  /**
   * Allow the Navbar to fluidly adjust to the page or container width, instead
   * of at the predefined screen breakpoints
   */
  fluid: _propTypes.default.bool,

  /**
   * Set a custom element for this component.
   */
  componentClass: _elementType.default,

  /**
   * A callback fired when the `<Navbar>` body collapses or expands. Fired when
   * a `<Navbar.Toggle>` is clicked and called with the new `expanded`
   * boolean value.
   *
   * @controllable expanded
   */
  onToggle: _propTypes.default.func,

  /**
   * A callback fired when a descendant of a child `<Nav>` is selected. Should
   * be used to execute complex closing or other miscellaneous actions desired
   * after selecting a descendant of `<Nav>`. Does nothing if no `<Nav>` or `<Nav>`
   * descendants exist. The callback is called with an eventKey, which is a
   * prop from the selected `<Nav>` descendant, and an event.
   *
   * ```js
   * function (
   *  Any eventKey,
   *  SyntheticEvent event?
   * )
   * ```
   *
   * For basic closing behavior after all `<Nav>` descendant onSelect events in
   * mobile viewports, try using collapseOnSelect.
   *
   * Note: If you are manually closing the navbar using this `OnSelect` prop,
   * ensure that you are setting `expanded` to false and not *toggling* between
   * true and false.
   */
  onSelect: _propTypes.default.func,

  /**
   * Sets `expanded` to `false` after the onSelect event of a descendant of a
   * child `<Nav>`. Does nothing if no `<Nav>` or `<Nav>` descendants exist.
   *
   * The onSelect callback should be used instead for more complex operations
   * that need to be executed after the `select` event of `<Nav>` descendants.
   */
  collapseOnSelect: _propTypes.default.bool,

  /**
   * Explicitly set the visiblity of the navbar body
   *
   * @controllable onToggle
   */
  expanded: _propTypes.default.bool,
  role: _propTypes.default.string
};
var defaultProps = {
  componentClass: 'nav',
  fixedTop: false,
  fixedBottom: false,
  staticTop: false,
  inverse: false,
  fluid: false,
  collapseOnSelect: false
};
var childContextTypes = {
  $bs_navbar: _propTypes.default.shape({
    bsClass: _propTypes.default.string,
    expanded: _propTypes.default.bool,
    onToggle: _propTypes.default.func.isRequired,
    onSelect: _propTypes.default.func
  })
};

var Navbar =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Navbar, _React$Component);

  function Navbar(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleToggle = _this.handleToggle.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleCollapse = _this.handleCollapse.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    return _this;
  }

  var _proto = Navbar.prototype;

  _proto.getChildContext = function getChildContext() {
    var _this$props = this.props,
        bsClass = _this$props.bsClass,
        expanded = _this$props.expanded,
        onSelect = _this$props.onSelect,
        collapseOnSelect = _this$props.collapseOnSelect;
    return {
      $bs_navbar: {
        bsClass: bsClass,
        expanded: expanded,
        onToggle: this.handleToggle,
        onSelect: (0, _createChainedFunction.default)(onSelect, collapseOnSelect ? this.handleCollapse : null)
      }
    };
  };

  _proto.handleCollapse = function handleCollapse() {
    var _this$props2 = this.props,
        onToggle = _this$props2.onToggle,
        expanded = _this$props2.expanded;

    if (expanded) {
      onToggle(false);
    }
  };

  _proto.handleToggle = function handleToggle() {
    var _this$props3 = this.props,
        onToggle = _this$props3.onToggle,
        expanded = _this$props3.expanded;
    onToggle(!expanded);
  };

  _proto.render = function render() {
    var _extends2;

    var _this$props4 = this.props,
        Component = _this$props4.componentClass,
        fixedTop = _this$props4.fixedTop,
        fixedBottom = _this$props4.fixedBottom,
        staticTop = _this$props4.staticTop,
        inverse = _this$props4.inverse,
        fluid = _this$props4.fluid,
        className = _this$props4.className,
        children = _this$props4.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props4, ["componentClass", "fixedTop", "fixedBottom", "staticTop", "inverse", "fluid", "className", "children"]);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['expanded', 'onToggle', 'onSelect', 'collapseOnSelect']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1]; // will result in some false positives but that seems better
    // than false negatives. strict `undefined` check allows explicit
    // "nulling" of the role if the user really doesn't want one


    if (elementProps.role === undefined && Component !== 'nav') {
      elementProps.role = 'navigation';
    }

    if (inverse) {
      bsProps.bsStyle = _StyleConfig.Style.INVERSE;
    }

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'fixed-top')] = fixedTop, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'fixed-bottom')] = fixedBottom, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'static-top')] = staticTop, _extends2));
    return _react.default.createElement(Component, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), _react.default.createElement(_Grid.default, {
      fluid: fluid
    }, children));
  };

  return Navbar;
}(_react.default.Component);

Navbar.propTypes = propTypes;
Navbar.defaultProps = defaultProps;
Navbar.childContextTypes = childContextTypes;
(0, _bootstrapUtils.bsClass)('navbar', Navbar);
var UncontrollableNavbar = (0, _uncontrollable.uncontrollable)(Navbar, {
  expanded: 'onToggle'
});

function createSimpleWrapper(tag, suffix, displayName) {
  var Wrapper = function Wrapper(_ref, _ref2) {
    var Component = _ref.componentClass,
        className = _ref.className,
        pullRight = _ref.pullRight,
        pullLeft = _ref.pullLeft,
        props = (0, _objectWithoutPropertiesLoose2.default)(_ref, ["componentClass", "className", "pullRight", "pullLeft"]);
    var _ref2$$bs_navbar = _ref2.$bs_navbar,
        navbarProps = _ref2$$bs_navbar === void 0 ? {
      bsClass: 'navbar'
    } : _ref2$$bs_navbar;
    return _react.default.createElement(Component, (0, _extends3.default)({}, props, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(navbarProps, suffix), pullRight && (0, _bootstrapUtils.prefix)(navbarProps, 'right'), pullLeft && (0, _bootstrapUtils.prefix)(navbarProps, 'left'))
    }));
  };

  Wrapper.displayName = displayName;
  Wrapper.propTypes = {
    componentClass: _elementType.default,
    pullRight: _propTypes.default.bool,
    pullLeft: _propTypes.default.bool
  };
  Wrapper.defaultProps = {
    componentClass: tag,
    pullRight: false,
    pullLeft: false
  };
  Wrapper.contextTypes = {
    $bs_navbar: _propTypes.default.shape({
      bsClass: _propTypes.default.string
    })
  };
  return Wrapper;
}

UncontrollableNavbar.Brand = _NavbarBrand.default;
UncontrollableNavbar.Header = _NavbarHeader.default;
UncontrollableNavbar.Toggle = _NavbarToggle.default;
UncontrollableNavbar.Collapse = _NavbarCollapse.default;
UncontrollableNavbar.Form = createSimpleWrapper('div', 'form', 'NavbarForm');
UncontrollableNavbar.Text = createSimpleWrapper('p', 'text', 'NavbarText');
UncontrollableNavbar.Link = createSimpleWrapper('a', 'link', 'NavbarLink'); // Set bsStyles here so they can be overridden.

var _default = (0, _bootstrapUtils.bsStyles)([_StyleConfig.Style.DEFAULT, _StyleConfig.Style.INVERSE], _StyleConfig.Style.DEFAULT)(UncontrollableNavbar);

exports.default = _default;
module.exports = exports["default"];