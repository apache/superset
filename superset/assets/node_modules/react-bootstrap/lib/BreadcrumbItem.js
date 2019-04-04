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

var _SafeAnchor = require('./SafeAnchor');

var _SafeAnchor2 = _interopRequireDefault(_SafeAnchor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * If set to true, renders `span` instead of `a`
   */
  active: _propTypes2.default.bool,
  /**
   * `href` attribute for the inner `a` element
   */
  href: _propTypes2.default.string,
  /**
   * `title` attribute for the inner `a` element
   */
  title: _propTypes2.default.node,
  /**
   * `target` attribute for the inner `a` element
   */
  target: _propTypes2.default.string
};

var defaultProps = {
  active: false
};

var BreadcrumbItem = function (_React$Component) {
  (0, _inherits3.default)(BreadcrumbItem, _React$Component);

  function BreadcrumbItem() {
    (0, _classCallCheck3.default)(this, BreadcrumbItem);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  BreadcrumbItem.prototype.render = function render() {
    var _props = this.props,
        active = _props.active,
        href = _props.href,
        title = _props.title,
        target = _props.target,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['active', 'href', 'title', 'target', 'className']);

    // Don't try to render these props on non-active <span>.

    var linkProps = { href: href, title: title, target: target };

    return _react2.default.createElement(
      'li',
      { className: (0, _classnames2.default)(className, { active: active }) },
      active ? _react2.default.createElement('span', props) : _react2.default.createElement(_SafeAnchor2.default, (0, _extends3.default)({}, props, linkProps))
    );
  };

  return BreadcrumbItem;
}(_react2.default.Component);

BreadcrumbItem.propTypes = propTypes;
BreadcrumbItem.defaultProps = defaultProps;

exports.default = BreadcrumbItem;
module.exports = exports['default'];