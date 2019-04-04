"use strict";

const {
  inspect
} = require('util');

const _ = require('lodash');

exports.createAssetsFilter = createAssetsFilter;

function createAssetsFilter(excludePatterns) {
  const excludeFunctions = _(excludePatterns).castArray().compact().map(pattern => {
    if (typeof pattern === 'string') {
      pattern = new RegExp(pattern);
    }

    if (_.isRegExp(pattern)) {
      return asset => pattern.test(asset);
    }

    if (!_.isFunction(pattern)) {
      throw new TypeError(`Pattern should be either string, RegExp or a function, but "${inspect(pattern, {
        depth: 0
      })}" got.`);
    }

    return pattern;
  }).value();

  if (excludeFunctions.length) {
    return asset => _.every(excludeFunctions, fn => fn(asset) !== true);
  } else {
    return () => true;
  }
}