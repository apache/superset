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

var propTypes = {
  /**
   * Sets image as responsive image
   */
  responsive: _propTypes2.default.bool,

  /**
   * Sets image shape as rounded
   */
  rounded: _propTypes2.default.bool,

  /**
   * Sets image shape as circle
   */
  circle: _propTypes2.default.bool,

  /**
   * Sets image shape as thumbnail
   */
  thumbnail: _propTypes2.default.bool
};

var defaultProps = {
  responsive: false,
  rounded: false,
  circle: false,
  thumbnail: false
};

var Image = function (_React$Component) {
  (0, _inherits3.default)(Image, _React$Component);

  function Image() {
    (0, _classCallCheck3.default)(this, Image);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Image.prototype.render = function render() {
    var _classes;

    var _props = this.props,
        responsive = _props.responsive,
        rounded = _props.rounded,
        circle = _props.circle,
        thumbnail = _props.thumbnail,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['responsive', 'rounded', 'circle', 'thumbnail', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (_classes = {}, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'responsive')] = responsive, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'rounded')] = rounded, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'circle')] = circle, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'thumbnail')] = thumbnail, _classes);

    return _react2.default.createElement('img', (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return Image;
}(_react2.default.Component);

Image.propTypes = propTypes;
Image.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('img', Image);
module.exports = exports['default'];