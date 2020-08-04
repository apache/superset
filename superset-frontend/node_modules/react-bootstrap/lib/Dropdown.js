"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _classnames = _interopRequireDefault(require("classnames"));

var _activeElement = _interopRequireDefault(require("dom-helpers/activeElement"));

var _contains = _interopRequireDefault(require("dom-helpers/query/contains"));

var _keycode = _interopRequireDefault(require("keycode"));

var _react = _interopRequireWildcard(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _reactDom = _interopRequireDefault(require("react-dom"));

var _all = _interopRequireDefault(require("prop-types-extra/lib/all"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _isRequiredForA11y = _interopRequireDefault(require("prop-types-extra/lib/isRequiredForA11y"));

var _uncontrollable = require("uncontrollable");

var _warning = _interopRequireDefault(require("warning"));

var _ButtonGroup = _interopRequireDefault(require("./ButtonGroup"));

var _DropdownMenu = _interopRequireDefault(require("./DropdownMenu"));

var _DropdownToggle = _interopRequireDefault(require("./DropdownToggle"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _PropTypes = require("./utils/PropTypes");

var _ValidComponentChildren = _interopRequireDefault(require("./utils/ValidComponentChildren"));

var TOGGLE_ROLE = _DropdownToggle.default.defaultProps.bsRole;
var MENU_ROLE = _DropdownMenu.default.defaultProps.bsRole;
var propTypes = {
  /**
   * The menu will open above the dropdown button, instead of below it.
   */
  dropup: _propTypes.default.bool,

  /**
   * An html id attribute, necessary for assistive technologies, such as screen readers.
   * @type {string|number}
   * @required
   */
  id: (0, _isRequiredForA11y.default)(_propTypes.default.oneOfType([_propTypes.default.string, _propTypes.default.number])),
  componentClass: _elementType.default,

  /**
   * The children of a Dropdown may be a `<Dropdown.Toggle>` or a `<Dropdown.Menu>`.
   * @type {node}
   */
  children: (0, _all.default)((0, _PropTypes.requiredRoles)(TOGGLE_ROLE, MENU_ROLE), (0, _PropTypes.exclusiveRoles)(MENU_ROLE)),

  /**
   * Whether or not component is disabled.
   */
  disabled: _propTypes.default.bool,

  /**
   * Align the menu to the right side of the Dropdown toggle
   */
  pullRight: _propTypes.default.bool,

  /**
   * Whether or not the Dropdown is visible.
   *
   * @controllable onToggle
   */
  open: _propTypes.default.bool,
  defaultOpen: _propTypes.default.bool,

  /**
   * A callback fired when the Dropdown wishes to change visibility. Called with the requested
   * `open` value, the DOM event, and the source that fired it: `'click'`,`'keydown'`,`'rootClose'`, or `'select'`.
   *
   * ```js
   * function(Boolean isOpen, Object event, { String source }) {}
   * ```
   * @controllable open
   */
  onToggle: _propTypes.default.func,

  /**
   * A callback fired when a menu item is selected.
   *
   * ```js
   * (eventKey: any, event: Object) => any
   * ```
   */
  onSelect: _propTypes.default.func,

  /**
   * If `'menuitem'`, causes the dropdown to behave like a menu item rather than
   * a menu button.
   */
  role: _propTypes.default.string,

  /**
   * Which event when fired outside the component will cause it to be closed
   *
   * *Note: For custom dropdown components, you will have to pass the
   * `rootCloseEvent` to `<RootCloseWrapper>` in your custom dropdown menu
   * component ([similarly to how it is implemented in `<Dropdown.Menu>`](https://github.com/react-bootstrap/react-bootstrap/blob/v0.31.5/src/DropdownMenu.js#L115-L119)).*
   */
  rootCloseEvent: _propTypes.default.oneOf(['click', 'mousedown']),

  /**
   * @private
   */
  onMouseEnter: _propTypes.default.func,

  /**
   * @private
   */
  onMouseLeave: _propTypes.default.func
};
var defaultProps = {
  componentClass: _ButtonGroup.default
};

var Dropdown =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Dropdown, _React$Component);

  function Dropdown(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleClick = _this.handleClick.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleKeyDown = _this.handleKeyDown.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleClose = _this.handleClose.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this._focusInDropdown = false;
    _this.lastOpenEventType = null;
    return _this;
  }

  var _proto = Dropdown.prototype;

  _proto.componentDidMount = function componentDidMount() {
    this.focusNextOnOpen();
  };

  _proto.UNSAFE_componentWillUpdate = function UNSAFE_componentWillUpdate(nextProps) {
    // eslint-disable-line
    if (!nextProps.open && this.props.open) {
      this._focusInDropdown = (0, _contains.default)(_reactDom.default.findDOMNode(this.menu), (0, _activeElement.default)(document));
    }
  };

  _proto.componentDidUpdate = function componentDidUpdate(prevProps) {
    var open = this.props.open;
    var prevOpen = prevProps.open;

    if (open && !prevOpen) {
      this.focusNextOnOpen();
    }

    if (!open && prevOpen) {
      // if focus hasn't already moved from the menu let's return it
      // to the toggle
      if (this._focusInDropdown) {
        this._focusInDropdown = false;
        this.focus();
      }
    }
  };

  _proto.focus = function focus() {
    var toggle = _reactDom.default.findDOMNode(this.toggle);

    if (toggle && toggle.focus) {
      toggle.focus();
    }
  };

  _proto.focusNextOnOpen = function focusNextOnOpen() {
    var menu = this.menu;

    if (!menu || !menu.focusNext) {
      return;
    }

    if (this.lastOpenEventType === 'keydown' || this.props.role === 'menuitem') {
      menu.focusNext();
    }
  };

  _proto.handleClick = function handleClick(event) {
    if (this.props.disabled) {
      return;
    }

    this.toggleOpen(event, {
      source: 'click'
    });
  };

  _proto.handleClose = function handleClose(event, eventDetails) {
    if (!this.props.open) {
      return;
    }

    this.toggleOpen(event, eventDetails);
  };

  _proto.handleKeyDown = function handleKeyDown(event) {
    if (this.props.disabled) {
      return;
    }

    switch (event.keyCode) {
      case _keycode.default.codes.down:
        if (!this.props.open) {
          this.toggleOpen(event, {
            source: 'keydown'
          });
        } else if (this.menu.focusNext) {
          this.menu.focusNext();
        }

        event.preventDefault();
        break;

      case _keycode.default.codes.esc:
      case _keycode.default.codes.tab:
        this.handleClose(event, {
          source: 'keydown'
        });
        break;

      default:
    }
  };

  _proto.toggleOpen = function toggleOpen(event, eventDetails) {
    var open = !this.props.open;

    if (open) {
      this.lastOpenEventType = eventDetails.source;
    }

    if (this.props.onToggle) {
      this.props.onToggle(open, event, eventDetails);
    }
  };

  _proto.renderMenu = function renderMenu(child, _ref) {
    var _this2 = this;

    var id = _ref.id,
        onSelect = _ref.onSelect,
        rootCloseEvent = _ref.rootCloseEvent,
        props = (0, _objectWithoutPropertiesLoose2.default)(_ref, ["id", "onSelect", "rootCloseEvent"]);

    var ref = function ref(c) {
      _this2.menu = c;
    };

    if (typeof child.ref === 'string') {
      process.env.NODE_ENV !== "production" ? (0, _warning.default)(false, 'String refs are not supported on `<Dropdown.Menu>` components. ' + 'To apply a ref to the component use the callback signature:\n\n ' + 'https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute') : void 0;
    } else {
      ref = (0, _createChainedFunction.default)(child.ref, ref);
    }

    return (0, _react.cloneElement)(child, (0, _extends2.default)({}, props, {
      ref: ref,
      labelledBy: id,
      bsClass: (0, _bootstrapUtils.prefix)(props, 'menu'),
      onClose: (0, _createChainedFunction.default)(child.props.onClose, this.handleClose),
      onSelect: (0, _createChainedFunction.default)(child.props.onSelect, onSelect, function (key, event) {
        return _this2.handleClose(event, {
          source: 'select'
        });
      }),
      rootCloseEvent: rootCloseEvent
    }));
  };

  _proto.renderToggle = function renderToggle(child, props) {
    var _this3 = this;

    var ref = function ref(c) {
      _this3.toggle = c;
    };

    if (typeof child.ref === 'string') {
      process.env.NODE_ENV !== "production" ? (0, _warning.default)(false, 'String refs are not supported on `<Dropdown.Toggle>` components. ' + 'To apply a ref to the component use the callback signature:\n\n ' + 'https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute') : void 0;
    } else {
      ref = (0, _createChainedFunction.default)(child.ref, ref);
    }

    return (0, _react.cloneElement)(child, (0, _extends2.default)({}, props, {
      ref: ref,
      bsClass: (0, _bootstrapUtils.prefix)(props, 'toggle'),
      onClick: (0, _createChainedFunction.default)(child.props.onClick, this.handleClick),
      onKeyDown: (0, _createChainedFunction.default)(child.props.onKeyDown, this.handleKeyDown)
    }));
  };

  _proto.render = function render() {
    var _classes,
        _this4 = this;

    var _this$props = this.props,
        Component = _this$props.componentClass,
        id = _this$props.id,
        dropup = _this$props.dropup,
        disabled = _this$props.disabled,
        pullRight = _this$props.pullRight,
        open = _this$props.open,
        onSelect = _this$props.onSelect,
        role = _this$props.role,
        bsClass = _this$props.bsClass,
        className = _this$props.className,
        rootCloseEvent = _this$props.rootCloseEvent,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["componentClass", "id", "dropup", "disabled", "pullRight", "open", "onSelect", "role", "bsClass", "className", "rootCloseEvent", "children"]);
    delete props.onToggle;
    var classes = (_classes = {}, _classes[bsClass] = true, _classes.open = open, _classes.disabled = disabled, _classes);

    if (dropup) {
      classes[bsClass] = false;
      classes.dropup = true;
    } // This intentionally forwards bsSize and bsStyle (if set) to the
    // underlying component, to allow it to render size and style variants.


    return _react.default.createElement(Component, (0, _extends2.default)({}, props, {
      className: (0, _classnames.default)(className, classes)
    }), _ValidComponentChildren.default.map(children, function (child) {
      switch (child.props.bsRole) {
        case TOGGLE_ROLE:
          return _this4.renderToggle(child, {
            id: id,
            disabled: disabled,
            open: open,
            role: role,
            bsClass: bsClass
          });

        case MENU_ROLE:
          return _this4.renderMenu(child, {
            id: id,
            open: open,
            pullRight: pullRight,
            bsClass: bsClass,
            onSelect: onSelect,
            rootCloseEvent: rootCloseEvent
          });

        default:
          return child;
      }
    }));
  };

  return Dropdown;
}(_react.default.Component);

Dropdown.propTypes = propTypes;
Dropdown.defaultProps = defaultProps;
(0, _bootstrapUtils.bsClass)('dropdown', Dropdown);
var UncontrolledDropdown = (0, _uncontrollable.uncontrollable)(Dropdown, {
  open: 'onToggle'
});
UncontrolledDropdown.Toggle = _DropdownToggle.default;
UncontrolledDropdown.Menu = _DropdownMenu.default;
var _default = UncontrolledDropdown;
exports.default = _default;
module.exports = exports["default"];