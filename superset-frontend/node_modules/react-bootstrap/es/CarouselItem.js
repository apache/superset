import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import transition from 'dom-helpers/transition';
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

var CarouselItem =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(CarouselItem, _React$Component);

  function CarouselItem(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleAnimateOutEnd = _this.handleAnimateOutEnd.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.state = {
      direction: null
    };
    _this.isUnmounted = false;
    return _this;
  }

  var _proto = CarouselItem.prototype;

  _proto.UNSAFE_componentWillReceiveProps = function UNSAFE_componentWillReceiveProps(nextProps) {
    // eslint-disable-line
    if (this.props.active !== nextProps.active) {
      this.setState({
        direction: null
      });
    }
  };

  _proto.componentDidUpdate = function componentDidUpdate(prevProps) {
    var _this2 = this;

    var active = this.props.active;
    var prevActive = prevProps.active;

    if (!active && prevActive) {
      transition.end(ReactDOM.findDOMNode(this), this.handleAnimateOutEnd);
    }

    if (active !== prevActive) {
      setTimeout(function () {
        return _this2.startAnimation();
      }, 20);
    }
  };

  _proto.componentWillUnmount = function componentWillUnmount() {
    this.isUnmounted = true;
  };

  _proto.handleAnimateOutEnd = function handleAnimateOutEnd() {
    if (this.isUnmounted) {
      return;
    }

    if (this.props.onAnimateOutEnd) {
      this.props.onAnimateOutEnd(this.props.index);
    }
  };

  _proto.startAnimation = function startAnimation() {
    if (this.isUnmounted) {
      return;
    }

    this.setState({
      direction: this.props.direction === 'prev' ? 'right' : 'left'
    });
  };

  _proto.render = function render() {
    var _this$props = this.props,
        direction = _this$props.direction,
        active = _this$props.active,
        animateIn = _this$props.animateIn,
        animateOut = _this$props.animateOut,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["direction", "active", "animateIn", "animateOut", "className"]);

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

    return React.createElement("div", _extends({}, props, {
      className: classNames(className, classes)
    }));
  };

  return CarouselItem;
}(React.Component);

CarouselItem.propTypes = propTypes;
CarouselItem.defaultProps = defaultProps;
export default CarouselItem;