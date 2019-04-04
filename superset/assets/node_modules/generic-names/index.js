'use strict';

var interpolateName = require('loader-utils').interpolateName;
var path = require('path');
var util = require('util');

/**
 * @param  {string} pattern
 * @param  {object} options
 * @param  {string} options.context
 * @param  {string} options.hashPrefix
 * @return {function}
 */
module.exports = function createGenerator(pattern, options) {
  options = options || {};
  var context = options && typeof options.context === 'string'
    ? options.context
    : '';
  var hashPrefix = options && typeof options.hashPrefix === 'string'
    ? options.hashPrefix
    : '';

  /**
   * @param  {string} localName Usually a class name
   * @param  {string} filepath  Absolute path
   * @return {string}
   */
  return function generate(localName, filepath) {
    var name = pattern.replace(/\[local\]/gi, localName);
    var loaderContext = {
      resourcePath: filepath
    };
    var loaderOptions = {
      content: util.format('%s%s+%s',
        hashPrefix,
        path.relative(context, filepath),
        localName),
      context: context
    };

    var genericName = interpolateName(loaderContext, name, loaderOptions);
    return genericName
      .replace(new RegExp('[^a-zA-Z0-9\\-_\u00A0-\uFFFF]', 'g'), '-')
      .replace(/^((-?[0-9])|--)/, "_$1");
  };
};
