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

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  onClick: _propTypes2.default.func,
  /**
   * The toggle content, if left empty it will render the default toggle (seen above).
   */
  children: _propTypes2.default.node
};

var contextTypes = {
  $bs_navbar: _propTypes2.default.shape({
    bsClass: _propTypes2.default.string,
    expanded: _propTypes2.default.bool,
    onToggle: _propTypes2.default.func.isRequired
  })
};

var NavbarToggle = function (_React$Component) {
  (0, _inherits3.default)(NavbarToggle, _React$Component);

  function NavbarToggle() {
    (0, _classCallCheck3.default)(this, NavbarToggle);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  NavbarToggle.prototype.render = function render() {
    var _props = this.props,
        onClick = _props.onClick,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['onClick', 'className', 'children']);

    var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

    var buttonProps = (0, _extends3.default)({
      type: 'button'
    }, props, {
      onClick: (0, _createChainedFunction2.default)(onClick, navbarProps.onToggle),
      className: (0, _classnames2.default)(className, (0, _bootstrapUtils.prefix)(navbarProps, 'toggle'), !navbarProps.expanded && 'collapsed')
    });

    if (children) {
      return _react2.default.createElement(
        'button',
        buttonProps,
        children
      );
    }

    return _react2.default.createElement(
      'button',
      buttonProps,
      _react2.default.createElement(
        'span',
        { className: 'sr-only' },
        'Toggle navigation'
      ),
      _react2.default.createElement('span', { className: 'icon-bar' }),
      _react2.default.createElement('span', { className: 'icon-bar' }),
      _react2.default.createElement('span', { className: 'icon-bar' })
    );
  };

  return NavbarToggle;
}(_react2.default.Component);

NavbarToggle.propTypes = propTypes;
NavbarToggle.contextTypes = contextTypes;

exports.default = NavbarToggle;
module.exports = exports['default'];