'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var REGEX = /[^a-zа-яё0-9\-']+/i;

/**
 * Simple tokenizer that splits strings on whitespace characters and returns an array of all non-empty substrings.
 */


var SimpleTokenizer = exports.SimpleTokenizer = function () {
  function SimpleTokenizer() {
    _classCallCheck(this, SimpleTokenizer);
  }

  _createClass(SimpleTokenizer, [{
    key: 'tokenize',


    /**
     * @inheritDocs
     */
    value: function tokenize(text) {
      return text.split(REGEX).filter(function (text) {
        return text;
      } // Filter empty tokens
      );
    }
  }]);

  return SimpleTokenizer;
}();

;
//# sourceMappingURL=SimpleTokenizer.js.map