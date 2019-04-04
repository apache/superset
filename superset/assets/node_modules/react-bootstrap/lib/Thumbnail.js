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

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * src property that is passed down to the image inside this component
   */
  src: _propTypes2.default.string,
  /**
   * alt property that is passed down to the image inside this component
   */
  alt: _propTypes2.default.string,
  /**
   * href property that is passed down to the image inside this component
   */
  href: _propTypes2.default.string,
  /**
   * onError callback that is passed down to the image inside this component
   */
  onError: _propTypes2.default.func,
  /**
   * onLoad callback that is passed down to the image inside this component
   */
  onLoad: _propTypes2.default.func
}; /* eslint-disable jsx-a11y/alt-text */

var Thumbnail = function (_React$Component) {
  (0, _inherits3.default)(Thumbnail, _React$Component);

  function Thumbnail() {
    (0, _classCallCheck3.default)(this, Thumbnail);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Thumbnail.prototype.render = function render() {
    var _props = this.props,
        src = _props.src,
        alt = _props.alt,
        onError = _props.onError,
        onLoad = _props.onLoad,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['src', 'alt', 'onError', 'onLoad', 'className', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var Component = elementProps.href ? _SafeAnchor2.default : 'div';
    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2.default.createElement(
      Component,
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      _react2.default.createElement('img', { src: src, alt: alt, onError: onError, onLoad: onLoad }),
      children && _react2.default.createElement(
        'div',
        { className: 'caption' },
        children
      )
    );
  };

  return Thumbnail;
}(_react2.default.Component);

Thumbnail.propTypes = propTypes;

exports.default = (0, _bootstrapUtils.bsClass)('thumbnail', Thumbnail);
module.exports = exports['default'];