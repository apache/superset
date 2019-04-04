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

var _Media = require('./Media');

var _Media2 = _interopRequireDefault(_Media);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * Align the media to the top, middle, or bottom of the media object.
   */
  align: _propTypes2.default.oneOf(['top', 'middle', 'bottom'])
};

var MediaRight = function (_React$Component) {
  (0, _inherits3.default)(MediaRight, _React$Component);

  function MediaRight() {
    (0, _classCallCheck3.default)(this, MediaRight);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  MediaRight.prototype.render = function render() {
    var _props = this.props,
        align = _props.align,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['align', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    if (align) {
      // The class is e.g. `media-top`, not `media-right-top`.
      classes[(0, _bootstrapUtils.prefix)(_Media2.default.defaultProps, align)] = true;
    }

    return _react2.default.createElement('div', (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return MediaRight;
}(_react2.default.Component);

MediaRight.propTypes = propTypes;

exports.default = (0, _bootstrapUtils.bsClass)('media-right', MediaRight);
module.exports = exports['default'];