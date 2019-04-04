'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Indexes for all substring searches (e.g. the term "cat" is indexed as "c", "ca", "cat", "a", "at", and "t").
 */
var AllSubstringsIndexStrategy = exports.AllSubstringsIndexStrategy = function () {
  function AllSubstringsIndexStrategy() {
    _classCallCheck(this, AllSubstringsIndexStrategy);
  }

  _createClass(AllSubstringsIndexStrategy, [{
    key: 'expandToken',


    /**
     * @inheritDocs
     */
    value: function expandToken(token) {
      var expandedTokens = [];
      var string;

      for (var i = 0, length = token.length; i < length; ++i) {
        string = '';

        for (var j = i; j < length; ++j) {
          string += token.charAt(j);
          expandedTokens.push(string);
        }
      }

      return expandedTokens;
    }
  }]);

  return AllSubstringsIndexStrategy;
}();

;
//# sourceMappingURL=AllSubstringsIndexStrategy.js.map