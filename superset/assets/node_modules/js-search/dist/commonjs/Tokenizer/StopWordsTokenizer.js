'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StopWordsTokenizer = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _StopWordsMap = require('../StopWordsMap');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Stop words are very common (e.g. "a", "and", "the") and are often not semantically meaningful in the context of a
 * search. This tokenizer removes stop words from a set of tokens before passing the remaining tokens along for
 * indexing or searching purposes.
 */
var StopWordsTokenizer = exports.StopWordsTokenizer = function () {

  /**
   * Constructor.
   *
   * @param decoratedIndexStrategy Index strategy to be run after all stop words have been removed.
   */
  function StopWordsTokenizer(decoratedTokenizer) {
    _classCallCheck(this, StopWordsTokenizer);

    this._tokenizer = decoratedTokenizer;
  }

  /**
   * @inheritDocs
   */


  _createClass(StopWordsTokenizer, [{
    key: 'tokenize',
    value: function tokenize(text) {
      return this._tokenizer.tokenize(text).filter(function (token) {
        return !_StopWordsMap.StopWordsMap[token];
      });
    }
  }]);

  return StopWordsTokenizer;
}();

;
//# sourceMappingURL=StopWordsTokenizer.js.map