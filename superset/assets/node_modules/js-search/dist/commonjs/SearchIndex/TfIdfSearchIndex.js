'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TfIdfSearchIndex = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _getNestedFieldValue = require('../getNestedFieldValue');

var _getNestedFieldValue2 = _interopRequireDefault(_getNestedFieldValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Search index capable of returning results matching a set of tokens and ranked according to TF-IDF.
 */
var TfIdfSearchIndex = exports.TfIdfSearchIndex = function () {
  function TfIdfSearchIndex(uidFieldName) {
    _classCallCheck(this, TfIdfSearchIndex);

    this._uidFieldName = uidFieldName;
    this._tokenToIdfCache = {};
    this._tokenMap = {};
  }

  /**
   * @inheritDocs
   */


  _createClass(TfIdfSearchIndex, [{
    key: 'indexDocument',
    value: function indexDocument(token, uid, doc) {
      this._tokenToIdfCache = {}; // New index invalidates previous IDF caches

      var tokenMap = this._tokenMap;
      var tokenDatum;

      if (_typeof(tokenMap[token]) !== 'object') {
        tokenMap[token] = tokenDatum = {
          $numDocumentOccurrences: 0,
          $totalNumOccurrences: 1,
          $uidMap: {}
        };
      } else {
        tokenDatum = tokenMap[token];
        tokenDatum.$totalNumOccurrences++;
      }

      var uidMap = tokenDatum.$uidMap;

      if (_typeof(uidMap[uid]) !== 'object') {
        tokenDatum.$numDocumentOccurrences++;
        uidMap[uid] = {
          $document: doc,
          $numTokenOccurrences: 1
        };
      } else {
        uidMap[uid].$numTokenOccurrences++;
      }
    }

    /**
     * @inheritDocs
     */

  }, {
    key: 'search',
    value: function search(tokens, corpus) {
      var uidToDocumentMap = {};

      for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
        var token = tokens[i];
        var tokenMetadata = this._tokenMap[token];

        // Short circuit if no matches were found for any given token.
        if (!tokenMetadata) {
          return [];
        }

        if (i === 0) {
          var keys = Object.keys(tokenMetadata.$uidMap);
          for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
            var uid = keys[j];

            uidToDocumentMap[uid] = tokenMetadata.$uidMap[uid].$document;
          }
        } else {
          var keys = Object.keys(uidToDocumentMap);
          for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
            var uid = keys[j];

            if (_typeof(tokenMetadata.$uidMap[uid]) !== 'object') {
              delete uidToDocumentMap[uid];
            }
          }
        }
      }

      var documents = [];

      for (var uid in uidToDocumentMap) {
        documents.push(uidToDocumentMap[uid]);
      }

      var calculateTfIdf = this._createCalculateTfIdf();

      // Return documents sorted by TF-IDF
      return documents.sort(function (documentA, documentB) {
        return calculateTfIdf(tokens, documentB, corpus) - calculateTfIdf(tokens, documentA, corpus);
      });
    }
  }, {
    key: '_createCalculateIdf',
    value: function _createCalculateIdf() {
      var tokenMap = this._tokenMap;
      var tokenToIdfCache = this._tokenToIdfCache;

      return function calculateIdf(token, documents) {
        if (!tokenToIdfCache[token]) {
          var numDocumentsWithToken = typeof tokenMap[token] !== 'undefined' ? tokenMap[token].$numDocumentOccurrences : 0;

          tokenToIdfCache[token] = 1 + Math.log(documents.length / (1 + numDocumentsWithToken));
        }

        return tokenToIdfCache[token];
      };
    }
  }, {
    key: '_createCalculateTfIdf',
    value: function _createCalculateTfIdf() {
      var tokenMap = this._tokenMap;
      var uidFieldName = this._uidFieldName;
      var calculateIdf = this._createCalculateIdf();

      return function calculateTfIdf(tokens, document, documents) {
        var score = 0;

        for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
          var token = tokens[i];

          var inverseDocumentFrequency = calculateIdf(token, documents);

          if (inverseDocumentFrequency === Infinity) {
            inverseDocumentFrequency = 0;
          }

          var uid;
          if (uidFieldName instanceof Array) {
            uid = document && (0, _getNestedFieldValue2.default)(document, uidFieldName);
          } else {
            uid = document && document[uidFieldName];
          }

          var termFrequency = typeof tokenMap[token] !== 'undefined' && typeof tokenMap[token].$uidMap[uid] !== 'undefined' ? tokenMap[token].$uidMap[uid].$numTokenOccurrences : 0;

          score += termFrequency * inverseDocumentFrequency;
        }

        return score;
      };
    }
  }]);

  return TfIdfSearchIndex;
}();

;
//# sourceMappingURL=TfIdfSearchIndex.js.map