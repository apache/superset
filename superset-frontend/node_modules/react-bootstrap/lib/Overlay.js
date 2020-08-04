"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireWildcard(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _Overlay = _interopRequireDefault(require("react-overlays/lib/Overlay"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _Fade = _interopRequireDefault(require("./Fade"));

var propTypes = (0, _extends2.default)({}, _Overlay.default.propTypes, {
  /**
   * Set the visibility of the Overlay
   */
  show: _propTypes.default.bool,

  /**
   * Specify whether the overlay should trigger onHide when the user clicks outside the overlay
   */
  rootClose: _propTypes.default.bool,

  /**
   * A callback invoked by the overlay when it wishes to be hidden. Required if
   * `rootClose` is specified.
   */
  onHide: _propTypes.default.func,

  /**
   * Use animation
   */
  animation: _propTypes.default.oneOfType([_propTypes.default.bool, _elementType.default]),

  /**
   * Callback fired before the Overlay transitions in
   */
  onEnter: _propTypes.default.func,

  /**
   * Callback fired as the Overlay begins to transition in
   */
  onEntering: _propTypes.default.func,

  /**
   * Callback fired after the Overlay finishes transitioning in
   */
  onEntered: _propTypes.default.func,

  /**
   * Callback fired right before the Overlay transitions out
   */
  onExit: _propTypes.default.func,

  /**
   * Callback fired as the Overlay begins to transition out
   */
  onExiting: _propTypes.default.func,

  /**
   * Callback fired after the Overlay finishes transitioning out
   */
  onExited: _propTypes.default.func,

  /**
   * Sets the direction of the Overlay.
   */
  placement: _propTypes.default.oneOf(['top', 'right', 'bottom', 'left'])
});
var defaultProps = {
  animation: _Fade.default,
  rootClose: false,
  show: false,
  placement: 'right'
};

var Overlay =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Overlay, _React$Component);

  function Overlay() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Overlay.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        animation = _this$props.animation,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["animation", "children"]);
    var transition = animation === true ? _Fade.default : animation || null;
    var child;

    if (!transition) {
      child = (0, _react.cloneElement)(children, {
        className: (0, _classnames.default)(children.props.className, 'in')
      });
    } else {
      child = children;
    }

    return _react.default.createElement(_Overlay.default, (0, _extends2.default)({}, props, {
      transition: transition
    }), child);
  };

  return Overlay;
}(_react.default.Component);

Overlay.propTypes = propTypes;
Overlay.defaultProps = defaultProps;
var _default = Overlay;
exports.default = _default;
module.exports = exports["default"];