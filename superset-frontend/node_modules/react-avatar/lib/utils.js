'use strict';

require("core-js/modules/es.symbol");

require("core-js/modules/es.symbol.description");

require("core-js/modules/es.symbol.iterator");

require("core-js/modules/es.array.filter");

require("core-js/modules/es.array.for-each");

require("core-js/modules/es.array.from");

require("core-js/modules/es.array.index-of");

require("core-js/modules/es.array.iterator");

require("core-js/modules/es.array.join");

require("core-js/modules/es.array.map");

require("core-js/modules/es.array.reduce");

require("core-js/modules/es.array.slice");

require("core-js/modules/es.function.name");

require("core-js/modules/es.object.to-string");

require("core-js/modules/es.regexp.exec");

require("core-js/modules/es.regexp.to-string");

require("core-js/modules/es.string.iterator");

require("core-js/modules/es.string.split");

require("core-js/modules/web.dom-collections.for-each");

require("core-js/modules/web.dom-collections.iterator");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fetch = fetch;
exports.fetchJSONP = fetchJSONP;
exports.getRandomColor = getRandomColor;
exports.parseSize = parseSize;
exports.getImageSize = getImageSize;
exports.defaultInitials = defaultInitials;
exports.setGroupedTimeout = setGroupedTimeout;
exports.defaultColors = void 0;

var _isRetina = _interopRequireDefault(require("is-retina"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var IS_RETINA = (0, _isRetina.default)();

function fetch(url, successCb, errorCb) {
  var request = new XMLHttpRequest();

  request.onreadystatechange = function () {
    if (request.readyState === 4) {
      if (request.status === 200) {
        var data = JSON.parse(request.responseText);
        successCb(data);
      } else {
        errorCb(request.status);
      }
    }
  };

  request.open('GET', url, true);
  request.send();
}

function fetchJSONP(url, successCb, errorCb) {
  var callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
  var script = document.createElement('script');
  script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
  document.body.appendChild(script);

  script.onerror = function () {
    errorCb();
  };

  window[callbackName] = function (data) {
    delete window[callbackName];
    document.body.removeChild(script);
    successCb(data);
  };
}

var defaultColors = ['#d73d32', '#7e3794', '#4285f4', '#67ae3f', '#d61a7f', '#ff4080']; // https://regex101.com/r/YEsPER/1
// https://developer.mozilla.org/en-US/docs/Web/CSS/length

exports.defaultColors = defaultColors;
var reSize = /^([-+]?(?:\d+(?:\.\d+)?|\.\d+))([a-z]{2,4}|%)?$/; // https://en.wikipedia.org/wiki/Linear_congruential_generator

function _stringAsciiPRNG(value, m) {
  // Xn+1 = (a * Xn + c) % m
  // 0 < a < m
  // 0 <= c < m
  // 0 <= X0 < m
  var charCodes = _toConsumableArray(value).map(function (letter) {
    return letter.charCodeAt(0);
  });

  var len = charCodes.length;
  var a = len % (m - 1) + 1;
  var c = charCodes.reduce(function (current, next) {
    return current + next;
  }) % m;
  var random = charCodes[0] % m;

  for (var i = 0; i < len; i++) {
    random = (a * random + c) % m;
  }

  return random;
}

function getRandomColor(value) {
  var colors = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultColors;
  // if no value is passed, always return transparent color otherwise
  // a rerender would show a new color which would will
  // give strange effects when an interface is loading
  // and gets rerendered a few consequent times
  if (!value) return 'transparent'; // value based random color index
  // the reason we don't just use a random number is to make sure that
  // a certain value will always get the same color assigned given
  // a fixed set of colors

  var colorIndex = _stringAsciiPRNG(value, colors.length);

  return colors[colorIndex];
}

function parseSize(size) {
  size = '' + size;

  var _ref = reSize.exec(size) || [],
      _ref2 = _slicedToArray(_ref, 3),
      _ref2$ = _ref2[1],
      value = _ref2$ === void 0 ? 0 : _ref2$,
      _ref2$2 = _ref2[2],
      unit = _ref2$2 === void 0 ? 'px' : _ref2$2;

  return {
    value: parseFloat(value),
    str: value + unit,
    unit: unit
  };
}
/**
 * Calculate absolute size in pixels we want for the images
 * that get requested from the various sources. They don't
 * understand relative sizes like `em` or `vww`.  We select
 * a fixed size of 512px when we can't detect the true pixel size.
 */


function getImageSize(size) {
  size = parseSize(size);
  if (isNaN(size.value)) // invalid size, use fallback
    size = 512;else if (size.unit === 'px') // px are good, use them
    size = size.value;else if (size.value === 0) // relative 0 === absolute 0
    size = 0;else // anything else is unknown, use fallback
    size = 512;
  if (IS_RETINA) size = size * 2;
  return size;
}

function defaultInitials(name, _ref3) {
  var maxInitials = _ref3.maxInitials;
  return name.split(/\s/).map(function (part) {
    return part.substring(0, 1).toUpperCase();
  }).filter(function (v) {
    return !!v;
  }).slice(0, maxInitials).join('').toUpperCase();
}
/**
 * Grouped timeouts reduce the amount of timeouts trigged
 * by grouping multiple handlers into a single setTimeout call.
 *
 * This reduces accuracy of the timeout but will be less expensive
 * when multiple avatar have been loaded into view.
 */


var timeoutGroups = {};

function setGroupedTimeout(fn, ttl) {
  if (timeoutGroups[ttl]) {
    timeoutGroups[ttl].push(fn);
    return;
  }

  var callbacks = timeoutGroups[ttl] = [fn];
  setTimeout(function () {
    delete timeoutGroups[ttl];
    callbacks.forEach(function (cb) {
      return cb();
    });
  }, ttl);
}