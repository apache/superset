// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/* eslint-disable no-console */
import {VERSION, isBrowser} from '../utils/globals';
import LocalStorage from '../utils/local-storage';
import {formatImage, formatTime, leftPad} from '../utils/formatters';
import {addColor} from '../utils/color';
import {autobind} from '../utils/autobind';
import assert from '../utils/assert';
import getHiResTimestamp from '../utils/hi-res-timestamp';

/* eslint-disable no-console */

// Instrumentation in other packages may override console methods, so preserve them here
const originalConsole = {
  debug: isBrowser ? console.debug || console.log : console.log,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

const DEFAULT_SETTINGS = {
  enabled: true,
  level: 0
};

function noop() {}

const cache = {};
const ONCE = {once: true};

/*
function throttle(tag, timeout) {
  const prevTime = cache[tag];
  const time = Date.now();
  if (!prevTime || (time - prevTime > timeout)) {
    cache[tag] = time;
    return true;
  }
  return false;
}

// Assertions don't generate standard exceptions and don't print nicely
function checkForAssertionErrors(args) {
  const isAssertion =
    args &&
    args.length > 0 &&
    typeof args[0] === 'object' &&
    args[0] !== null &&
    args[0].name === 'AssertionError';

  if (isAssertion) {
    args = Array.prototype.slice.call(args);
    args.unshift(`assert(${args[0].message})`);
  }
  return args;
}
*/

function getTableHeader(table) {
  for (const key in table) {
    for (const title in table[key]) {
      return title || 'untitled';
    }
  }
  return 'empty';
}

// A console wrapper

export default class Log {
  constructor({id} = {}) {
    this.id = id;
    this.VERSION = VERSION;
    this._startTs = getHiResTimestamp();
    this._deltaTs = getHiResTimestamp();
    // TODO - fix support from throttling groups
    this.LOG_THROTTLE_TIMEOUT = 0; // Time before throttled messages are logged again
    this._storage = new LocalStorage(`__probe-${this.id}__`, DEFAULT_SETTINGS);
    this.userData = {};

    this.timeStamp(`${this.id} started`);

    autobind(this);
    Object.seal(this);
  }

  set level(newLevel) {
    this.setLevel(newLevel);
  }

  get level() {
    return this.getLevel();
  }

  isEnabled() {
    return this._storage.config.enabled;
  }

  getLevel() {
    return this._storage.config.level;
  }

  // @return {Number} milliseconds, with fractions
  getTotal() {
    return Number((getHiResTimestamp() - this._startTs).toPrecision(10));
  }

  // @return {Number} milliseconds, with fractions
  getDelta() {
    return Number((getHiResTimestamp() - this._deltaTs).toPrecision(10));
  }

  // Deprecated
  set priority(newPriority) {
    this.level = newPriority;
  }

  get priority() {
    return this.level;
  }

  getPriority() {
    return this.level;
  }

  // Configure

  enable(enabled = true) {
    this._storage.updateConfiguration({enabled});
    return this;
  }

  setLevel(level) {
    this._storage.updateConfiguration({level});
    return this;
  }

  // Unconditional logging

  assert(condition, message) {
    assert(condition, message);
  }

  // Warn, but only once, no console flooding
  warn(message) {
    return this._getLogFunction(0, message, originalConsole.warn, arguments, ONCE);
  }

  // Print an error
  error(message) {
    return this._getLogFunction(0, message, originalConsole.error, arguments);
  }

  deprecated(oldUsage, newUsage) {
    return this.warn(`\`${oldUsage}\` is deprecated and will be removed \
in a later version. Use \`${newUsage}\` instead`);
  }

  removed(oldUsage, newUsage) {
    return this.error(`\`${oldUsage}\` has been removed. Use \`${newUsage}\` instead`);
  }

  // Conditional logging

  // Log to a group
  probe(logLevel, message) {
    return this._getLogFunction(logLevel, message, originalConsole.log, arguments, {
      time: true,
      once: true
    });
  }

  // Log a debug message
  log(logLevel, message) {
    return this._getLogFunction(logLevel, message, originalConsole.debug, arguments);
  }

  // Log a normal message
  info(logLevel, message) {
    return this._getLogFunction(logLevel, message, console.info, arguments);
  }

  // Log a normal message, but only once, no console flooding
  once(logLevel, message) {
    return this._getLogFunction(
      logLevel,
      message,
      originalConsole.debug || originalConsole.info,
      arguments,
      ONCE
    );
  }

  // Logs an object as a table
  table(logLevel, table, columns) {
    if (table) {
      return this._getLogFunction(logLevel, table, console.table || noop, columns && [columns], {
        tag: getTableHeader(table)
      });
    }
    return noop;
  }

  // logs an image under Chrome
  image({logLevel, priority, image, message = '', scale = 1}) {
    if (!this._shouldLog(logLevel || priority)) {
      return noop;
    }
    return isBrowser
      ? logImageInBrowser({image, message, scale})
      : logImageInNode({image, message, scale});
  }

  // Logs the current settings as a table
  settings() {
    if (console.table) {
      console.table(this._storage.config);
    } else {
      console.log(this._storage.config);
    }
  }

  // logs the current status of the setting
  get(setting) {
    return this._storage.config[setting];
  }

  // update the status of the setting
  set(setting, value) {
    this._storage.updateConfiguration({[setting]: value});
  }

  time(logLevel, message) {
    return this._getLogFunction(logLevel, message, console.time ? console.time : console.info);
  }

  timeEnd(logLevel, message) {
    return this._getLogFunction(
      logLevel,
      message,
      console.timeEnd ? console.timeEnd : console.info
    );
  }

  timeStamp(logLevel, message) {
    return this._getLogFunction(logLevel, message, console.timeStamp || noop);
  }

  group(logLevel, message, opts = {collapsed: false}) {
    opts = normalizeArguments({logLevel, message, opts});
    const {collapsed} = opts;
    opts.method = (collapsed ? console.groupCollapsed : console.group) || console.info;

    return this._getLogFunction(opts);
  }

  groupCollapsed(logLevel, message, opts = {}) {
    return this.group(logLevel, message, Object.assign({}, opts, {collapsed: true}));
  }

  groupEnd(logLevel) {
    return this._getLogFunction(logLevel, '', console.groupEnd || noop);
  }

  // EXPERIMENTAL

  withGroup(logLevel, message, func) {
    this.group(logLevel, message)();

    try {
      func();
    } finally {
      this.groupEnd(logLevel)();
    }
  }

  trace() {
    if (console.trace) {
      console.trace();
    }
  }

  // PRIVATE METHODS

  _shouldLog(logLevel) {
    return this.isEnabled() && this.getLevel() >= normalizeLogLevel(logLevel);
  }

  _getLogFunction(logLevel, message, method, args = [], opts) {
    if (this._shouldLog(logLevel)) {
      // normalized opts + timings
      opts = normalizeArguments({logLevel, message, args, opts});
      method = method || opts.method;
      assert(method);

      opts.total = this.getTotal();
      opts.delta = this.getDelta();
      // reset delta timer
      this._deltaTs = getHiResTimestamp();

      const tag = opts.tag || opts.message;

      if (opts.once) {
        if (!cache[tag]) {
          cache[tag] = getHiResTimestamp();
        } else {
          return noop;
        }
      }

      // TODO - Make throttling work with groups
      // if (opts.nothrottle || !throttle(tag, this.LOG_THROTTLE_TIMEOUT)) {
      //   return noop;
      // }

      message = decorateMessage(this.id, opts.message, opts);

      // Bind console function so that it can be called after being returned
      return method.bind(console, message, ...opts.args);
    }
    return noop;
  }
}

Log.VERSION = VERSION;

// Get logLevel from first argument:
// - log(logLevel, message, args) => logLevel
// - log(message, args) => 0
// - log({logLevel, ...}, message, args) => logLevel
// - log({logLevel, message, args}) => logLevel
function normalizeLogLevel(logLevel) {
  if (!logLevel) {
    return 0;
  }
  let resolvedLevel;

  switch (typeof logLevel) {
    case 'number':
      resolvedLevel = logLevel;
      break;

    case 'object':
      // Backward compatibility
      // TODO - deprecate `priority`
      resolvedLevel = logLevel.logLevel || logLevel.priority || 0;
      break;

    default:
      return 0;
  }
  // 'log level must be a number'
  assert(Number.isFinite(resolvedLevel) && resolvedLevel >= 0);

  return resolvedLevel;
}

// "Normalizes" the various argument patterns into an object with known types
// - log(logLevel, message, args) => {logLevel, message, args}
// - log(message, args) => {logLevel: 0, message, args}
// - log({logLevel, ...}, message, args) => {logLevel, message, args}
// - log({logLevel, message, args}) => {logLevel, message, args}
export function normalizeArguments(opts) {
  const {logLevel, message} = opts;
  opts.logLevel = normalizeLogLevel(logLevel);
  // We use `arguments` instead of rest parameters (...args) because IE
  // does not support the syntax. Rest parameters is transpiled to code with
  // perf impact. Doing it here instead avoids constructing args when logging is
  // disabled.
  // TODO - remove when/if IE support is dropped
  const args = opts.args ? Array.from(opts.args) : [];
  /* eslint-disable no-empty */
  // args should only contain arguments that appear after `message`
  while (args.length && args.shift() !== message) {}
  /* eslint-enable no-empty */
  opts.args = args;

  switch (typeof logLevel) {
    case 'string':
    case 'function':
      if (message !== undefined) {
        args.unshift(message);
      }
      opts.message = logLevel;
      break;

    case 'object':
      Object.assign(opts, logLevel);
      break;

    default:
  }

  // Resolve functions into strings by calling them
  if (typeof opts.message === 'function') {
    opts.message = opts.message();
  }
  const messageType = typeof opts.message;
  // 'log message must be a string' or object
  assert(messageType === 'string' || messageType === 'object');

  // original opts + normalized opts + opts arg + fixed up message
  return Object.assign(opts, opts.opts);
}

function decorateMessage(id, message, opts) {
  if (typeof message === 'string') {
    const time = opts.time ? leftPad(formatTime(opts.total)) : '';
    message = opts.time ? `${id}: ${time}  ${message}` : `${id}: ${message}`;
    message = addColor(message, opts.color, opts.background);
  }
  return message;
}

// Use the asciify module to log an image under node.js
function logImageInNode({image, message = '', scale = 1}) {
  // Note: Runtime load of the "asciify-image" module, avoids including in browser bundles
  let asciify = null;
  try {
    asciify = module.require('asciify-image');
  } catch (error) {
    // asciify not installed, silently ignore
  }
  if (asciify) {
    return () =>
      asciify(image, {fit: 'box', width: `${Math.round(80 * scale)}%`}).then(data =>
        console.log(data)
      );
  }
  return noop;
}

function logImageInBrowser({image, message = '', scale = 1}) {
  if (typeof image === 'string') {
    const img = new Image();
    img.onload = () => {
      const args = formatImage(img, message, scale);
      console.log(...args);
    };
    img.src = image;
    return noop;
  }
  const element = image.nodeName || '';
  if (element.toLowerCase() === 'img') {
    console.log(...formatImage(image, message, scale));
    return noop;
  }
  if (element.toLowerCase() === 'canvas') {
    const img = new Image();
    img.onload = () => console.log(...formatImage(img, message, scale));
    img.src = image.toDataURL();
    return noop;
  }
  return noop;
}
