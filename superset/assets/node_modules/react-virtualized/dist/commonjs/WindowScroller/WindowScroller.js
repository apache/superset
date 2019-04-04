'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IS_SCROLLING_TIMEOUT = undefined;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _reactDom = require('react-dom');

var ReactDOM = _interopRequireWildcard(_reactDom);

var _onScroll = require('./utils/onScroll');

var _dimensions = require('./utils/dimensions');

var _detectElementResize = require('../vendor/detectElementResize');

var _detectElementResize2 = _interopRequireDefault(_detectElementResize);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Specifies the number of miliseconds during which to disable pointer events while a scroll is in progress.
 * This improves performance and makes scrolling smoother.
 */
var IS_SCROLLING_TIMEOUT = exports.IS_SCROLLING_TIMEOUT = 150;

var getWindow = function getWindow() {
  return typeof window !== 'undefined' ? window : undefined;
};

var WindowScroller = function (_React$PureComponent) {
  (0, _inherits3.default)(WindowScroller, _React$PureComponent);

  function WindowScroller() {
    var _ref;

    var _temp, _this, _ret;

    (0, _classCallCheck3.default)(this, WindowScroller);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = (0, _possibleConstructorReturn3.default)(this, (_ref = WindowScroller.__proto__ || (0, _getPrototypeOf2.default)(WindowScroller)).call.apply(_ref, [this].concat(args))), _this), _this._window = getWindow(), _this._isMounted = false, _this._positionFromTop = 0, _this._positionFromLeft = 0, _this.state = (0, _extends3.default)({}, (0, _dimensions.getDimensions)(_this.props.scrollElement, _this.props), {
      isScrolling: false,
      scrollLeft: 0,
      scrollTop: 0
    }), _this._registerChild = function (element) {
      if (element && !(element instanceof Element)) {
        console.warn('WindowScroller registerChild expects to be passed Element or null');
      }
      _this._child = element;
      _this.updatePosition();
    }, _this._onChildScroll = function (_ref2) {
      var scrollTop = _ref2.scrollTop;

      if (_this.state.scrollTop === scrollTop) {
        return;
      }

      var scrollElement = _this.props.scrollElement;
      if (scrollElement) {
        if (typeof scrollElement.scrollTo === 'function') {
          scrollElement.scrollTo(0, scrollTop + _this._positionFromTop);
        } else {
          scrollElement.scrollTop = scrollTop + _this._positionFromTop;
        }
      }
    }, _this._registerResizeListener = function (element) {
      if (element === window) {
        window.addEventListener('resize', _this._onResize, false);
      } else {
        _this._detectElementResize.addResizeListener(element, _this._onResize);
      }
    }, _this._unregisterResizeListener = function (element) {
      if (element === window) {
        window.removeEventListener('resize', _this._onResize, false);
      } else if (element) {
        _this._detectElementResize.removeResizeListener(element, _this._onResize);
      }
    }, _this._onResize = function () {
      _this.updatePosition();
    }, _this.__handleWindowScrollEvent = function () {
      if (!_this._isMounted) {
        return;
      }

      var onScroll = _this.props.onScroll;


      var scrollElement = _this.props.scrollElement;
      if (scrollElement) {
        var scrollOffset = (0, _dimensions.getScrollOffset)(scrollElement);
        var _scrollLeft = Math.max(0, scrollOffset.left - _this._positionFromLeft);
        var _scrollTop = Math.max(0, scrollOffset.top - _this._positionFromTop);

        _this.setState({
          isScrolling: true,
          scrollLeft: _scrollLeft,
          scrollTop: _scrollTop
        });

        onScroll({
          scrollLeft: _scrollLeft,
          scrollTop: _scrollTop
        });
      }
    }, _this.__resetIsScrolling = function () {
      _this.setState({
        isScrolling: false
      });
    }, _temp), (0, _possibleConstructorReturn3.default)(_this, _ret);
  }

  (0, _createClass3.default)(WindowScroller, [{
    key: 'updatePosition',
    value: function updatePosition() {
      var scrollElement = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.props.scrollElement;
      var onResize = this.props.onResize;
      var _state = this.state,
          height = _state.height,
          width = _state.width;


      var thisNode = this._child || ReactDOM.findDOMNode(this);
      if (thisNode instanceof Element && scrollElement) {
        var offset = (0, _dimensions.getPositionOffset)(thisNode, scrollElement);
        this._positionFromTop = offset.top;
        this._positionFromLeft = offset.left;
      }

      var dimensions = (0, _dimensions.getDimensions)(scrollElement, this.props);
      if (height !== dimensions.height || width !== dimensions.width) {
        this.setState({
          height: dimensions.height,
          width: dimensions.width
        });
        onResize({
          height: dimensions.height,
          width: dimensions.width
        });
      }
    }
  }, {
    key: 'componentDidMount',
    value: function componentDidMount() {
      var scrollElement = this.props.scrollElement;

      this._detectElementResize = (0, _detectElementResize2.default)();

      this.updatePosition(scrollElement);

      if (scrollElement) {
        (0, _onScroll.registerScrollListener)(this, scrollElement);
        this._registerResizeListener(scrollElement);
      }

      this._isMounted = true;
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps, prevState) {
      var scrollElement = this.props.scrollElement;
      var prevScrollElement = prevProps.scrollElement;


      if (prevScrollElement !== scrollElement && prevScrollElement != null && scrollElement != null) {
        this.updatePosition(scrollElement);

        (0, _onScroll.unregisterScrollListener)(this, prevScrollElement);
        (0, _onScroll.registerScrollListener)(this, scrollElement);

        this._unregisterResizeListener(prevScrollElement);
        this._registerResizeListener(scrollElement);
      }
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      var scrollElement = this.props.scrollElement;
      if (scrollElement) {
        (0, _onScroll.unregisterScrollListener)(this, scrollElement);
        this._unregisterResizeListener(scrollElement);
      }

      this._isMounted = false;
    }
  }, {
    key: 'render',
    value: function render() {
      var children = this.props.children;
      var _state2 = this.state,
          isScrolling = _state2.isScrolling,
          scrollTop = _state2.scrollTop,
          scrollLeft = _state2.scrollLeft,
          height = _state2.height,
          width = _state2.width;


      return children({
        onChildScroll: this._onChildScroll,
        registerChild: this._registerChild,
        height: height,
        isScrolling: isScrolling,
        scrollLeft: scrollLeft,
        scrollTop: scrollTop,
        width: width
      });
    }

    // Referenced by utils/onScroll


    // Referenced by utils/onScroll

  }]);
  return WindowScroller;
}(React.PureComponent);

