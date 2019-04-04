'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  href: _propTypes2.default.string,
  onClick: _propTypes2.default.func,
  onKeyDown: _propTypes2.default.func,
  disabled: _propTypes2.default.bool,
  role: _propTypes2.default.string,
  tabIndex: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]),
  /**
   * this is sort of silly but needed for Button
   */
  componentClass: _elementType2.default
};

var defaultProps = {
  componentClass: 'a'
};

function isTrivialHref(href) {
  return !href || href.trim() === '#';
}

/**
 * There are situations due to browser quirks or Bootstrap CSS where
 * an anchor tag is needed, when semantically a button tag is the
 * better choice. SafeAnchor ensures that when an anchor is used like a
 * button its accessible. It also emulates input `disabled` behavior for
 * links, which is usually desirable for Buttons, NavItems, MenuItems, etc.
 */

var SafeAnchor = function (_React$Component) {
  (0, _inherits3.default)(SafeAnchor, _React$Component);

  function SafeAnchor(props, context) {
    (0, _classCallCheck3.default)(this, SafeAnchor);

    var _this = (0, _possibleConstructorReturn3.default)(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    _this.handleKeyDown = _this.handleKeyDown.bind(_this);
    return _this;
  }

  SafeAnchor.prototype.handleClick = function handleClick(event) {
    var _props = this.props,
        disabled = _props.disabled,
        href = _props.href,
        onClick = _props.onClick;


    if (disabled || isTrivialHref(href)) {
      event.preventDefault();
    }

    if (disabled) {
      event.stopPropagation();
      return;
    }

    if (onClick) {
      onClick(event);
    }
  };

  SafeAnchor.prototype.handleKeyDown = function handleKeyDown(event) {
    if (event.key === ' ') {
      event.preventDefault();
      this.handleClick(event);
    }
  };

  SafeAnchor.prototype.render = function render() {
    var _props2 = this.props,
        Component = _props2.componentClass,
        disabled = _props2.disabled,
        onKeyDown = _props2.onKeyDown,
        props = (0, _objectWithoutProperties3.default)(_props2, ['componentClass', 'disabled', 'onKeyDown']);


    if (isTrivialHref(props.href)) {
      props.role = props.role || 'button';
      // we want to make sure there is a href attribute on the node
      // otherwise, the cursor incorrectly styled (except with role='button')
      props.href = props.href || '#';
    }

    if (disabled) {
      props.tabIndex = -1;
      props.style = (0, _extends3.default)({ pointerEvents: 'none' }, props.style);
    }

    return _react2.default.createElement(Component, (0, _extends3.default)({}, props, {
      onClick: this.handleClick,
      onKeyDown: (0, _createChainedFunction2.default)(this.handleKeyDown, onKeyDown)
    }));
  };

  return SafeAnchor;
}(_react2.default.Component);

SafeAnchor.propTypes = propTypes;
SafeAnchor.defaultProps = defaultProps;

exports.default = SafeAnchor;
module.exports = exports['default'];