'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Search index capable of returning results matching a set of tokens but without any meaningful rank or order.
 */
var UnorderedSearchIndex = exports.UnorderedSearchIndex = function () {
  function UnorderedSearchIndex() {
    _classCallCheck(this, UnorderedSearchIndex);

    this._tokenToUidToDocumentMap = {};
  }

  /**
   * @inheritDocs
   */


  _createClass(UnorderedSearchIndex, [{
    key: 'indexDocument',
    value: function indexDocument(token, uid, doc) {
      if (_typeof(this._tokenToUidToDocumentMap[token]) !== 'object') {
        this._tokenToUidToDocumentMap[token] = {};
      }

      this._tokenToUidToDocumentMap[token][uid] = doc;
    }

    /**
     * @inheritDocs
     */

  }, {
    key: 'search',
    value: function search(tokens, corpus) {
      var intersectingDocumentMap = {};

      var tokenToUidToDocumentMap = this._tokenToUidToDocumentMap;

      for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
        var token = tokens[i];
        var documentMap = tokenToUidToDocumentMap[token];

        // Short circuit if no matches were found for any given token.
        if (!documentMap) {
          return [];
        }

        if (i === 0) {
          var keys = Object.keys(documentMap);

          for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
            var uid = keys[j];

            intersectingDocumentMap[uid] = documentMap[uid];
          }
        } else {
          var keys = Object.keys(intersectingDocumentMap);

          for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
            var uid = keys[j];

            if (_typeof(documentMap[uid]) !== 'object') {
              delete intersectingDocumentMap[uid];
            }
          }
        }
      }

      var keys = Object.keys(intersectingDocumentMap);
      var documents = [];

      for (var i = 0, numKeys = keys.length; i < numKeys; i++) {
        var uid = keys[i];

        documents.push(intersectingDocumentMap[uid]);
      }

      return documents;
    }
  }]);

  return UnorderedSearchIndex;
}();

;
//# sourceMappingURL=UnorderedSearchIndex.js.map