WindowScroller.defaultProps = {
  onResize: function onResize() {},
  onScroll: function onScroll() {},
  scrollingResetTimeInterval: IS_SCROLLING_TIMEOUT,
  scrollElement: getWindow(),
  serverHeight: 0,
  serverWidth: 0
};
WindowScroller.propTypes = process.env.NODE_ENV === 'production' ? null : {
  /**
   * Function responsible for rendering children.
   * This function should implement the following signature:
   * ({ height, isScrolling, scrollLeft, scrollTop, width }) => PropTypes.element
   */
  children: _propTypes2.default.func.isRequired,


  /** Callback to be invoked on-resize: ({ height, width }) */
  onResize: _propTypes2.default.func.isRequired,


  /** Callback to be invoked on-scroll: ({ scrollLeft, scrollTop }) */
  onScroll: _propTypes2.default.func.isRequired,


  /** Element to attach scroll event listeners. Defaults to window. */
  scrollElement: _propTypes2.default.oneOfType([_propTypes2.default.any, function () {
    return (typeof Element === 'function' ? _propTypes2.default.instanceOf(Element) : _propTypes2.default.any).apply(this, arguments);
  }]),

  /**
   * Wait this amount of time after the last scroll event before resetting child `pointer-events`.
   */
  scrollingResetTimeInterval: _propTypes2.default.number.isRequired,


  /** Height used for server-side rendering */
  serverHeight: _propTypes2.default.number.isRequired,


  /** Width used for server-side rendering */
  serverWidth: _propTypes2.default.number.isRequired
};
exports.default = WindowScroller;