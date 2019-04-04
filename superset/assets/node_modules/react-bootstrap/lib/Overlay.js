'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _Overlay = require('react-overlays/lib/Overlay');

var _Overlay2 = _interopRequireDefault(_Overlay);

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _Fade = require('./Fade');

var _Fade2 = _interopRequireDefault(_Fade);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = (0, _extends3.default)({}, _Overlay2.default.propTypes, {

  /**
   * Set the visibility of the Overlay
   */
  show: _propTypes2.default.bool,
  /**
   * Specify whether the overlay should trigger onHide when the user clicks outside the overlay
   */
  rootClose: _propTypes2.default.bool,
  /**
   * A callback invoked by the overlay when it wishes to be hidden. Required if
   * `rootClose` is specified.
   */
  onHide: _propTypes2.default.func,

  /**
   * Use animation
   */
  animation: _propTypes2.default.oneOfType([_propTypes2.default.bool, _elementType2.default]),

  /**
   * Callback fired before the Overlay transitions in
   */
  onEnter: _propTypes2.default.func,

  /**
   * Callback fired as the Overlay begins to transition in
   */
  onEntering: _propTypes2.default.func,

  /**
   * Callback fired after the Overlay finishes transitioning in
   */
  onEntered: _propTypes2.default.func,

  /**
   * Callback fired right before the Overlay transitions out
   */
  onExit: _propTypes2.default.func,

  /**
   * Callback fired as the Overlay begins to transition out
   */
  onExiting: _propTypes2.default.func,

  /**
   * Callback fired after the Overlay finishes transitioning out
   */
  onExited: _propTypes2.default.func,

  /**
   * Sets the direction of the Overlay.
   */
  placement: _propTypes2.default.oneOf(['top', 'right', 'bottom', 'left'])
});

var defaultProps = {
  animation: _Fade2.default,
  rootClose: false,
  show: false,
  placement: 'right'
};

var Overlay = function (_React$Component) {
  (0, _inherits3.default)(Overlay, _React$Component);

  function Overlay() {
    (0, _classCallCheck3.default)(this, Overlay);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Overlay.prototype.render = function render() {
    var _props = this.props,
        animation = _props.animation,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['animation', 'children']);


    var transition = animation === true ? _Fade2.default : animation || null;

    var child = void 0;

    if (!transition) {
      child = (0, _react.cloneElement)(children, {
        className: (0, _classnames2.default)(children.props.className, 'in')
      });
    } else {
      child = children;
    }

    return _react2.default.createElement(
      _Overlay2.default,
      (0, _extends3.default)({}, props, {
        transition: transition
      }),
      child
    );
  };

  return Overlay;
}(_react2.default.Component);

Overlay.propTypes = propTypes;
Overlay.defaultProps = defaultProps;

exports.default = Overlay;
module.exports = exports['default'];