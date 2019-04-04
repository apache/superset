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

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _TransitionEvents = require('./utils/TransitionEvents');

var _TransitionEvents2 = _interopRequireDefault(_TransitionEvents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: This should use a timeout instead of TransitionEvents, or else just
// not wait until transition end to trigger continuing animations.

var propTypes = {
  direction: _propTypes2.default.oneOf(['prev', 'next']),
  onAnimateOutEnd: _propTypes2.default.func,
  active: _propTypes2.default.bool,
  animateIn: _propTypes2.default.bool,
  animateOut: _propTypes2.default.bool,
  index: _propTypes2.default.number
};

var defaultProps = {
  active: false,
  animateIn: false,
  animateOut: false
};

var CarouselItem = function (_React$Component) {
  (0, _inherits3.default)(CarouselItem, _React$Component);

  function CarouselItem(props, context) {
    (0, _classCallCheck3.default)(this, CarouselItem);

    var _this = (0, _possibleConstructorReturn3.default)(this, _React$Component.call(this, props, context));

    _this.handleAnimateOutEnd = _this.handleAnimateOutEnd.bind(_this);

    _this.state = {
      direction: null
    };

    _this.isUnmounted = false;
    return _this;
  }

  CarouselItem.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    if (this.props.active !== nextProps.active) {
      this.setState({ direction: null });
    }
  };

  CarouselItem.prototype.componentDidUpdate = function componentDidUpdate(prevProps) {
    var _this2 = this;

    var active = this.props.active;

    var prevActive = prevProps.active;

    if (!active && prevActive) {
      _TransitionEvents2.default.addEndEventListener(_reactDom2.default.findDOMNode(this), this.handleAnimateOutEnd);
    }

    if (active !== prevActive) {
      setTimeout(function () {
        return _this2.startAnimation();
      }, 20);
    }
  };

  CarouselItem.prototype.componentWillUnmount = function componentWillUnmount() {
    this.isUnmounted = true;
  };

  CarouselItem.prototype.handleAnimateOutEnd = function handleAnimateOutEnd() {
    if (this.isUnmounted) {
      return;
    }

    if (this.props.onAnimateOutEnd) {
      this.props.onAnimateOutEnd(this.props.index);
    }
  };

  CarouselItem.prototype.startAnimation = function startAnimation() {
    if (this.isUnmounted) {
      return;
    }

    this.setState({
      direction: this.props.direction === 'prev' ? 'right' : 'left'
    });
  };

  CarouselItem.prototype.render = function render() {
    var _props = this.props,
        direction = _props.direction,
        active = _props.active,
        animateIn = _props.animateIn,
        animateOut = _props.animateOut,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['direction', 'active', 'animateIn', 'animateOut', 'className']);


    delete props.onAnimateOutEnd;
    delete props.index;

    var classes = {
      item: true,
      active: active && !animateIn || animateOut
    };
    if (direction && active && animateIn) {
      classes[direction] = true;
    }
    if (this.state.direction && (animateIn || animateOut)) {
      classes[this.state.direction] = true;
    }

    return _react2.default.createElement('div', (0, _extends3.default)({}, props, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return CarouselItem;
}(_react2.default.Component);

CarouselItem.propTypes = propTypes;
CarouselItem.defaultProps = defaultProps;

exports.default = CarouselItem;
module.exports = exports['default'];