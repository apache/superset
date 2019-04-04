'use strict';

var removeSourceMappingUrl = require('./removeSourceMappingUrl');
var formatLessError = require('./formatLessError');

/**
 * Removes the sourceMappingURL from the generated CSS, parses the source map and calls the next loader.
 *
 * @param {loaderContext} loaderContext
 * @param {Promise<LessResult>} resultPromise
 */
function processResult(loaderContext, resultPromise) {
  var callback = loaderContext.callback;


  resultPromise.then(function (_ref) {
    var css = _ref.css,
        map = _ref.map,
        imports = _ref.imports;

    imports.forEach(loaderContext.addDependency, loaderContext);
    return {
      // Removing the sourceMappingURL comment.
      // See removeSourceMappingUrl.js for the reasoning behind this.
      css: removeSourceMappingUrl(css),
      map: typeof map === 'string' ? JSON.parse(map) : map
    };
  }, function (lessError) {
    throw formatLessError(lessError);
  }).then(function (_ref2) {
    var css = _ref2.css,
        map = _ref2.map;

    callback(null, css, map);
  }, callback);
}

module.exports = processResult;