"use strict";

/**
 * The stringifyLoader turns any content into a valid JavaScript string. This allows us to load any content
 * with loaderContext.loadModule() without webpack complaining about non-JS modules.
 *
 * @param {string} content
 * @return {string}
 */
function stringifyLoader(content) {
  return JSON.stringify(content);
}

module.exports = stringifyLoader;