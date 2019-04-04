'use strict';

exports.__esModule = true;

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _from = require('babel-runtime/core-js/array/from');

var _from2 = _interopRequireDefault(_from);

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

var _RootCloseWrapper = require('react-overlays/lib/RootCloseWrapper');

var _RootCloseWrapper2 = _interopRequireDefault(_RootCloseWrapper);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  open: _propTypes2.default.bool,
  pullRight: _propTypes2.default.bool,
  onClose: _propTypes2.default.func,
  labelledBy: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number]),
  onSelect: _propTypes2.default.func,
  rootCloseEvent: _propTypes2.default.oneOf(['click', 'mousedown'])
};

var defaultProps = {
  bsRole: 'menu',
  pullRight: false
};

var DropdownMenu = function (_React$Component) {
  (0, _inherits3.default)(DropdownMenu, _React$Component);

  function DropdownMenu(props) {
    (0, _classCallCheck3.default)(this, DropdownMenu);

    var _this = (0, _possibleConstructorReturn3.default)(this, _React$Component.call(this, props));

    _this.handleRootClose = _this.handleRootClose.bind(_this);
    _this.handleKeyDown = _this.handleKeyDown.bind(_this);
    return _this;
  }

  DropdownMenu.prototype.getFocusableMenuItems = function getFocusableMenuItems() {
    var node = _reactDom2.default.findDOMNode(this);
    if (!node) {
      return [];
    }

    return (0, _from2.default)(node.querySelectorAll('[tabIndex="-1"]'));
  };

  DropdownMenu.prototype.getItemsAndActiveIndex = function getItemsAndActiveIndex() {
    var items = this.getFocusableMenuItems();
    var activeIndex = items.indexOf(document.activeElement);

    return { items: items, activeIndex: activeIndex };
  };

  DropdownMenu.prototype.focusNext = function focusNext() {
    var _getItemsAndActiveInd = this.getItemsAndActiveIndex(),
        items = _getItemsAndActiveInd.items,
        activeIndex = _getItemsAndActiveInd.activeIndex;

    if (items.length === 0) {
      return;
    }

    var nextIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    items[nextIndex].focus();
  };

  DropdownMenu.prototype.focusPrevious = function focusPrevious() {
    var _getItemsAndActiveInd2 = this.getItemsAndActiveIndex(),
        items = _getItemsAndActiveInd2.items,
        activeIndex = _getItemsAndActiveInd2.activeIndex;

    if (items.length === 0) {
      return;
    }

    var prevIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    items[prevIndex].focus();
  };

  DropdownMenu.prototype.handleKeyDown = function handleKeyDown(event) {
    switch (event.keyCode) {
      case _keycode2.default.codes.down:
        this.focusNext();
        event.preventDefault();
        break;
      case _keycode2.default.codes.up:
        this.focusPrevious();
        event.preventDefault();
        break;
      case _keycode2.default.codes.esc:
      case _keycode2.default.codes.tab:
        this.props.onClose(event, { source: 'keydown' });
        break;
      default:
    }
  };

  DropdownMenu.prototype.handleRootClose = function handleRootClose(event) {
    this.props.onClose(event, { source: 'rootClose' });
  };

  DropdownMenu.prototype.render = function render() {
    var _extends2,
        _this2 = this;

    var _props = this.props,
        open = _props.open,
        pullRight = _props.pullRight,
        labelledBy = _props.labelledBy,
        onSelect = _props.onSelect,
        className = _props.className,
        rootCloseEvent = _props.rootCloseEvent,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['open', 'pullRight', 'labelledBy', 'onSelect', 'className', 'rootCloseEvent', 'children']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['onClose']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var classes = (0, _extends4.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'right')] = pullRight, _extends2));

    return _react2.default.createElement(
      _RootCloseWrapper2.default,
      {
        disabled: !open,
        onRootClose: this.handleRootClose,
        event: rootCloseEvent
      },
      _react2.default.createElement(
        'ul',
        (0, _extends4.default)({}, elementProps, {
          role: 'menu',
          className: (0, _classnames2.default)(className, classes),
          'aria-labelledby': labelledBy
        }),
        _ValidComponentChildren2.default.map(children, function (child) {
          return _react2.default.cloneElement(child, {
            onKeyDown: (0, _createChainedFunction2.default)(child.props.onKeyDown, _this2.handleKeyDown),
            onSelect: (0, _createChainedFunction2.default)(child.props.onSelect, onSelect)
          });
        })
      )
    );
  };

  return DropdownMenu;
}(_react2.default.Component);

DropdownMenu.propTypes = propTypes;
DropdownMenu.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('dropdown-menu', DropdownMenu);
module.exports = exports['default'];