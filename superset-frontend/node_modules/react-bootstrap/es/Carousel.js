import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';
import CarouselCaption from './CarouselCaption';
import CarouselItem from './CarouselItem';
import Glyphicon from './Glyphicon';
import SafeAnchor from './SafeAnchor';
import { bsClass, getClassSet, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import ValidComponentChildren from './utils/ValidComponentChildren'; // TODO: `slide` should be `animate`.
// TODO: Use uncontrollable.

var propTypes = {
  slide: PropTypes.bool,
  indicators: PropTypes.bool,

  /**
   * The amount of time to delay between automatically cycling an item.
   * If `null`, carousel will not automatically cycle.
   */
  interval: PropTypes.number,
  controls: PropTypes.bool,
  pauseOnHover: PropTypes.bool,
  wrap: PropTypes.bool,

  /**
   * Callback fired when the active item changes.
   *
   * ```js
   * (eventKey: any, ?event: Object) => any
   * ```
   *
   * If this callback takes two or more arguments, the second argument will
   * be a persisted event object with `direction` set to the direction of the
   * transition.
   */
  onSelect: PropTypes.func,
  onSlideEnd: PropTypes.func,
  activeIndex: PropTypes.number,
  defaultActiveIndex: PropTypes.number,
  direction: PropTypes.oneOf(['prev', 'next']),
  prevIcon: PropTypes.node,

  /**
   * Label shown to screen readers only, can be used to show the previous element
   * in the carousel.
   * Set to null to deactivate.
   */
  prevLabel: PropTypes.string,
  nextIcon: PropTypes.node,

  /**
   * Label shown to screen readers only, can be used to show the next element
   * in the carousel.
   * Set to null to deactivate.
   */
  nextLabel: PropTypes.string
};
var defaultProps = {
  slide: true,
  interval: 5000,
  pauseOnHover: true,
  wrap: true,
  indicators: true,
  controls: true,
  prevIcon: React.createElement(Glyphicon, {
    glyph: "chevron-left"
  }),
  prevLabel: 'Previous',
  nextIcon: React.createElement(Glyphicon, {
    glyph: "chevron-right"
  }),
  nextLabel: 'Next'
};

var Carousel =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Carousel, _React$Component);

  function Carousel(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleMouseOver = _this.handleMouseOver.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleMouseOut = _this.handleMouseOut.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handlePrev = _this.handlePrev.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleNext = _this.handleNext.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleItemAnimateOutEnd = _this.handleItemAnimateOutEnd.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    var defaultActiveIndex = props.defaultActiveIndex;
    _this.state = {
      activeIndex: defaultActiveIndex != null ? defaultActiveIndex : 0,
      previousActiveIndex: null,
      direction: null
    };
    _this.isUnmounted = false;
    return _this;
  }

  var _proto = Carousel.prototype;

  _proto.componentDidMount = function componentDidMount() {
    this.waitForNext();
  };

  _proto.UNSAFE_componentWillReceiveProps = function UNSAFE_componentWillReceiveProps(nextProps) {
    // eslint-disable-line
    var activeIndex = this.getActiveIndex();

    if (nextProps.activeIndex != null && nextProps.activeIndex !== activeIndex) {
      clearTimeout(this.timeout);
      this.setState({
        previousActiveIndex: activeIndex,
        direction: nextProps.direction != null ? nextProps.direction : this.getDirection(activeIndex, nextProps.activeIndex)
      });
    }

    if (nextProps.activeIndex == null && this.state.activeIndex >= nextProps.children.length) {
      this.setState({
        activeIndex: 0,
        previousActiveIndex: null,
        direction: null
      });
    }
  };

  _proto.componentWillUnmount = function componentWillUnmount() {
    clearTimeout(this.timeout);
    this.isUnmounted = true;
  };

  _proto.getActiveIndex = function getActiveIndex() {
    var activeIndexProp = this.props.activeIndex;
    return activeIndexProp != null ? activeIndexProp : this.state.activeIndex;
  };

  _proto.getDirection = function getDirection(prevIndex, index) {
    if (prevIndex === index) {
      return null;
    }

    return prevIndex > index ? 'prev' : 'next';
  };

  _proto.handleItemAnimateOutEnd = function handleItemAnimateOutEnd() {
    var _this2 = this;

    this.setState({
      previousActiveIndex: null,
      direction: null
    }, function () {
      _this2.waitForNext();

      if (_this2.props.onSlideEnd) {
        _this2.props.onSlideEnd();
      }
    });
  };

  _proto.handleMouseOut = function handleMouseOut() {
    if (this.isPaused) {
      this.play();
    }
  };

  _proto.handleMouseOver = function handleMouseOver() {
    if (this.props.pauseOnHover) {
      this.pause();
    }
  };

  _proto.handleNext = function handleNext(e) {
    var index = this.getActiveIndex() + 1;
    var count = ValidComponentChildren.count(this.props.children);

    if (index > count - 1) {
      if (!this.props.wrap) {
        return;
      }

      index = 0;
    }

    this.select(index, e, 'next');
  };

  _proto.handlePrev = function handlePrev(e) {
    var index = this.getActiveIndex() - 1;

    if (index < 0) {
      if (!this.props.wrap) {
        return;
      }

      index = ValidComponentChildren.count(this.props.children) - 1;
    }

    this.select(index, e, 'prev');
  }; // This might be a public API.


  _proto.pause = function pause() {
    this.isPaused = true;
    clearTimeout(this.timeout);
  }; // This might be a public API.


  _proto.play = function play() {
    this.isPaused = false;
    this.waitForNext();
  };

  _proto.select = function select(index, e, direction) {
    clearTimeout(this.timeout); // TODO: Is this necessary? Seems like the only risk is if the component
    // unmounts while handleItemAnimateOutEnd fires.

    if (this.isUnmounted) {
      return;
    }

    var previousActiveIndex = this.props.slide ? this.getActiveIndex() : null;
    direction = direction || this.getDirection(previousActiveIndex, index);
    var onSelect = this.props.onSelect;

    if (onSelect) {
      if (onSelect.length > 1) {
        // React SyntheticEvents are pooled, so we need to remove this event
        // from the pool to add a custom property. To avoid unnecessarily
        // removing objects from the pool, only do this when the listener
        // actually wants the event.
        if (e) {
          e.persist();
          e.direction = direction;
        } else {
          e = {
            direction: direction
          };
        }

        onSelect(index, e);
      } else {
        onSelect(index);
      }
    }

    if (this.props.activeIndex == null && index !== previousActiveIndex) {
      if (this.state.previousActiveIndex != null) {
        // If currently animating don't activate the new index.
        // TODO: look into queueing this canceled call and
        // animating after the current animation has ended.
        return;
      }

      this.setState({
        activeIndex: index,
        previousActiveIndex: previousActiveIndex,
        direction: direction
      });
    }
  };

  _proto.waitForNext = function waitForNext() {
    var _this$props = this.props,
        slide = _this$props.slide,
        interval = _this$props.interval,
        activeIndexProp = _this$props.activeIndex;

    if (!this.isPaused && slide && interval && activeIndexProp == null) {
      this.timeout = setTimeout(this.handleNext, interval);
    }
  };

  _proto.renderControls = function renderControls(properties) {
    var wrap = properties.wrap,
        children = properties.children,
        activeIndex = properties.activeIndex,
        prevIcon = properties.prevIcon,
        nextIcon = properties.nextIcon,
        bsProps = properties.bsProps,
        prevLabel = properties.prevLabel,
        nextLabel = properties.nextLabel;
    var controlClassName = prefix(bsProps, 'control');
    var count = ValidComponentChildren.count(children);
    return [(wrap || activeIndex !== 0) && React.createElement(SafeAnchor, {
      key: "prev",
      className: classNames(controlClassName, 'left'),
      onClick: this.handlePrev
    }, prevIcon, prevLabel && React.createElement("span", {
      className: "sr-only"
    }, prevLabel)), (wrap || activeIndex !== count - 1) && React.createElement(SafeAnchor, {
      key: "next",
      className: classNames(controlClassName, 'right'),
      onClick: this.handleNext
    }, nextIcon, nextLabel && React.createElement("span", {
      className: "sr-only"
    }, nextLabel))];
  };

  _proto.renderIndicators = function renderIndicators(children, activeIndex, bsProps) {
    var _this3 = this;

    var indicators = [];
    ValidComponentChildren.forEach(children, function (child, index) {
      indicators.push(React.createElement("li", {
        key: index,
        className: index === activeIndex ? 'active' : null,
        onClick: function onClick(e) {
          return _this3.select(index, e);
        }
      }), // Force whitespace between indicator elements. Bootstrap requires
      // this for correct spacing of elements.
      ' ');
    });
    return React.createElement("ol", {
      className: prefix(bsProps, 'indicators')
    }, indicators);
  };

  _proto.render = function render() {
    var _this4 = this;

    var _this$props2 = this.props,
        slide = _this$props2.slide,
        indicators = _this$props2.indicators,
        controls = _this$props2.controls,
        wrap = _this$props2.wrap,
        prevIcon = _this$props2.prevIcon,
        prevLabel = _this$props2.prevLabel,
        nextIcon = _this$props2.nextIcon,
        nextLabel = _this$props2.nextLabel,
        className = _this$props2.className,
        children = _this$props2.children,
        props = _objectWithoutPropertiesLoose(_this$props2, ["slide", "indicators", "controls", "wrap", "prevIcon", "prevLabel", "nextIcon", "nextLabel", "className", "children"]);

    var _this$state = this.state,
        previousActiveIndex = _this$state.previousActiveIndex,
        direction = _this$state.direction;

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['interval', 'pauseOnHover', 'onSelect', 'onSlideEnd', 'activeIndex', // Accessed via this.getActiveIndex().
    'defaultActiveIndex', 'direction']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var activeIndex = this.getActiveIndex();

    var classes = _extends({}, getClassSet(bsProps), {
      slide: slide
    });

    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes),
      onMouseOver: this.handleMouseOver,
      onMouseOut: this.handleMouseOut
    }), indicators && this.renderIndicators(children, activeIndex, bsProps), React.createElement("div", {
      className: prefix(bsProps, 'inner')
    }, ValidComponentChildren.map(children, function (child, index) {
      var active = index === activeIndex;
      var previousActive = slide && index === previousActiveIndex;
      return cloneElement(child, {
        active: active,
        index: index,
        animateOut: previousActive,
        animateIn: active && previousActiveIndex != null && slide,
        direction: direction,
        onAnimateOutEnd: previousActive ? _this4.handleItemAnimateOutEnd : null
      });
    })), controls && this.renderControls({
      wrap: wrap,
      children: children,
      activeIndex: activeIndex,
      prevIcon: prevIcon,
      prevLabel: prevLabel,
      nextIcon: nextIcon,
      nextLabel: nextLabel,
      bsProps: bsProps
    }));
  };

  return Carousel;
}(React.Component);

Carousel.propTypes = propTypes;
Carousel.defaultProps = defaultProps;
Carousel.Caption = CarouselCaption;
Carousel.Item = CarouselItem;
export default bsClass('carousel', Carousel);