'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Search = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _getNestedFieldValue = require('./getNestedFieldValue');

var _getNestedFieldValue2 = _interopRequireDefault(_getNestedFieldValue);

var _index = require('./IndexStrategy/index');

var _index2 = require('./Sanitizer/index');

var _index3 = require('./SearchIndex/index');

var _index4 = require('./Tokenizer/index');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Simple client-side searching within a set of documents.
 *
 * <p>Documents can be searched by any number of fields. Indexing and search strategies are highly customizable.
 */
var Search = exports.Search = function () {

  /**
   * Constructor.
   * @param uidFieldName Field containing values that uniquely identify search documents; this field's values are used
   *                     to ensure that a search result set does not contain duplicate objects.
   */


  /**
   * Array containing either a property name or a path (list of property names) to a nested value
   */
  function Search(uidFieldName) {
    _classCallCheck(this, Search);

    if (!uidFieldName) {
      throw Error('js-search requires a uid field name constructor parameter');
    }

    this._uidFieldName = uidFieldName;

    // Set default/recommended strategies
    this._indexStrategy = new _index.PrefixIndexStrategy();
    this._searchIndex = new _index3.TfIdfSearchIndex(uidFieldName);
    this._sanitizer = new _index2.LowerCaseSanitizer();
    this._tokenizer = new _index4.SimpleTokenizer();

    this._documents = [];
    this._searchableFields = [];
  }

  /**
   * Override the default index strategy.
   * @param value Custom index strategy
   * @throws Error if documents have already been indexed by this search instance
   */


  _createClass(Search, [{
    key: 'addDocument',


    /**
     * Add a searchable document to the index. Document will automatically be indexed for search.
     * @param document
     */
    value: function addDocument(document) {
      this.addDocuments([document]);
    }

    /**
     * Adds searchable documents to the index. Documents will automatically be indexed for search.
     * @param document
     */

  }, {
    key: 'addDocuments',
    value: function addDocuments(documents) {
      this._documents = this._documents.concat(documents);
      this.indexDocuments_(documents, this._searchableFields);
    }

    /**
     * Add a new searchable field to the index. Existing documents will automatically be indexed using this new field.
     *
     * @param field Searchable field or field path. Pass a string to index a top-level field and an array of strings for nested fields.
     */

  }, {
    key: 'addIndex',
    value: function addIndex(field) {
      this._searchableFields.push(field);
      this.indexDocuments_(this._documents, [field]);
    }

    /**
     * Search all documents for ones matching the specified query text.
     * @param query
     * @returns {Array<Object>}
     */

  }, {
    key: 'search',
    value: function search(query) {
      var tokens = this._tokenizer.tokenize(this._sanitizer.sanitize(query));

      return this._searchIndex.search(tokens, this._documents);
    }

    /**
     * @param documents
     * @param _searchableFields Array containing property names and paths (lists of property names) to nested values
     * @private
     */

  }, {
    key: 'indexDocuments_',
    value: function indexDocuments_(documents, _searchableFields) {
      this._initialized = true;

      var indexStrategy = this._indexStrategy;
      var sanitizer = this._sanitizer;
      var searchIndex = this._searchIndex;
      var tokenizer = this._tokenizer;
      var uidFieldName = this._uidFieldName;

      for (var di = 0, numDocuments = documents.length; di < numDocuments; di++) {
        var doc = documents[di];
        var uid;

        if (uidFieldName instanceof Array) {
          uid = (0, _getNestedFieldValue2.default)(doc, uidFieldName);
        } else {
          uid = doc[uidFieldName];
        }

        for (var sfi = 0, numSearchableFields = _searchableFields.length; sfi < numSearchableFields; sfi++) {
          var fieldValue;
          var searchableField = _searchableFields[sfi];

          if (searchableField instanceof Array) {
            fieldValue = (0, _getNestedFieldValue2.default)(doc, searchableField);
          } else {
            fieldValue = doc[searchableField];
          }

          if (fieldValue != null && typeof fieldValue !== 'string' && fieldValue.toString) {
            fieldValue = fieldValue.toString();
          }

          if (typeof fieldValue === 'string') {
            var fieldTokens = tokenizer.tokenize(sanitizer.sanitize(fieldValue));

            for (var fti = 0, numFieldValues = fieldTokens.length; fti < numFieldValues; fti++) {
              var fieldToken = fieldTokens[fti];
              var expandedTokens = indexStrategy.expandToken(fieldToken);

              for (var eti = 0, nummExpandedTokens = expandedTokens.length; eti < nummExpandedTokens; eti++) {
                var expandedToken = expandedTokens[eti];

                searchIndex.indexDocument(expandedToken, uid, doc);
              }
            }
          }
        }
      }
    }
  }, {
    key: 'indexStrategy',
    set: function set(value) {
      if (this._initialized) {
        throw Error('IIndexStrategy cannot be set after initialization');
      }

      this._indexStrategy = value;
    },
    get: function get() {
      return this._indexStrategy;
    }

    /**
     * Override the default text sanitizing strategy.
     * @param value Custom text sanitizing strategy
     * @throws Error if documents have already been indexed by this search instance
     */

  }, {
    key: 'sanitizer',
    set: function set(value) {
      if (this._initialized) {
        throw Error('ISanitizer cannot be set after initialization');
      }

      this._sanitizer = value;
    },
    get: function get() {
      return this._sanitizer;
    }

    /**
     * Override the default search index strategy.
     * @param value Custom search index strategy
     * @throws Error if documents have already been indexed
     */

  }, {
    key: 'searchIndex',
    set: function set(value) {
      if (this._initialized) {
        throw Error('ISearchIndex cannot be set after initialization');
      }

      this._searchIndex = value;
    },
    get: function get() {
      return this._searchIndex;
    }

    /**
     * Override the default text tokenizing strategy.
     * @param value Custom text tokenizing strategy
     * @throws Error if documents have already been indexed by this search instance
     */

  }, {
    key: 'tokenizer',
    set: function set(value) {
      if (this._initialized) {
        throw Error('ITokenizer cannot be set after initialization');
      }

      this._tokenizer = value;
    },
    get: function get() {
      return this._tokenizer;
    }
  }]);

  return Search;
}();
//# sourceMappingURL=Search.js.map