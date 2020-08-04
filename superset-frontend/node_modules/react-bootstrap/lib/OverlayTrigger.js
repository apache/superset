"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _isArray = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/array/is-array"));

var _contains = _interopRequireDefault(require("dom-helpers/query/contains"));

var _react = _interopRequireWildcard(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _reactDom = _interopRequireDefault(require("react-dom"));

var _warning = _interopRequireDefault(require("warning"));

var _Overlay = _interopRequireDefault(require("./Overlay"));

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

/**
 * Check if value one is inside or equal to the of value
 *
 * @param {string} one
 * @param {string|array} of
 * @returns {boolean}
 */
function isOneOf(one, of) {
  if ((0, _isArray.default)(of)) {
    return of.indexOf(one) >= 0;
  }

  return one === of;
}

var triggerType = _propTypes.default.oneOf(['click', 'hover', 'focus']);

var propTypes = (0, _extends2.default)({}, _Overlay.default.propTypes, {
  /**
   * Specify which action or actions trigger Overlay visibility
   */
  trigger: _propTypes.default.oneOfType([triggerType, _propTypes.default.arrayOf(triggerType)]),

  /**
   * A millisecond delay amount to show and hide the Overlay once triggered
   */
  delay: _propTypes.default.number,

  /**
   * A millisecond delay amount before showing the Overlay once triggered.
   */
  delayShow: _propTypes.default.number,

  /**
   * A millisecond delay amount before hiding the Overlay once triggered.
   */
  delayHide: _propTypes.default.number,
  // FIXME: This should be `defaultShow`.

  /**
   * The initial visibility state of the Overlay. For more nuanced visibility
   * control, consider using the Overlay component directly.
   */
  defaultOverlayShown: _propTypes.default.bool,

  /**
   * An element or text to overlay next to the target.
   */
  overlay: _propTypes.default.node.isRequired,

  /**
   * @private
   */
  onBlur: _propTypes.default.func,

  /**
   * @private
   */
  onClick: _propTypes.default.func,

  /**
   * @private
   */
  onFocus: _propTypes.default.func,

  /**
   * @private
   */
  onMouseOut: _propTypes.default.func,

  /**
   * @private
   */
  onMouseOver: _propTypes.default.func,
  // Overridden props from `<Overlay>`.

  /**
   * @private
   */
  target: _propTypes.default.oneOf([null]),

  /**
   * @private
   */
  onHide: _propTypes.default.oneOf([null]),

  /**
   * @private
   */
  show: _propTypes.default.oneOf([null])
});
var defaultProps = {
  defaultOverlayShown: false,
  trigger: ['hover', 'focus']
};

var OverlayTrigger =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(OverlayTrigger, _React$Component);

  function OverlayTrigger(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleToggle = _this.handleToggle.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleDelayedShow = _this.handleDelayedShow.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleDelayedHide = _this.handleDelayedHide.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleHide = _this.handleHide.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));

    _this.handleMouseOver = function (e) {
      return _this.handleMouseOverOut(_this.handleDelayedShow, e, 'fromElement');
    };

    _this.handleMouseOut = function (e) {
      return _this.handleMouseOverOut(_this.handleDelayedHide, e, 'toElement');
    };

    _this._mountNode = null;
    _this.state = {
      show: props.defaultOverlayShown
    };
    return _this;
  }

  var _proto = OverlayTrigger.prototype;

  _proto.componentDidMount = function componentDidMount() {
    this._mountNode = document.createElement('div');
    this.renderOverlay();
  };

  _proto.componentDidUpdate = function componentDidUpdate() {
    this.renderOverlay();
  };

  _proto.componentWillUnmount = function componentWillUnmount() {
    _reactDom.default.unmountComponentAtNode(this._mountNode);

    this._mountNode = null;
    clearTimeout(this._hoverShowDelay);
    clearTimeout(this._hoverHideDelay);
  };

  _proto.handleDelayedHide = function handleDelayedHide() {
    var _this2 = this;

    if (this._hoverShowDelay != null) {
      clearTimeout(this._hoverShowDelay);
      this._hoverShowDelay = null;
      return;
    }

    if (!this.state.show || this._hoverHideDelay != null) {
      return;
    }

    var delay = this.props.delayHide != null ? this.props.delayHide : this.props.delay;

    if (!delay) {
      this.hide();
      return;
    }

    this._hoverHideDelay = setTimeout(function () {
      _this2._hoverHideDelay = null;

      _this2.hide();
    }, delay);
  };

  _proto.handleDelayedShow = function handleDelayedShow() {
    var _this3 = this;

    if (this._hoverHideDelay != null) {
      clearTimeout(this._hoverHideDelay);
      this._hoverHideDelay = null;
      return;
    }

    if (this.state.show || this._hoverShowDelay != null) {
      return;
    }

    var delay = this.props.delayShow != null ? this.props.delayShow : this.props.delay;

    if (!delay) {
      this.show();
      return;
    }

    this._hoverShowDelay = setTimeout(function () {
      _this3._hoverShowDelay = null;

      _this3.show();
    }, delay);
  };

  _proto.handleHide = function handleHide() {
    this.hide();
  }; // Simple implementation of mouseEnter and mouseLeave.
  // React's built version is broken: https://github.com/facebook/react/issues/4251
  // for cases when the trigger is disabled and mouseOut/Over can cause flicker
  // moving from one child element to another.


  _proto.handleMouseOverOut = function handleMouseOverOut(handler, e, relatedNative) {
    var target = e.currentTarget;
    var related = e.relatedTarget || e.nativeEvent[relatedNative];

    if ((!related || related !== target) && !(0, _contains.default)(target, related)) {
      handler(e);
    }
  };

  _proto.handleToggle = function handleToggle() {
    if (this.state.show) {
      this.hide();
    } else {
      this.show();
    }
  };

  _proto.hide = function hide() {
    this.setState({
      show: false
    });
  };

  _proto.makeOverlay = function makeOverlay(overlay, props) {
    return _react.default.createElement(_Overlay.default, (0, _extends2.default)({}, props, {
      show: this.state.show,
      onHide: this.handleHide,
      target: this
    }), overlay);
  };

  _proto.show = function show() {
    this.setState({
      show: true
    });
  };

  _proto.renderOverlay = function renderOverlay() {
    _reactDom.default.unstable_renderSubtreeIntoContainer(this, this._overlay, this._mountNode);
  };

  _proto.render = function render() {
    var _this$props = this.props,
        trigger = _this$props.trigger,
        overlay = _this$props.overlay,
        children = _this$props.children,
        onBlur = _this$props.onBlur,
        onClick = _this$props.onClick,
        onFocus = _this$props.onFocus,
        onMouseOut = _this$props.onMouseOut,
        onMouseOver = _this$props.onMouseOver,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["trigger", "overlay", "children", "onBlur", "onClick", "onFocus", "onMouseOut", "onMouseOver"]);
    delete props.delay;
    delete props.delayShow;
    delete props.delayHide;
    delete props.defaultOverlayShown;

    var child = _react.default.Children.only(children);

    var childProps = child.props;
    var triggerProps = {};

    if (this.state.show) {
      triggerProps['aria-describedby'] = overlay.props.id;
    } // FIXME: The logic here for passing through handlers on this component is
    // inconsistent. We shouldn't be passing any of these props through.


    triggerProps.onClick = (0, _createChainedFunction.default)(childProps.onClick, onClick);

    if (isOneOf('click', trigger)) {
      triggerProps.onClick = (0, _createChainedFunction.default)(triggerProps.onClick, this.handleToggle);
    }

    if (isOneOf('hover', trigger)) {
      process.env.NODE_ENV !== "production" ? (0, _warning.default)(!(trigger === 'hover'), '[react-bootstrap] Specifying only the `"hover"` trigger limits the ' + 'visibility of the overlay to just mouse users. Consider also ' + 'including the `"focus"` trigger so that touch and keyboard only ' + 'users can see the overlay as well.') : void 0;
      triggerProps.onMouseOver = (0, _createChainedFunction.default)(childProps.onMouseOver, onMouseOver, this.handleMouseOver);
      triggerProps.onMouseOut = (0, _createChainedFunction.default)(childProps.onMouseOut, onMouseOut, this.handleMouseOut);
    }

    if (isOneOf('focus', trigger)) {
      triggerProps.onFocus = (0, _createChainedFunction.default)(childProps.onFocus, onFocus, this.handleDelayedShow);
      triggerProps.onBlur = (0, _createChainedFunction.default)(childProps.onBlur, onBlur, this.handleDelayedHide);
    }

    this._overlay = this.makeOverlay(overlay, props);
    return (0, _react.cloneElement)(child, triggerProps);
  };

  return OverlayTrigger;
}(_react.default.Component);

OverlayTrigger.propTypes = propTypes;
OverlayTrigger.defaultProps = defaultProps;
var _default = OverlayTrigger;
exports.default = _default;
module.exports = exports["default"];