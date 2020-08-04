"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _parseInt2 = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/parse-int"));

var _classnames = _interopRequireDefault(require("classnames"));

var _style = _interopRequireDefault(require("dom-helpers/style"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _Transition = _interopRequireWildcard(require("react-transition-group/Transition"));

var _capitalize = _interopRequireDefault(require("./utils/capitalize"));

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _collapseStyles;

var MARGINS = {
  height: ['marginTop', 'marginBottom'],
  width: ['marginLeft', 'marginRight']
}; // reading a dimension prop will cause the browser to recalculate,
// which will let our animations work

function triggerBrowserReflow(node) {
  node.offsetHeight; // eslint-disable-line no-unused-expressions
}

function getDimensionValue(dimension, elem) {
  var value = elem["offset" + (0, _capitalize.default)(dimension)];
  var margins = MARGINS[dimension];
  return value + (0, _parseInt2.default)((0, _style.default)(elem, margins[0]), 10) + (0, _parseInt2.default)((0, _style.default)(elem, margins[1]), 10);
}

var collapseStyles = (_collapseStyles = {}, _collapseStyles[_Transition.EXITED] = 'collapse', _collapseStyles[_Transition.EXITING] = 'collapsing', _collapseStyles[_Transition.ENTERING] = 'collapsing', _collapseStyles[_Transition.ENTERED] = 'collapse in', _collapseStyles);
var propTypes = {
  /**
   * Show the component; triggers the expand or collapse animation
   */
  in: _propTypes.default.bool,

  /**
   * Wait until the first "enter" transition to mount the component (add it to the DOM)
   */
  mountOnEnter: _propTypes.default.bool,

  /**
   * Unmount the component (remove it from the DOM) when it is collapsed
   */
  unmountOnExit: _propTypes.default.bool,

  /**
   * Run the expand animation when the component mounts, if it is initially
   * shown
   */
  appear: _propTypes.default.bool,

  /**
   * Duration of the collapse animation in milliseconds, to ensure that
   * finishing callbacks are fired even if the original browser transition end
   * events are canceled
   */
  timeout: _propTypes.default.number,

  /**
   * Callback fired before the component expands
   */
  onEnter: _propTypes.default.func,

  /**
   * Callback fired after the component starts to expand
   */
  onEntering: _propTypes.default.func,

  /**
   * Callback fired after the component has expanded
   */
  onEntered: _propTypes.default.func,

  /**
   * Callback fired before the component collapses
   */
  onExit: _propTypes.default.func,

  /**
   * Callback fired after the component starts to collapse
   */
  onExiting: _propTypes.default.func,

  /**
   * Callback fired after the component has collapsed
   */
  onExited: _propTypes.default.func,

  /**
   * The dimension used when collapsing, or a function that returns the
   * dimension
   *
   * _Note: Bootstrap only partially supports 'width'!
   * You will need to supply your own CSS animation for the `.width` CSS class._
   */
  dimension: _propTypes.default.oneOfType([_propTypes.default.oneOf(['height', 'width']), _propTypes.default.func]),

  /**
   * Function that returns the height or width of the animating DOM node
   *
   * Allows for providing some custom logic for how much the Collapse component
   * should animate in its specified dimension. Called with the current
   * dimension prop value and the DOM node.
   */
  getDimensionValue: _propTypes.default.func,

  /**
   * ARIA role of collapsible element
   */
  role: _propTypes.default.string
};
var defaultProps = {
  in: false,
  timeout: 300,
  mountOnEnter: false,
  unmountOnExit: false,
  appear: false,
  dimension: 'height',
  getDimensionValue: getDimensionValue
};

var Collapse =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Collapse, _React$Component);

  function Collapse() {
    var _this;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _React$Component.call.apply(_React$Component, [this].concat(args)) || this;

    _this.handleEnter = function (elem) {
      elem.style[_this.getDimension()] = '0';
    };

    _this.handleEntering = function (elem) {
      var dimension = _this.getDimension();

      elem.style[dimension] = _this._getScrollDimensionValue(elem, dimension);
    };

    _this.handleEntered = function (elem) {
      elem.style[_this.getDimension()] = null;
    };

    _this.handleExit = function (elem) {
      var dimension = _this.getDimension();

      elem.style[dimension] = _this.props.getDimensionValue(dimension, elem) + "px";
      triggerBrowserReflow(elem);
    };

    _this.handleExiting = function (elem) {
      elem.style[_this.getDimension()] = '0';
    };

    return _this;
  }

  var _proto = Collapse.prototype;

  _proto.getDimension = function getDimension() {
    return typeof this.props.dimension === 'function' ? this.props.dimension() : this.props.dimension;
  }; // for testing


  _proto._getScrollDimensionValue = function _getScrollDimensionValue(elem, dimension) {
    return elem["scroll" + (0, _capitalize.default)(dimension)] + "px";
  };
  /* -- Expanding -- */


  _proto.render = function render() {
    var _this2 = this;

    var _this$props = this.props,
        onEnter = _this$props.onEnter,
        onEntering = _this$props.onEntering,
        onEntered = _this$props.onEntered,
        onExit = _this$props.onExit,
        onExiting = _this$props.onExiting,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["onEnter", "onEntering", "onEntered", "onExit", "onExiting", "className", "children"]);
    delete props.dimension;
    delete props.getDimensionValue;
    var handleEnter = (0, _createChainedFunction.default)(this.handleEnter, onEnter);
    var handleEntering = (0, _createChainedFunction.default)(this.handleEntering, onEntering);
    var handleEntered = (0, _createChainedFunction.default)(this.handleEntered, onEntered);
    var handleExit = (0, _createChainedFunction.default)(this.handleExit, onExit);
    var handleExiting = (0, _createChainedFunction.default)(this.handleExiting, onExiting);
    return _react.default.createElement(_Transition.default, (0, _extends2.default)({}, props, {
      "aria-expanded": props.role ? props.in : null,
      onEnter: handleEnter,
      onEntering: handleEntering,
      onEntered: handleEntered,
      onExit: handleExit,
      onExiting: handleExiting
    }), function (state, innerProps) {
      return _react.default.cloneElement(children, (0, _extends2.default)({}, innerProps, {
        className: (0, _classnames.default)(className, children.props.className, collapseStyles[state], _this2.getDimension() === 'width' && 'width')
      }));
    });
  };

  return Collapse;
}(_react.default.Component);

Collapse.propTypes = propTypes;
Collapse.defaultProps = defaultProps;
var _default = Collapse;
exports.default = _default;
module.exports = exports["default"];