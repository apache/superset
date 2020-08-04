"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// values are "up-to"
var maximumVersion = 9999;

exports.default = {
  calc: {
    firefox: 15,
    chrome: 25,
    safari: 6.1,
    ios_saf: 7
  },
  crossFade: {
    chrome: maximumVersion,
    opera: maximumVersion,
    and_chr: maximumVersion,
    ios_saf: 10,
    safari: 10
  },
  cursor: {
    firefox: maximumVersion,
    chrome: maximumVersion,
    safari: maximumVersion,
    opera: maximumVersion
  },
  filter: {
    ios_saf: maximumVersion,
    safari: 9.1
  },
  flex: {
    chrome: 29,
    safari: 9,
    ios_saf: 9,
    opera: 16
  },
  flexboxIE: {
    ie_mob: 11,
    ie: 11
  },
  flexboxOld: {
    firefox: 22,
    chrome: 21,
    safari: 6.2,
    ios_saf: 6.2,
    android: 4.4,
    and_uc: maximumVersion
  },
  gradient: {
    firefox: 16,
    chrome: 26,
    safari: 7,
    ios_saf: 7,
    opera: 12.1,
    op_mini: 12.1,
    android: 4.4,
    and_uc: maximumVersion
  },
  imageSet: {
    chrome: maximumVersion,
    safari: maximumVersion,
    opera: maximumVersion,
    and_chr: maximumVersion,
    and_uc: maximumVersion,
    ios_saf: maximumVersion
  },
  position: {
    safari: maximumVersion,
    ios_saf: maximumVersion
  },
  sizing: {
    chrome: 46,
    safari: maximumVersion,
    opera: 33,
    and_chr: 53,
    ios_saf: maximumVersion
  },
  transition: {
    chrome: maximumVersion,
    safari: maximumVersion,
    opera: maximumVersion,
    and_chr: maximumVersion,
    and_uc: maximumVersion,
    ios_saf: maximumVersion,
    msie: maximumVersion,
    ie_mob: maximumVersion,
    edge: maximumVersion,
    firefox: maximumVersion,
    op_mini: maximumVersion
  }
};
module.exports = exports["default"];