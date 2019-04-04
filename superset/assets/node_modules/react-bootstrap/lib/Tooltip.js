'use strict';

exports.__esModule = true;

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

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

var _isRequiredForA11y = require('prop-types-extra/lib/isRequiredForA11y');

var _isRequiredForA11y2 = _interopRequireDefault(_isRequiredForA11y);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * An html id attribute, necessary for accessibility
   * @type {string|number}
   * @required
   */
  id: (0, _isRequiredForA11y2.default)(_propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number])),

  /**
   * Sets the direction the Tooltip is positioned towards.
   */
  placement: _propTypes2.default.oneOf(['top', 'right', 'bottom', 'left']),

  /**
   * The "top" position value for the Tooltip.
   */
  positionTop: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]),
  /**
   * The "left" position value for the Tooltip.
   */
  positionLeft: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]),

  /**
   * The "top" position value for the Tooltip arrow.
   */
  arrowOffsetTop: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]),
  /**
   * The "left" position value for the Tooltip arrow.
   */
  arrowOffsetLeft: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string])
};

var defaultProps = {
  placement: 'right'
};

var Tooltip = function (_React$Component) {
  (0, _inherits3.default)(Tooltip, _React$Component);

  function Tooltip() {
    (0, _classCallCheck3.default)(this, Tooltip);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Tooltip.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        placement = _props.placement,
        positionTop = _props.positionTop,
        positionLeft = _props.positionLeft,
        arrowOffsetTop = _props.arrowOffsetTop,
        arrowOffsetLeft = _props.arrowOffsetLeft,
        className = _props.className,
        style = _props.style,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['placement', 'positionTop', 'positionLeft', 'arrowOffsetTop', 'arrowOffsetLeft', 'className', 'style', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends4.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[placement] = true, _extends2));

    var outerStyle = (0, _extends4.default)({
      top: positionTop,
      left: positionLeft
    }, style);

    var arrowStyle = {
      top: arrowOffsetTop,
      left: arrowOffsetLeft
    };

    return _react2.default.createElement(
      'div',
      (0, _extends4.default)({}, elementProps, {
        role: 'tooltip',
        className: (0, _classnames2.default)(className, classes),
        style: outerStyle
      }),
      _react2.default.createElement('div', { className: (0, _bootstrapUtils.prefix)(bsProps, 'arrow'), style: arrowStyle }),
      _react2.default.createElement(
        'div',
        { className: (0, _bootstrapUtils.prefix)(bsProps, 'inner') },
        children
      )
    );
  };

  return Tooltip;
}(_react2.default.Component);

Tooltip.propTypes = propTypes;
Tooltip.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('tooltip', Tooltip);
module.exports = exports['default'];