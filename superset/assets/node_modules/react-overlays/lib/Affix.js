'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _height = require('dom-helpers/query/height');

var _height2 = _interopRequireDefault(_height);

var _offset = require('dom-helpers/query/offset');

var _offset2 = _interopRequireDefault(_offset);

var _offsetParent = require('dom-helpers/query/offsetParent');

var _offsetParent2 = _interopRequireDefault(_offsetParent);

var _scrollTop = require('dom-helpers/query/scrollTop');

var _scrollTop2 = _interopRequireDefault(_scrollTop);

var _requestAnimationFrame = require('dom-helpers/util/requestAnimationFrame');

var _requestAnimationFrame2 = _interopRequireDefault(_requestAnimationFrame);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _addEventListener = require('./utils/addEventListener');

var _addEventListener2 = _interopRequireDefault(_addEventListener);

var _getDocumentHeight = require('./utils/getDocumentHeight');

var _getDocumentHeight2 = _interopRequireDefault(_getDocumentHeight);

var _ownerDocument = require('./utils/ownerDocument');

var _ownerDocument2 = _interopRequireDefault(_ownerDocument);

var _ownerWindow = require('./utils/ownerWindow');

var _ownerWindow2 = _interopRequireDefault(_ownerWindow);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The `<Affix/>` component toggles `position: fixed;` on and off, emulating
 * the effect found with `position: sticky;`.
 */
var Affix = function (_React$Component) {
  _inherits(Affix, _React$Component);

  function Affix(props, context) {
    _classCallCheck(this, Affix);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.onWindowScroll = function () {
      _this.onUpdate();
    };

    _this.onDocumentClick = function () {
      (0, _requestAnimationFrame2.default)(function () {
        return _this.onUpdate();
      });
    };

    _this.onUpdate = function () {
      if (!_this._isMounted) {
        return;
      }

      var _this$props = _this.props,
          offsetTop = _this$props.offsetTop,
          viewportOffsetTop = _this$props.viewportOffsetTop;

      var scrollTop = (0, _scrollTop2.default)((0, _ownerWindow2.default)(_this));
      var positionTopMin = scrollTop + (viewportOffsetTop || 0);

      if (positionTopMin <= offsetTop) {
        _this.updateState('top', null, null);
        return;
      }

      if (positionTopMin > _this.getPositionTopMax()) {
        if (_this.state.affixed === 'bottom') {
          _this.updateStateAtBottom();
        } else {
          // Setting position away from `fixed` can change the offset parent of
          // the affix, so we can't calculate the correct position until after
          // we've updated its position.
          _this.setState({
            affixed: 'bottom',
            position: 'absolute',
            top: null
          }, function () {
            if (!_this._isMounted) {
              return;
            }

            _this.updateStateAtBottom();
          });
        }
        return;
      }

      _this.updateState('affix', 'fixed', viewportOffsetTop);
    };

    _this.getPositionTopMax = function () {
      var documentHeight = (0, _getDocumentHeight2.default)((0, _ownerDocument2.default)(_this));
      var height = (0, _height2.default)(_reactDom2.default.findDOMNode(_this));

      return documentHeight - height - _this.props.offsetBottom;
    };

    _this.updateState = function (affixed, position, top) {
      if (affixed === _this.state.affixed && position === _this.state.position && top === _this.state.top) {
        return;
      }

      var upperName = affixed === 'affix' ? '' : affixed.charAt(0).toUpperCase() + affixed.substr(1);

      if (_this.props['onAffix' + upperName]) {
        _this.props['onAffix' + upperName]();
      }

      _this.setState({ affixed: affixed, position: position, top: top }, function () {
        if (_this.props['onAffixed' + upperName]) {
          _this.props['onAffixed' + upperName]();
        }
      });
    };

    _this.updateStateAtBottom = function () {
      var positionTopMax = _this.getPositionTopMax();
      var offsetParent = (0, _offsetParent2.default)(_reactDom2.default.findDOMNode(_this));
      var parentTop = (0, _offset2.default)(offsetParent).top;

      _this.updateState('bottom', 'absolute', positionTopMax - parentTop);
    };

    _this.state = {
      affixed: 'top',
      position: null,
      top: null
    };

    _this._needPositionUpdate = false;
    return _this;
  }

  Affix.prototype.componentDidMount = function componentDidMount() {
    var _this2 = this;

    this._isMounted = true;

    this._windowScrollListener = (0, _addEventListener2.default)((0, _ownerWindow2.default)(this), 'scroll', function () {
      return _this2.onWindowScroll();
    });
    this._documentClickListener = (0, _addEventListener2.default)((0, _ownerDocument2.default)(this), 'click', function () {
      return _this2.onDocumentClick();
    });

    this.onUpdate();
  };

  Affix.prototype.componentWillReceiveProps = function componentWillReceiveProps() {
    this._needPositionUpdate = true;
  };

  Affix.prototype.componentDidUpdate = function componentDidUpdate() {
    if (this._needPositionUpdate) {
      this._needPositionUpdate = false;
      this.onUpdate();
    }
  };

  Affix.prototype.componentWillUnmount = function componentWillUnmount() {
    this._isMounted = false;

    if (this._windowScrollListener) {
      this._windowScrollListener.remove();
    }
    if (this._documentClickListener) {
      this._documentClickListener.remove();
    }
  };

  Affix.prototype.render = function render() {
    var child = _react2.default.Children.only(this.props.children);
    var _child$props = child.props,
        className = _child$props.className,
        style = _child$props.style;
    var _state = this.state,
        affixed = _state.affixed,
        position = _state.position,
        top = _state.top;

    var positionStyle = { position: position, top: top };

    var affixClassName = void 0;
    var affixStyle = void 0;
    if (affixed === 'top') {
      affixClassName = this.props.topClassName;
      affixStyle = this.props.topStyle;
    } else if (affixed === 'bottom') {
      affixClassName = this.props.bottomClassName;
      affixStyle = this.props.bottomStyle;
    } else {
      affixClassName = this.props.affixClassName;
      affixStyle = this.props.affixStyle;
    }

    return _react2.default.cloneElement(child, {
      className: (0, _classnames2.default)(affixClassName, className),
      style: _extends({}, positionStyle, affixStyle, style)
    });
  };

  return Affix;
}(_react2.default.Component);

