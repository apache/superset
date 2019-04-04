'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var __DEBUG__ = void 0;
var displayBuffer = void 0;

var colors = {
  prevState: '#9E9E9E',
  action: '#03A9F4',
  nextState: '#4CAF50'

  /* istanbul ignore next: debug messaging is not tested */
};function initBuffer() {
  displayBuffer = {
    header: [],
    prev: [],
    action: [],
    next: [],
    msgs: []
  };
}

/* istanbul ignore next: debug messaging is not tested */
function printBuffer() {
  var _displayBuffer = displayBuffer,
      header = _displayBuffer.header,
      prev = _displayBuffer.prev,
      next = _displayBuffer.next,
      action = _displayBuffer.action,
      msgs = _displayBuffer.msgs;

  if (console.group) {
    var _console, _console2, _console3, _console4, _console5;

    (_console = console).groupCollapsed.apply(_console, _toConsumableArray(header));
    (_console2 = console).log.apply(_console2, _toConsumableArray(prev));
    (_console3 = console).log.apply(_console3, _toConsumableArray(action));
    (_console4 = console).log.apply(_console4, _toConsumableArray(next));
    (_console5 = console).log.apply(_console5, _toConsumableArray(msgs));
    console.groupEnd();
  } else {
    var _console6, _console7, _console8, _console9, _console10;

    (_console6 = console).log.apply(_console6, _toConsumableArray(header));
    (_console7 = console).log.apply(_console7, _toConsumableArray(prev));
    (_console8 = console).log.apply(_console8, _toConsumableArray(action));
    (_console9 = console).log.apply(_console9, _toConsumableArray(next));
    (_console10 = console).log.apply(_console10, _toConsumableArray(msgs));
  }
}

/* istanbul ignore next: debug messaging is not tested */
function colorFormat(text, color, obj) {
  return ['%c' + text, 'color: ' + color + '; font-weight: bold', obj];
}

/* istanbul ignore next: debug messaging is not tested */
function start(action, state) {
  initBuffer();
  if (__DEBUG__) {
    if (console.group) {
      displayBuffer.header = ['%credux-undo', 'font-style: italic', 'action', action.type];
      displayBuffer.action = colorFormat('action', colors.action, action);
      displayBuffer.prev = colorFormat('prev history', colors.prevState, state);
    } else {
      displayBuffer.header = ['redux-undo action', action.type];
      displayBuffer.action = ['action', action];
      displayBuffer.prev = ['prev history', state];
    }
  }
}

/* istanbul ignore next: debug messaging is not tested */
function end(nextState) {
  if (__DEBUG__) {
    if (console.group) {
      displayBuffer.next = colorFormat('next history', colors.nextState, nextState);
    } else {
      displayBuffer.next = ['next history', nextState];
    }
    printBuffer();
  }
}

/* istanbul ignore next: debug messaging is not tested */
function log() {
  if (__DEBUG__) {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    displayBuffer.msgs = displayBuffer.msgs.concat([].concat(args, ['\n']));
  }
}

/* istanbul ignore next: debug messaging is not tested */
function set(debug) {
  __DEBUG__ = debug;
}

exports.set = set;
exports.start = start;
exports.end = end;
exports.log = log;