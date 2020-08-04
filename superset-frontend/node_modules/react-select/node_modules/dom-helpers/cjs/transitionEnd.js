"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.parseDuration = parseDuration;
exports.default = exports.TRANSITION_SUPPORTED = void 0;

var _canUseDOM = _interopRequireDefault(require("./canUseDOM"));

var _css = _interopRequireDefault(require("./css"));

var _listen = _interopRequireDefault(require("./listen"));

var TRANSITION_SUPPORTED = _canUseDOM.default && 'ontransitionend' in window;
exports.TRANSITION_SUPPORTED = TRANSITION_SUPPORTED;

function parseDuration(node) {
  var str = (0, _css.default)(node, 'transitionDuration') || '';
  var mult = str.indexOf('ms') === -1 ? 1000 : 1;
  return parseFloat(str) * mult;
}

function triggerTransitionEnd(element) {
  var evt = document.createEvent('HTMLEvents');
  evt.initEvent('transitionend', true, true);
  element.dispatchEvent(evt);
}

function emulateTransitionEnd(element, duration, padding) {
  if (padding === void 0) {
    padding = 5;
  }

  var called = false;
  var handle = setTimeout(function () {
    if (!called) triggerTransitionEnd(element);
  }, duration + padding);
  var remove = (0, _listen.default)(element, 'transitionend', function () {
    called = true;
  }, {
    once: true
  });
  return function () {
    clearTimeout(handle);
    remove();
  };
}

function transitionEnd(element, handler, duration) {
  if (duration == null) duration = parseDuration(element) || 0;
  var removeEmulate = emulateTransitionEnd(element, duration);
  var remove = (0, _listen.default)(element, 'transitionend', handler);
  return function () {
    removeEmulate();
    remove();
  };
}

var _default = transitionEnd;
exports.default = _default;