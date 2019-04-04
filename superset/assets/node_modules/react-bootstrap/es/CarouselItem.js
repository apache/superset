import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import TransitionEvents from './utils/TransitionEvents';

// TODO: This should use a timeout instead of TransitionEvents, or else just
// not wait until transition end to trigger continuing animations.

var propTypes = {
  direction: PropTypes.oneOf(['prev', 'next']),
  onAnimateOutEnd: PropTypes.func,
  active: PropTypes.bool,
  animateIn: PropTypes.bool,
  animateOut: PropTypes.bool,
  index: PropTypes.number
};

var defaultProps = {
  active: false,
  animateIn: false,
  animateOut: false
};

var CarouselItem = function (_React$Component) {
  _inherits(CarouselItem, _React$Component);

  function CarouselItem(props, context) {
    _classCallCheck(this, CarouselItem);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

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
      TransitionEvents.addEndEventListener(ReactDOM.findDOMNode(this), this.handleAnimateOutEnd);
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
        props = _objectWithoutProperties(_props, ['direction', 'active', 'animateIn', 'animateOut', 'className']);

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

    return React.createElement('div', _extends({}, props, {
      className: classNames(className, classes)
    }));
  };

  return CarouselItem;
}(React.Component);

CarouselItem.propTypes = propTypes;
CarouselItem.defaultProps = defaultProps;

export default CarouselItem;