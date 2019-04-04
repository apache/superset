import _Object$keys from 'babel-runtime/core-js/object/keys';
import invariant from 'invariant';

export function arrayMove(arr, previousIndex, newIndex) {
  var array = arr.slice(0);
  if (newIndex >= array.length) {
    var k = newIndex - array.length;
    while (k-- + 1) {
      array.push(undefined);
    }
  }
  array.splice(newIndex, 0, array.splice(previousIndex, 1)[0]);
  return array;
}

export function omit(obj) {
  for (var _len = arguments.length, keysToOmit = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    keysToOmit[_key - 1] = arguments[_key];
  }

  return _Object$keys(obj).reduce(function (acc, key) {
    if (keysToOmit.indexOf(key) === -1) acc[key] = obj[key];
    return acc;
  }, {});
}

export var events = {
  start: ['touchstart', 'mousedown'],
  move: ['touchmove', 'mousemove'],
  end: ['touchend', 'touchcancel', 'mouseup']
};

export var vendorPrefix = function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''; // server environment
  // fix for:
  //    https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  //    window.getComputedStyle() returns null inside an iframe with display: none
  // in this case return an array with a fake mozilla style in it.
  var styles = window.getComputedStyle(document.documentElement, '') || ['-moz-hidden-iframe'];
  var pre = (Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/) || styles.OLink === '' && ['', 'o'])[1];

  switch (pre) {
    case 'ms':
      return 'ms';
    default:
      return pre && pre.length ? pre[0].toUpperCase() + pre.substr(1) : '';
  }
}();

export function closest(el, fn) {
  while (el) {
    if (fn(el)) return el;
    el = el.parentNode;
  }
}

export function limit(min, max, value) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function getCSSPixelValue(stringValue) {
  if (stringValue.substr(-2) === 'px') {
    return parseFloat(stringValue);
  }
  return 0;
}

export function getElementMargin(element) {
  var style = window.getComputedStyle(element);

  return {
    top: getCSSPixelValue(style.marginTop),
    right: getCSSPixelValue(style.marginRight),
    bottom: getCSSPixelValue(style.marginBottom),
    left: getCSSPixelValue(style.marginLeft)
  };
}

export function provideDisplayName(prefix, Component) {
  var componentName = Component.displayName || Component.name;

  return componentName ? prefix + '(' + componentName + ')' : prefix;
}

export function getPosition(event) {
  if (event.touches && event.touches.length) {
    return {
      x: event.touches[0].pageX,
      y: event.touches[0].pageY
    };
  } else if (event.changedTouches && event.changedTouches.length) {
    return {
      x: event.changedTouches[0].pageX,
      y: event.changedTouches[0].pageY
    };
  } else {
    return {
      x: event.pageX,
      y: event.pageY
    };
  }
}

export function isTouchEvent(event) {
  return event.touches && event.touches.length || event.changedTouches && event.changedTouches.length;
}

export function getEdgeOffset(node, parent) {
  var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : { top: 0, left: 0 };

  // Get the actual offsetTop / offsetLeft value, no matter how deep the node is nested
  if (node) {
    var nodeOffset = {
      top: offset.top + node.offsetTop,
      left: offset.left + node.offsetLeft
    };

    if (node.parentNode !== parent) {
      return getEdgeOffset(node.parentNode, parent, nodeOffset);
    } else {
      return nodeOffset;
    }
  }
}

export function getLockPixelOffset(_ref) {
  var lockOffset = _ref.lockOffset,
      width = _ref.width,
      height = _ref.height;

  var offsetX = lockOffset;
  var offsetY = lockOffset;
  var unit = 'px';

  if (typeof lockOffset === 'string') {
    var match = /^[+-]?\d*(?:\.\d*)?(px|%)$/.exec(lockOffset);

    invariant(match !== null, 'lockOffset value should be a number or a string of a ' + 'number followed by "px" or "%". Given %s', lockOffset);

    offsetX = offsetY = parseFloat(lockOffset);
    unit = match[1];
  }

  invariant(isFinite(offsetX) && isFinite(offsetY), 'lockOffset value should be a finite. Given %s', lockOffset);

  if (unit === '%') {
    offsetX = offsetX * width / 100;
    offsetY = offsetY * height / 100;
  }

  return {
    x: offsetX,
    y: offsetY
  };
}