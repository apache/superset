'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var DEFAULT_MAX_ELEMENT_SIZE = 1500000;
var CHROME_MAX_ELEMENT_SIZE = 1.67771e7;

var isBrowser = function isBrowser() {
  return typeof window !== 'undefined';
};

var isChrome = function isChrome() {
  return !!window.chrome && !!window.chrome.webstore;
};

var getMaxElementSize = exports.getMaxElementSize = function getMaxElementSize() {
  if (isBrowser()) {
    if (isChrome()) {
      return CHROME_MAX_ELEMENT_SIZE;
    }
  }
  return DEFAULT_MAX_ELEMENT_SIZE;
};