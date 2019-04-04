'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TokenHighlighter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _index = require('./IndexStrategy/index');

var _index2 = require('./Sanitizer/index');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This utility highlights the occurrences of tokens within a string of text. It can be used to give visual indicators
 * of match criteria within searchable fields.
 *
 * <p>For performance purposes this highlighter only works with full-word or prefix token indexes.
 */
var TokenHighlighter = exports.TokenHighlighter = function () {

  /**
   * Constructor.
   *
   * @param opt_indexStrategy Index strategy used by Search
   * @param opt_sanitizer Sanitizer used by Search
   * @param opt_wrapperTagName Optional wrapper tag name; defaults to 'mark' (e.g. <mark>)
   */
  function TokenHighlighter(opt_indexStrategy, opt_sanitizer, opt_wrapperTagName) {
    _classCallCheck(this, TokenHighlighter);

    this._indexStrategy = opt_indexStrategy || new _index.PrefixIndexStrategy();
    this._sanitizer = opt_sanitizer || new _index2.LowerCaseSanitizer();
    this._wrapperTagName = opt_wrapperTagName || 'mark';
  }

  /**
   * Highlights token occurrences within a string by wrapping them with a DOM element.
   *
   * @param text e.g. "john wayne"
   * @param tokens e.g. ["wa"]
   * @returns {string} e.g. "john <mark>wa</mark>yne"
   */


  _createClass(TokenHighlighter, [{
    key: 'highlight',
    value: function highlight(text, tokens) {
      var tagsLength = this._wrapText('').length;

      var tokenDictionary = {};

      // Create a token map for easier lookup below.
      for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
        var token = this._sanitizer.sanitize(tokens[i]);
        var expandedTokens = this._indexStrategy.expandToken(token);

        for (var j = 0, numExpandedTokens = expandedTokens.length; j < numExpandedTokens; j++) {
          var expandedToken = expandedTokens[j];

          if (!tokenDictionary[expandedToken]) {
            tokenDictionary[expandedToken] = [token];
          } else {
            tokenDictionary[expandedToken].push(token);
          }
        }
      }

      // Track actualCurrentWord and sanitizedCurrentWord separately in case we encounter nested tags.
      var actualCurrentWord = '';
      var sanitizedCurrentWord = '';
      var currentWordStartIndex = 0;

      // Note this assumes either prefix or full word matching.
      for (var i = 0, textLength = text.length; i < textLength; i++) {
        var character = text.charAt(i);

        if (character === ' ') {
          actualCurrentWord = '';
          sanitizedCurrentWord = '';
          currentWordStartIndex = i + 1;
        } else {
          actualCurrentWord += character;
          sanitizedCurrentWord += this._sanitizer.sanitize(character);
        }

        if (tokenDictionary[sanitizedCurrentWord] && tokenDictionary[sanitizedCurrentWord].indexOf(sanitizedCurrentWord) >= 0) {

          actualCurrentWord = this._wrapText(actualCurrentWord);
          text = text.substring(0, currentWordStartIndex) + actualCurrentWord + text.substring(i + 1);

          i += tagsLength;
          textLength += tagsLength;
        }
      }

      return text;
    }

    /**
     * @param text to wrap
     * @returns Text wrapped by wrapper tag (e.g. "foo" becomes "<mark>foo</mark>")
     * @private
     */

  }, {
    key: '_wrapText',
    value: function _wrapText(text) {
      var tagName = this._wrapperTagName;
      return '<' + tagName + '>' + text + '</' + tagName + '>';
    }
  }]);

  return TokenHighlighter;
}();

;
//# sourceMappingURL=TokenHighlighter.js.map