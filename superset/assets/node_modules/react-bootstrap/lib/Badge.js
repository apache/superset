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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: `pullRight` doesn't belong here. There's no special handling here.

var propTypes = {
  pullRight: _propTypes2.default.bool
};

var defaultProps = {
  pullRight: false
};

var Badge = function (_React$Component) {
  (0, _inherits3.default)(Badge, _React$Component);

  function Badge() {
    (0, _classCallCheck3.default)(this, Badge);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Badge.prototype.hasContent = function hasContent(children) {
    var result = false;

    _react2.default.Children.forEach(children, function (child) {
      if (result) {
        return;
      }

      if (child || child === 0) {
        result = true;
      }
    });

    return result;
  };

  Badge.prototype.render = function render() {
    var _props = this.props,
        pullRight = _props.pullRight,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['pullRight', 'className', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      'pull-right': pullRight,

      // Hack for collapsing on IE8.
      hidden: !this.hasContent(children)
    });

    return _react2.default.createElement(
      'span',
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      children
    );
  };

  return Badge;
}(_react2.default.Component);

Badge.propTypes = propTypes;
Badge.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('badge', Badge);
module.exports = exports['default'];