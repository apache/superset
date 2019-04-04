'use strict';

var loaderUtils = require('loader-utils');
var clone = require('clone');
var createWebpackLessPlugin = require('./createWebpackLessPlugin');

/**
 * Retrieves the options from the loaderContext, makes a deep copy of it and normalizes it for further consumption.
 *
 * @param {LoaderContext} loaderContext
 */
function getOptions(loaderContext) {
  var options = Object.assign({
    plugins: [],
    relativeUrls: true,
    compress: Boolean(loaderContext.minimize)
  }, clone(loaderUtils.getOptions(loaderContext)));

  // We need to set the filename because otherwise our WebpackFileManager will receive an undefined path for the entry
  options.filename = loaderContext.resource;

  // When no paths are given, we use the webpack resolver
  if ('paths' in options === false) {
    // It's safe to mutate the array now because it has already been cloned
    options.plugins.push(createWebpackLessPlugin(loaderContext));
  }

  if (options.sourceMap) {
    if (typeof options.sourceMap === 'boolean') {
      options.sourceMap = {};
    }
    if ('outputSourceFiles' in options.sourceMap === false) {
      // Include source files as `sourceContents` as sane default since this makes source maps "just work" in most cases
      options.sourceMap.outputSourceFiles = true;
    }
  }

  return options;
}

module.exports = getOptions;