'use strict';

var matchSourceMappingUrl = /\/\*# sourceMappingURL=[^*]+\*\//;

/**
 * Removes the sourceMappingURL comment. This is necessary because the less-loader
 * does not know where the final source map will be located. Thus, we remove every
 * reference to source maps. In a regular setup, the css-loader will embed the
 * source maps into the CommonJS module and the style-loader will translate it into
 * base64 blob urls.
 *
 * @param {string} content
 * @returns {string}
 */
function removeSourceMappingUrl(content) {
  return content.replace(matchSourceMappingUrl, '');
}

module.exports = removeSourceMappingUrl;