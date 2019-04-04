'use strict';

/**
 * @param {function} compile
 * @param {string}   extension
 * @param {function} isException
 */

module.exports = function attachHook(compile, extension, isException) {
  var existingHook = require.extensions[extension];

  require.extensions[extension] = function cssModulesHook(m, filename) {
    if (isException(filename)) {
      existingHook(m, filename);
    } else {
      var tokens = compile(filename);
      return m._compile(`module.exports = ${JSON.stringify(tokens)}`, filename);
    }
  };
};