Affix.propTypes = {
  /**
   * Pixels to offset from top of screen when calculating position
   */
  offsetTop: _propTypes2.default.number,

  /**
   * When affixed, pixels to offset from top of viewport
   */
  viewportOffsetTop: _propTypes2.default.number,

  /**
   * Pixels to offset from bottom of screen when calculating position
   */
  offsetBottom: _propTypes2.default.number,

  /**
   * CSS class or classes to apply when at top
   */
  topClassName: _propTypes2.default.string,

  /**
   * Style to apply when at top
   */
  topStyle: _propTypes2.default.object,

  /**
   * CSS class or classes to apply when affixed
   */
  affixClassName: _propTypes2.default.string,
  /**
   * Style to apply when affixed
   */
  affixStyle: _propTypes2.default.object,

  /**
   * CSS class or classes to apply when at bottom
   */
  bottomClassName: _propTypes2.default.string,

  /**
   * Style to apply when at bottom
   */
  bottomStyle: _propTypes2.default.object,

  /**
   * Callback fired when the right before the `affixStyle` and `affixStyle` props are rendered
   */
  onAffix: _propTypes2.default.func,
  /**
   * Callback fired after the component `affixStyle` and `affixClassName` props have been rendered.
   */
  onAffixed: _propTypes2.default.func,

  /**
   * Callback fired when the right before the `topStyle` and `topClassName` props are rendered
   */
  onAffixTop: _propTypes2.default.func,

  /**
   * Callback fired after the component `topStyle` and `topClassName` props have been rendered.
   */
  onAffixedTop: _propTypes2.default.func,

  /**
   * Callback fired when the right before the `bottomStyle` and `bottomClassName` props are rendered
   */
  onAffixBottom: _propTypes2.default.func,

  /**
   * Callback fired after the component `bottomStyle` and `bottomClassName` props have been rendered.
   */
  onAffixedBottom: _propTypes2.default.func
};

Affix.defaultProps = {
  offsetTop: 0,
  viewportOffsetTop: null,
  offsetBottom: 0
};

exports.default = Affix;
module.exports = exports['default'];