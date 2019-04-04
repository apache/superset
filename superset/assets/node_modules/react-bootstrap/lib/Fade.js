'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

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

var _Transition = require('react-overlays/lib/Transition');

var _Transition2 = _interopRequireDefault(_Transition);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * Show the component; triggers the fade in or fade out animation
   */
  in: _propTypes2.default.bool,

  /**
   * Wait until the first "enter" transition to mount the component (add it to the DOM)
   */
  mountOnEnter: _propTypes2.default.bool,

  /**
   * Unmount the component (remove it from the DOM) when it is faded out
   */
  unmountOnExit: _propTypes2.default.bool,

  /**
   * Run the fade in animation when the component mounts, if it is initially
   * shown
   */
  transitionAppear: _propTypes2.default.bool,

  /**
   * Duration of the fade animation in milliseconds, to ensure that finishing
   * callbacks are fired even if the original browser transition end events are
   * canceled
   */
  timeout: _propTypes2.default.number,

  /**
   * Callback fired before the component fades in
   */
  onEnter: _propTypes2.default.func,
  /**
   * Callback fired after the component starts to fade in
   */
  onEntering: _propTypes2.default.func,
  /**
   * Callback fired after the has component faded in
   */
  onEntered: _propTypes2.default.func,
  /**
   * Callback fired before the component fades out
   */
  onExit: _propTypes2.default.func,
  /**
   * Callback fired after the component starts to fade out
   */
  onExiting: _propTypes2.default.func,
  /**
   * Callback fired after the component has faded out
   */
  onExited: _propTypes2.default.func
};

var defaultProps = {
  in: false,
  timeout: 300,
  mountOnEnter: false,
  unmountOnExit: false,
  transitionAppear: false
};

var Fade = function (_React$Component) {
  (0, _inherits3.default)(Fade, _React$Component);

  function Fade() {
    (0, _classCallCheck3.default)(this, Fade);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Fade.prototype.render = function render() {
    return _react2.default.createElement(_Transition2.default, (0, _extends3.default)({}, this.props, {
      className: (0, _classnames2.default)(this.props.className, 'fade'),
      enteredClassName: 'in',
      enteringClassName: 'in'
    }));
  };

  return Fade;
}(_react2.default.Component);

Fade.propTypes = propTypes;
Fade.defaultProps = defaultProps;

exports.default = Fade;
module.exports = exports['default'];