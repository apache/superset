/*! is-windows v0.1.0 | MIT LICENSE (c) 2015 | https://github.com/jonschlinkert/is-windows */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else if (typeof exports === 'object') {
    // Node.js
    module.exports = factory;
  } else {
    // Browser
    root.isWindows = factory();
  }
}(this, function () {
  'use strict';

  return (function isWindows() {
    if (typeof process === 'undefined' || !process) {
      return false;
    }
    return process.platform === 'win32';
  }());
}));
