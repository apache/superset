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

var _Collapse = require('./Collapse');

var _Collapse2 = _interopRequireDefault(_Collapse);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var contextTypes = {
  $bs_navbar: _propTypes2.default.shape({
    bsClass: _propTypes2.default.string,
    expanded: _propTypes2.default.bool
  })
};

var NavbarCollapse = function (_React$Component) {
  (0, _inherits3.default)(NavbarCollapse, _React$Component);

  function NavbarCollapse() {
    (0, _classCallCheck3.default)(this, NavbarCollapse);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  NavbarCollapse.prototype.render = function render() {
    var _props = this.props,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['children']);

    var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

    var bsClassName = (0, _bootstrapUtils.prefix)(navbarProps, 'collapse');

    return _react2.default.createElement(
      _Collapse2.default,
      (0, _extends3.default)({ 'in': navbarProps.expanded }, props),
      _react2.default.createElement(
        'div',
        { className: bsClassName },
        children
      )
    );
  };

  return NavbarCollapse;
}(_react2.default.Component);

NavbarCollapse.contextTypes = contextTypes;

exports.default = NavbarCollapse;
module.exports = exports['default'];