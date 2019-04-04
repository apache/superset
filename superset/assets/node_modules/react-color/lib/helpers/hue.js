'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var calculateChange = exports.calculateChange = function calculateChange(e, skip, props, container) {
  e.preventDefault();
  var containerWidth = container.clientWidth;
  var containerHeight = container.clientHeight;
  var x = typeof e.pageX === 'number' ? e.pageX : e.touches[0].pageX;
  var y = typeof e.pageY === 'number' ? e.pageY : e.touches[0].pageY;
  var left = x - (container.getBoundingClientRect().left + window.pageXOffset);
  var top = y - (container.getBoundingClientRect().top + window.pageYOffset);

  if (props.direction === 'vertical') {
    var h = void 0;
    if (top < 0) {
      h = 359;
    } else if (top > containerHeight) {
      h = 0;
    } else {
      var percent = -(top * 100 / containerHeight) + 100;
      h = 360 * percent / 100;
    }

    if (props.hsl.h !== h) {
      return {
        h: h,
        s: props.hsl.s,
        l: props.hsl.l,
        a: props.hsl.a,
        source: 'rgb'
      };
    }
  } else {
    var _h = void 0;
    if (left < 0) {
      _h = 0;
    } else if (left > containerWidth) {
      _h = 359;
    } else {
      var _percent = left * 100 / containerWidth;
      _h = 360 * _percent / 100;
    }

    if (props.hsl.h !== _h) {
      return {
        h: _h,
        s: props.hsl.s,
        l: props.hsl.l,
        a: props.hsl.a,
        source: 'rgb'
      };
    }
  }
  return null;
};