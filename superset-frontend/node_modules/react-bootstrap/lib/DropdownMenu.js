"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _from = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/array/from"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _classnames = _interopRequireDefault(require("classnames"));

var _keycode = _interopRequireDefault(require("keycode"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _reactDom = _interopRequireDefault(require("react-dom"));

var _RootCloseWrapper = _interopRequireDefault(require("react-overlays/lib/RootCloseWrapper"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _ValidComponentChildren = _interopRequireDefault(require("./utils/ValidComponentChildren"));

var propTypes = {
  open: _propTypes.default.bool,
  pullRight: _propTypes.default.bool,
  onClose: _propTypes.default.func,
  labelledBy: _propTypes.default.oneOfType([_propTypes.default.string, _propTypes.default.number]),
  onSelect: _propTypes.default.func,
  rootCloseEvent: _propTypes.default.oneOf(['click', 'mousedown'])
};
var defaultProps = {
  bsRole: 'menu',
  pullRight: false
};

var DropdownMenu =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(DropdownMenu, _React$Component);

  function DropdownMenu(props) {
    var _this;

    _this = _React$Component.call(this, props) || this;
    _this.handleRootClose = _this.handleRootClose.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleKeyDown = _this.handleKeyDown.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    return _this;
  }

  var _proto = DropdownMenu.prototype;

  _proto.getFocusableMenuItems = function getFocusableMenuItems() {
    var node = _reactDom.default.findDOMNode(this);

    if (!node) {
      return [];
    }

    return (0, _from.default)(node.querySelectorAll('[tabIndex="-1"]'));
  };

  _proto.getItemsAndActiveIndex = function getItemsAndActiveIndex() {
    var items = this.getFocusableMenuItems();
    var activeIndex = items.indexOf(document.activeElement);
    return {
      items: items,
      activeIndex: activeIndex
    };
  };

  _proto.focusNext = function focusNext() {
    var _this$getItemsAndActi = this.getItemsAndActiveIndex(),
        items = _this$getItemsAndActi.items,
        activeIndex = _this$getItemsAndActi.activeIndex;

    if (items.length === 0) {
      return;
    }

    var nextIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    items[nextIndex].focus();
  };

  _proto.focusPrevious = function focusPrevious() {
    var _this$getItemsAndActi2 = this.getItemsAndActiveIndex(),
        items = _this$getItemsAndActi2.items,
        activeIndex = _this$getItemsAndActi2.activeIndex;

    if (items.length === 0) {
      return;
    }

    var prevIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    items[prevIndex].focus();
  };

  _proto.handleKeyDown = function handleKeyDown(event) {
    switch (event.keyCode) {
      case _keycode.default.codes.down:
        this.focusNext();
        event.preventDefault();
        break;

      case _keycode.default.codes.up:
        this.focusPrevious();
        event.preventDefault();
        break;

      case _keycode.default.codes.esc:
      case _keycode.default.codes.tab:
        this.props.onClose(event, {
          source: 'keydown'
        });
        break;

      default:
    }
  };

  _proto.handleRootClose = function handleRootClose(event) {
    this.props.onClose(event, {
      source: 'rootClose'
    });
  };

  _proto.render = function render() {
    var _extends2,
        _this2 = this;

    var _this$props = this.props,
        open = _this$props.open,
        pullRight = _this$props.pullRight,
        labelledBy = _this$props.labelledBy,
        onSelect = _this$props.onSelect,
        className = _this$props.className,
        rootCloseEvent = _this$props.rootCloseEvent,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["open", "pullRight", "labelledBy", "onSelect", "className", "rootCloseEvent", "children"]);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['onClose']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'right')] = pullRight, _extends2));
    return _react.default.createElement(_RootCloseWrapper.default, {
      disabled: !open,
      onRootClose: this.handleRootClose,
      event: rootCloseEvent
    }, _react.default.createElement("ul", (0, _extends3.default)({}, elementProps, {
      role: "menu",
      className: (0, _classnames.default)(className, classes),
      "aria-labelledby": labelledBy
    }), _ValidComponentChildren.default.map(children, function (child) {
      return _react.default.cloneElement(child, {
        onKeyDown: (0, _createChainedFunction.default)(child.props.onKeyDown, _this2.handleKeyDown),
        onSelect: (0, _createChainedFunction.default)(child.props.onSelect, onSelect)
      });
    })));
  };

  return DropdownMenu;
}(_react.default.Component);

DropdownMenu.propTypes = propTypes;
DropdownMenu.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('dropdown-menu', DropdownMenu);

exports.default = _default;
module.exports = exports["default"];