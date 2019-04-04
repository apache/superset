!function(root, factory) {
    "object" == typeof exports && "object" == typeof module ? module.exports = factory() : "function" == typeof define && define.amd ? define([], factory) : "object" == typeof exports ? exports.JsSearch = factory() : root.JsSearch = factory();
}(this, function() {
    /******/
    return function(modules) {
        /******/
        // The require function
        /******/
        function __webpack_require__(moduleId) {
            /******/
            // Check if module is in cache
            /******/
            if (installedModules[moduleId]) /******/
            return installedModules[moduleId].exports;
            /******/
            // Create a new module (and put it into the cache)
            /******/
            var module = installedModules[moduleId] = {
                /******/
                i: moduleId,
                /******/
                l: !1,
                /******/
                exports: {}
            };
            /******/
            // Return the exports of the module
            /******/
            /******/
            // Execute the module function
            /******/
            /******/
            // Flag the module as loaded
            /******/
            return modules[moduleId].call(module.exports, module, module.exports, __webpack_require__), 
            module.l = !0, module.exports;
        }
        // webpackBootstrap
        /******/
        // The module cache
        /******/
        var installedModules = {};
        /******/
        // Load entry module and return exports
        /******/
        /******/
        // expose the modules object (__webpack_modules__)
        /******/
        /******/
        // expose the module cache
        /******/
        /******/
        // identity function for calling harmony imports with the correct context
        /******/
        /******/
        // define getter function for harmony exports
        /******/
        /******/
        // getDefaultExport function for compatibility with non-harmony modules
        /******/
        /******/
        // Object.prototype.hasOwnProperty.call
        /******/
        /******/
        // __webpack_public_path__
        /******/
        return __webpack_require__.m = modules, __webpack_require__.c = installedModules, 
        __webpack_require__.i = function(value) {
            return value;
        }, __webpack_require__.d = function(exports, name, getter) {
            /******/
            __webpack_require__.o(exports, name) || /******/
            Object.defineProperty(exports, name, {
                /******/
                configurable: !1,
                /******/
                enumerable: !0,
                /******/
                get: getter
            });
        }, __webpack_require__.n = function(module) {
            /******/
            var getter = module && module.__esModule ? /******/
            function() {
                return module.default;
            } : /******/
            function() {
                return module;
            };
            /******/
            /******/
            return __webpack_require__.d(getter, "a", getter), getter;
        }, __webpack_require__.o = function(object, property) {
            return Object.prototype.hasOwnProperty.call(object, property);
        }, __webpack_require__.p = "", __webpack_require__(__webpack_require__.s = 18);
    }([ /* 0 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _AllSubstringsIndexStrategy = __webpack_require__(8);
        Object.defineProperty(exports, "AllSubstringsIndexStrategy", {
            enumerable: !0,
            get: function() {
                return _AllSubstringsIndexStrategy.AllSubstringsIndexStrategy;
            }
        });
        var _ExactWordIndexStrategy = __webpack_require__(9);
        Object.defineProperty(exports, "ExactWordIndexStrategy", {
            enumerable: !0,
            get: function() {
                return _ExactWordIndexStrategy.ExactWordIndexStrategy;
            }
        });
        var _PrefixIndexStrategy = __webpack_require__(10);
        Object.defineProperty(exports, "PrefixIndexStrategy", {
            enumerable: !0,
            get: function() {
                return _PrefixIndexStrategy.PrefixIndexStrategy;
            }
        });
    }, /* 1 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _CaseSensitiveSanitizer = __webpack_require__(11);
        Object.defineProperty(exports, "CaseSensitiveSanitizer", {
            enumerable: !0,
            get: function() {
                return _CaseSensitiveSanitizer.CaseSensitiveSanitizer;
            }
        });
        var _LowerCaseSanitizer = __webpack_require__(12);
        Object.defineProperty(exports, "LowerCaseSanitizer", {
            enumerable: !0,
            get: function() {
                return _LowerCaseSanitizer.LowerCaseSanitizer;
            }
        });
    }, /* 2 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _TfIdfSearchIndex = __webpack_require__(13);
        Object.defineProperty(exports, "TfIdfSearchIndex", {
            enumerable: !0,
            get: function() {
                return _TfIdfSearchIndex.TfIdfSearchIndex;
            }
        });
        var _UnorderedSearchIndex = __webpack_require__(14);
        Object.defineProperty(exports, "UnorderedSearchIndex", {
            enumerable: !0,
            get: function() {
                return _UnorderedSearchIndex.UnorderedSearchIndex;
            }
        });
    }, /* 3 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var StopWordsMap = exports.StopWordsMap = {
            a: !0,
            able: !0,
            about: !0,
            across: !0,
            after: !0,
            all: !0,
            almost: !0,
            also: !0,
            am: !0,
            among: !0,
            an: !0,
            and: !0,
            any: !0,
            are: !0,
            as: !0,
            at: !0,
            be: !0,
            because: !0,
            been: !0,
            but: !0,
            by: !0,
            can: !0,
            cannot: !0,
            could: !0,
            dear: !0,
            did: !0,
            do: !0,
            does: !0,
            either: !0,
            else: !0,
            ever: !0,
            every: !0,
            for: !0,
            from: !0,
            get: !0,
            got: !0,
            had: !0,
            has: !0,
            have: !0,
            he: !0,
            her: !0,
            hers: !0,
            him: !0,
            his: !0,
            how: !0,
            however: !0,
            i: !0,
            if: !0,
            in: !0,
            into: !0,
            is: !0,
            it: !0,
            its: !0,
            just: !0,
            least: !0,
            let: !0,
            like: !0,
            likely: !0,
            may: !0,
            me: !0,
            might: !0,
            most: !0,
            must: !0,
            my: !0,
            neither: !0,
            no: !0,
            nor: !0,
            not: !0,
            of: !0,
            off: !0,
            often: !0,
            on: !0,
            only: !0,
            or: !0,
            other: !0,
            our: !0,
            own: !0,
            rather: !0,
            said: !0,
            say: !0,
            says: !0,
            she: !0,
            should: !0,
            since: !0,
            so: !0,
            some: !0,
            than: !0,
            that: !0,
            the: !0,
            their: !0,
            them: !0,
            then: !0,
            there: !0,
            these: !0,
            they: !0,
            this: !0,
            tis: !0,
            to: !0,
            too: !0,
            twas: !0,
            us: !0,
            wants: !0,
            was: !0,
            we: !0,
            were: !0,
            what: !0,
            when: !0,
            where: !0,
            which: !0,
            while: !0,
            who: !0,
            whom: !0,
            why: !0,
            will: !0,
            with: !0,
            would: !0,
            yet: !0,
            you: !0,
            your: !0
        };
        // Prevent false positives for inherited properties
        StopWordsMap.constructor = !1, StopWordsMap.hasOwnProperty = !1, StopWordsMap.isPrototypeOf = !1, 
        StopWordsMap.propertyIsEnumerable = !1, StopWordsMap.toLocaleString = !1, StopWordsMap.toString = !1, 
        StopWordsMap.valueOf = !1;
    }, /* 4 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _SimpleTokenizer = __webpack_require__(15);
        Object.defineProperty(exports, "SimpleTokenizer", {
            enumerable: !0,
            get: function() {
                return _SimpleTokenizer.SimpleTokenizer;
            }
        });
        var _StemmingTokenizer = __webpack_require__(16);
        Object.defineProperty(exports, "StemmingTokenizer", {
            enumerable: !0,
            get: function() {
                return _StemmingTokenizer.StemmingTokenizer;
            }
        });
        var _StopWordsTokenizer = __webpack_require__(17);
        Object.defineProperty(exports, "StopWordsTokenizer", {
            enumerable: !0,
            get: function() {
                return _StopWordsTokenizer.StopWordsTokenizer;
            }
        });
    }, /* 5 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        /**
 * Find and return a nested object value.
 *
 * @param object to crawl
 * @param path Property path
 * @returns {any}
 */
        function getNestedFieldValue(object, path) {
            path = path || [], object = object || {};
            // walk down the property path
            for (var value = object, i = 0; i < path.length; i++) if (value = value[path[i]], 
            null == value) return null;
            return value;
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        }), exports.default = getNestedFieldValue;
    }, /* 6 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _interopRequireDefault(obj) {
            return obj && obj.__esModule ? obj : {
                default: obj
            };
        }
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        }), exports.Search = void 0;
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }(), _getNestedFieldValue = __webpack_require__(5), _getNestedFieldValue2 = _interopRequireDefault(_getNestedFieldValue), _index = __webpack_require__(0), _index2 = __webpack_require__(1), _index3 = __webpack_require__(2), _index4 = __webpack_require__(4);
        exports.Search = function() {
            /**
   * Constructor.
   * @param uidFieldName Field containing values that uniquely identify search documents; this field's values are used
   *                     to ensure that a search result set does not contain duplicate objects.
   */
            /**
   * Array containing either a property name or a path (list of property names) to a nested value
   */
            function Search(uidFieldName) {
                if (_classCallCheck(this, Search), !uidFieldName) throw Error("js-search requires a uid field name constructor parameter");
                this._uidFieldName = uidFieldName, // Set default/recommended strategies
                this._indexStrategy = new _index.PrefixIndexStrategy(), this._searchIndex = new _index3.TfIdfSearchIndex(uidFieldName), 
                this._sanitizer = new _index2.LowerCaseSanitizer(), this._tokenizer = new _index4.SimpleTokenizer(), 
                this._documents = [], this._searchableFields = [];
            }
            /**
   * Override the default index strategy.
   * @param value Custom index strategy
   * @throws Error if documents have already been indexed by this search instance
   */
            return _createClass(Search, [ {
                key: "addDocument",
                /**
     * Add a searchable document to the index. Document will automatically be indexed for search.
     * @param document
     */
                value: function(document) {
                    this.addDocuments([ document ]);
                }
            }, {
                key: "addDocuments",
                value: function(documents) {
                    this._documents = this._documents.concat(documents), this.indexDocuments_(documents, this._searchableFields);
                }
            }, {
                key: "addIndex",
                value: function(field) {
                    this._searchableFields.push(field), this.indexDocuments_(this._documents, [ field ]);
                }
            }, {
                key: "search",
                value: function(query) {
                    var tokens = this._tokenizer.tokenize(this._sanitizer.sanitize(query));
                    return this._searchIndex.search(tokens, this._documents);
                }
            }, {
                key: "indexDocuments_",
                value: function(documents, _searchableFields) {
                    this._initialized = !0;
                    for (var indexStrategy = this._indexStrategy, sanitizer = this._sanitizer, searchIndex = this._searchIndex, tokenizer = this._tokenizer, uidFieldName = this._uidFieldName, di = 0, numDocuments = documents.length; di < numDocuments; di++) {
                        var uid, doc = documents[di];
                        uid = uidFieldName instanceof Array ? (0, _getNestedFieldValue2.default)(doc, uidFieldName) : doc[uidFieldName];
                        for (var sfi = 0, numSearchableFields = _searchableFields.length; sfi < numSearchableFields; sfi++) {
                            var fieldValue, searchableField = _searchableFields[sfi];
                            if (fieldValue = searchableField instanceof Array ? (0, _getNestedFieldValue2.default)(doc, searchableField) : doc[searchableField], 
                            null != fieldValue && "string" != typeof fieldValue && fieldValue.toString && (fieldValue = fieldValue.toString()), 
                            "string" == typeof fieldValue) for (var fieldTokens = tokenizer.tokenize(sanitizer.sanitize(fieldValue)), fti = 0, numFieldValues = fieldTokens.length; fti < numFieldValues; fti++) for (var fieldToken = fieldTokens[fti], expandedTokens = indexStrategy.expandToken(fieldToken), eti = 0, nummExpandedTokens = expandedTokens.length; eti < nummExpandedTokens; eti++) {
                                var expandedToken = expandedTokens[eti];
                                searchIndex.indexDocument(expandedToken, uid, doc);
                            }
                        }
                    }
                }
            }, {
                key: "indexStrategy",
                set: function(value) {
                    if (this._initialized) throw Error("IIndexStrategy cannot be set after initialization");
                    this._indexStrategy = value;
                },
                get: function() {
                    return this._indexStrategy;
                }
            }, {
                key: "sanitizer",
                set: function(value) {
                    if (this._initialized) throw Error("ISanitizer cannot be set after initialization");
                    this._sanitizer = value;
                },
                get: function() {
                    return this._sanitizer;
                }
            }, {
                key: "searchIndex",
                set: function(value) {
                    if (this._initialized) throw Error("ISearchIndex cannot be set after initialization");
                    this._searchIndex = value;
                },
                get: function() {
                    return this._searchIndex;
                }
            }, {
                key: "tokenizer",
                set: function(value) {
                    if (this._initialized) throw Error("ITokenizer cannot be set after initialization");
                    this._tokenizer = value;
                },
                get: function() {
                    return this._tokenizer;
                }
            } ]), Search;
        }();
    }, /* 7 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        }), exports.TokenHighlighter = void 0;
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }(), _index = __webpack_require__(0), _index2 = __webpack_require__(1);
        exports.TokenHighlighter = function() {
            /**
   * Constructor.
   *
   * @param opt_indexStrategy Index strategy used by Search
   * @param opt_sanitizer Sanitizer used by Search
   * @param opt_wrapperTagName Optional wrapper tag name; defaults to 'mark' (e.g. <mark>)
   */
            function TokenHighlighter(opt_indexStrategy, opt_sanitizer, opt_wrapperTagName) {
                _classCallCheck(this, TokenHighlighter), this._indexStrategy = opt_indexStrategy || new _index.PrefixIndexStrategy(), 
                this._sanitizer = opt_sanitizer || new _index2.LowerCaseSanitizer(), this._wrapperTagName = opt_wrapperTagName || "mark";
            }
            /**
   * Highlights token occurrences within a string by wrapping them with a DOM element.
   *
   * @param text e.g. "john wayne"
   * @param tokens e.g. ["wa"]
   * @returns {string} e.g. "john <mark>wa</mark>yne"
   */
            return _createClass(TokenHighlighter, [ {
                key: "highlight",
                value: function(text, tokens) {
                    // Create a token map for easier lookup below.
                    for (var tagsLength = this._wrapText("").length, tokenDictionary = {}, i = 0, numTokens = tokens.length; i < numTokens; i++) for (var token = this._sanitizer.sanitize(tokens[i]), expandedTokens = this._indexStrategy.expandToken(token), j = 0, numExpandedTokens = expandedTokens.length; j < numExpandedTokens; j++) {
                        var expandedToken = expandedTokens[j];
                        tokenDictionary[expandedToken] ? tokenDictionary[expandedToken].push(token) : tokenDictionary[expandedToken] = [ token ];
                    }
                    // Note this assumes either prefix or full word matching.
                    for (var actualCurrentWord = "", sanitizedCurrentWord = "", currentWordStartIndex = 0, i = 0, textLength = text.length; i < textLength; i++) {
                        var character = text.charAt(i);
                        " " === character ? (actualCurrentWord = "", sanitizedCurrentWord = "", currentWordStartIndex = i + 1) : (actualCurrentWord += character, 
                        sanitizedCurrentWord += this._sanitizer.sanitize(character)), tokenDictionary[sanitizedCurrentWord] && tokenDictionary[sanitizedCurrentWord].indexOf(sanitizedCurrentWord) >= 0 && (actualCurrentWord = this._wrapText(actualCurrentWord), 
                        text = text.substring(0, currentWordStartIndex) + actualCurrentWord + text.substring(i + 1), 
                        i += tagsLength, textLength += tagsLength);
                    }
                    return text;
                }
            }, {
                key: "_wrapText",
                value: function(text) {
                    var tagName = this._wrapperTagName;
                    return "<" + tagName + ">" + text + "</" + tagName + ">";
                }
            } ]), TokenHighlighter;
        }();
    }, /* 8 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.AllSubstringsIndexStrategy = function() {
            function AllSubstringsIndexStrategy() {
                _classCallCheck(this, AllSubstringsIndexStrategy);
            }
            return _createClass(AllSubstringsIndexStrategy, [ {
                key: "expandToken",
                /**
     * @inheritDocs
     */
                value: function(token) {
                    for (var string, expandedTokens = [], i = 0, length = token.length; i < length; ++i) {
                        string = "";
                        for (var j = i; j < length; ++j) string += token.charAt(j), expandedTokens.push(string);
                    }
                    return expandedTokens;
                }
            } ]), AllSubstringsIndexStrategy;
        }();
    }, /* 9 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.ExactWordIndexStrategy = function() {
            function ExactWordIndexStrategy() {
                _classCallCheck(this, ExactWordIndexStrategy);
            }
            return _createClass(ExactWordIndexStrategy, [ {
                key: "expandToken",
                /**
     * @inheritDocs
     */
                value: function(token) {
                    return token ? [ token ] : [];
                }
            } ]), ExactWordIndexStrategy;
        }();
    }, /* 10 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.PrefixIndexStrategy = function() {
            function PrefixIndexStrategy() {
                _classCallCheck(this, PrefixIndexStrategy);
            }
            return _createClass(PrefixIndexStrategy, [ {
                key: "expandToken",
                /**
     * @inheritDocs
     */
                value: function(token) {
                    for (var expandedTokens = [], string = "", i = 0, length = token.length; i < length; ++i) string += token.charAt(i), 
                    expandedTokens.push(string);
                    return expandedTokens;
                }
            } ]), PrefixIndexStrategy;
        }();
    }, /* 11 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.CaseSensitiveSanitizer = function() {
            function CaseSensitiveSanitizer() {
                _classCallCheck(this, CaseSensitiveSanitizer);
            }
            return _createClass(CaseSensitiveSanitizer, [ {
                key: "sanitize",
                /**
     * @inheritDocs
     */
                value: function(text) {
                    return text ? text.trim() : "";
                }
            } ]), CaseSensitiveSanitizer;
        }();
    }, /* 12 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.LowerCaseSanitizer = function() {
            function LowerCaseSanitizer() {
                _classCallCheck(this, LowerCaseSanitizer);
            }
            return _createClass(LowerCaseSanitizer, [ {
                key: "sanitize",
                /**
     * @inheritDocs
     */
                value: function(text) {
                    return text ? text.toLocaleLowerCase().trim() : "";
                }
            } ]), LowerCaseSanitizer;
        }();
    }, /* 13 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _interopRequireDefault(obj) {
            return obj && obj.__esModule ? obj : {
                default: obj
            };
        }
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        }), exports.TfIdfSearchIndex = void 0;
        var _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj) {
            return typeof obj;
        } : function(obj) {
            return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        }, _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }(), _getNestedFieldValue = __webpack_require__(5), _getNestedFieldValue2 = _interopRequireDefault(_getNestedFieldValue);
        exports.TfIdfSearchIndex = function() {
            function TfIdfSearchIndex(uidFieldName) {
                _classCallCheck(this, TfIdfSearchIndex), this._uidFieldName = uidFieldName, this._tokenToIdfCache = {}, 
                this._tokenMap = {};
            }
            /**
   * @inheritDocs
   */
            return _createClass(TfIdfSearchIndex, [ {
                key: "indexDocument",
                value: function(token, uid, doc) {
                    this._tokenToIdfCache = {};
                    // New index invalidates previous IDF caches
                    var tokenDatum, tokenMap = this._tokenMap;
                    "object" !== _typeof(tokenMap[token]) ? tokenMap[token] = tokenDatum = {
                        $numDocumentOccurrences: 0,
                        $totalNumOccurrences: 1,
                        $uidMap: {}
                    } : (tokenDatum = tokenMap[token], tokenDatum.$totalNumOccurrences++);
                    var uidMap = tokenDatum.$uidMap;
                    "object" !== _typeof(uidMap[uid]) ? (tokenDatum.$numDocumentOccurrences++, uidMap[uid] = {
                        $document: doc,
                        $numTokenOccurrences: 1
                    }) : uidMap[uid].$numTokenOccurrences++;
                }
            }, {
                key: "search",
                value: function(tokens, corpus) {
                    for (var uidToDocumentMap = {}, i = 0, numTokens = tokens.length; i < numTokens; i++) {
                        var token = tokens[i], tokenMetadata = this._tokenMap[token];
                        // Short circuit if no matches were found for any given token.
                        if (!tokenMetadata) return [];
                        if (0 === i) for (var keys = Object.keys(tokenMetadata.$uidMap), j = 0, numKeys = keys.length; j < numKeys; j++) {
                            var uid = keys[j];
                            uidToDocumentMap[uid] = tokenMetadata.$uidMap[uid].$document;
                        } else for (var keys = Object.keys(uidToDocumentMap), j = 0, numKeys = keys.length; j < numKeys; j++) {
                            var uid = keys[j];
                            "object" !== _typeof(tokenMetadata.$uidMap[uid]) && delete uidToDocumentMap[uid];
                        }
                    }
                    var documents = [];
                    for (var uid in uidToDocumentMap) documents.push(uidToDocumentMap[uid]);
                    var calculateTfIdf = this._createCalculateTfIdf();
                    // Return documents sorted by TF-IDF
                    return documents.sort(function(documentA, documentB) {
                        return calculateTfIdf(tokens, documentB, corpus) - calculateTfIdf(tokens, documentA, corpus);
                    });
                }
            }, {
                key: "_createCalculateIdf",
                value: function() {
                    var tokenMap = this._tokenMap, tokenToIdfCache = this._tokenToIdfCache;
                    return function(token, documents) {
                        if (!tokenToIdfCache[token]) {
                            var numDocumentsWithToken = "undefined" != typeof tokenMap[token] ? tokenMap[token].$numDocumentOccurrences : 0;
                            tokenToIdfCache[token] = 1 + Math.log(documents.length / (1 + numDocumentsWithToken));
                        }
                        return tokenToIdfCache[token];
                    };
                }
            }, {
                key: "_createCalculateTfIdf",
                value: function() {
                    var tokenMap = this._tokenMap, uidFieldName = this._uidFieldName, calculateIdf = this._createCalculateIdf();
                    return function(tokens, document, documents) {
                        for (var score = 0, i = 0, numTokens = tokens.length; i < numTokens; ++i) {
                            var token = tokens[i], inverseDocumentFrequency = calculateIdf(token, documents);
                            inverseDocumentFrequency === 1 / 0 && (inverseDocumentFrequency = 0);
                            var uid;
                            uid = uidFieldName instanceof Array ? document && (0, _getNestedFieldValue2.default)(document, uidFieldName) : document && document[uidFieldName];
                            var termFrequency = "undefined" != typeof tokenMap[token] && "undefined" != typeof tokenMap[token].$uidMap[uid] ? tokenMap[token].$uidMap[uid].$numTokenOccurrences : 0;
                            score += termFrequency * inverseDocumentFrequency;
                        }
                        return score;
                    };
                }
            } ]), TfIdfSearchIndex;
        }();
    }, /* 14 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj) {
            return typeof obj;
        } : function(obj) {
            return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        }, _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.UnorderedSearchIndex = function() {
            function UnorderedSearchIndex() {
                _classCallCheck(this, UnorderedSearchIndex), this._tokenToUidToDocumentMap = {};
            }
            /**
   * @inheritDocs
   */
            return _createClass(UnorderedSearchIndex, [ {
                key: "indexDocument",
                value: function(token, uid, doc) {
                    "object" !== _typeof(this._tokenToUidToDocumentMap[token]) && (this._tokenToUidToDocumentMap[token] = {}), 
                    this._tokenToUidToDocumentMap[token][uid] = doc;
                }
            }, {
                key: "search",
                value: function(tokens, corpus) {
                    for (var intersectingDocumentMap = {}, tokenToUidToDocumentMap = this._tokenToUidToDocumentMap, i = 0, numTokens = tokens.length; i < numTokens; i++) {
                        var token = tokens[i], documentMap = tokenToUidToDocumentMap[token];
                        // Short circuit if no matches were found for any given token.
                        if (!documentMap) return [];
                        if (0 === i) for (var keys = Object.keys(documentMap), j = 0, numKeys = keys.length; j < numKeys; j++) {
                            var uid = keys[j];
                            intersectingDocumentMap[uid] = documentMap[uid];
                        } else for (var keys = Object.keys(intersectingDocumentMap), j = 0, numKeys = keys.length; j < numKeys; j++) {
                            var uid = keys[j];
                            "object" !== _typeof(documentMap[uid]) && delete intersectingDocumentMap[uid];
                        }
                    }
                    for (var keys = Object.keys(intersectingDocumentMap), documents = [], i = 0, numKeys = keys.length; i < numKeys; i++) {
                        var uid = keys[i];
                        documents.push(intersectingDocumentMap[uid]);
                    }
                    return documents;
                }
            } ]), UnorderedSearchIndex;
        }();
    }, /* 15 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }(), REGEX = /[^a-zа-яё0-9\-']+/i;
        exports.SimpleTokenizer = function() {
            function SimpleTokenizer() {
                _classCallCheck(this, SimpleTokenizer);
            }
            return _createClass(SimpleTokenizer, [ {
                key: "tokenize",
                /**
     * @inheritDocs
     */
                value: function(text) {
                    return text.split(REGEX).filter(function(text) {
                        return text;
                    });
                }
            } ]), SimpleTokenizer;
        }();
    }, /* 16 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }();
        exports.StemmingTokenizer = function() {
            /**
   * Constructor.
   *
   * @param stemmingFunction Function capable of accepting a word and returning its stem.
   * @param decoratedIndexStrategy Index strategy to be run after all stop words have been removed.
   */
            function StemmingTokenizer(stemmingFunction, decoratedTokenizer) {
                _classCallCheck(this, StemmingTokenizer), this._stemmingFunction = stemmingFunction, 
                this._tokenizer = decoratedTokenizer;
            }
            /**
   * @inheritDocs
   */
            return _createClass(StemmingTokenizer, [ {
                key: "tokenize",
                value: function(text) {
                    return this._tokenizer.tokenize(text).map(this._stemmingFunction);
                }
            } ]), StemmingTokenizer;
        }();
    }, /* 17 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
        }
        Object.defineProperty(exports, "__esModule", {
            value: !0
        }), exports.StopWordsTokenizer = void 0;
        var _createClass = function() {
            function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || !1, descriptor.configurable = !0, 
                    "value" in descriptor && (descriptor.writable = !0), Object.defineProperty(target, descriptor.key, descriptor);
                }
            }
            return function(Constructor, protoProps, staticProps) {
                return protoProps && defineProperties(Constructor.prototype, protoProps), staticProps && defineProperties(Constructor, staticProps), 
                Constructor;
            };
        }(), _StopWordsMap = __webpack_require__(3);
        exports.StopWordsTokenizer = function() {
            /**
   * Constructor.
   *
   * @param decoratedIndexStrategy Index strategy to be run after all stop words have been removed.
   */
            function StopWordsTokenizer(decoratedTokenizer) {
                _classCallCheck(this, StopWordsTokenizer), this._tokenizer = decoratedTokenizer;
            }
            /**
   * @inheritDocs
   */
            return _createClass(StopWordsTokenizer, [ {
                key: "tokenize",
                value: function(text) {
                    return this._tokenizer.tokenize(text).filter(function(token) {
                        return !_StopWordsMap.StopWordsMap[token];
                    });
                }
            } ]), StopWordsTokenizer;
        }();
    }, /* 18 */
    /***/
    function(module, exports, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports, "__esModule", {
            value: !0
        });
        var _index = __webpack_require__(0);
        Object.defineProperty(exports, "AllSubstringsIndexStrategy", {
            enumerable: !0,
            get: function() {
                return _index.AllSubstringsIndexStrategy;
            }
        }), Object.defineProperty(exports, "ExactWordIndexStrategy", {
            enumerable: !0,
            get: function() {
                return _index.ExactWordIndexStrategy;
            }
        }), Object.defineProperty(exports, "PrefixIndexStrategy", {
            enumerable: !0,
            get: function() {
                return _index.PrefixIndexStrategy;
            }
        });
        var _index2 = __webpack_require__(1);
        Object.defineProperty(exports, "CaseSensitiveSanitizer", {
            enumerable: !0,
            get: function() {
                return _index2.CaseSensitiveSanitizer;
            }
        }), Object.defineProperty(exports, "LowerCaseSanitizer", {
            enumerable: !0,
            get: function() {
                return _index2.LowerCaseSanitizer;
            }
        });
        var _index3 = __webpack_require__(2);
        Object.defineProperty(exports, "TfIdfSearchIndex", {
            enumerable: !0,
            get: function() {
                return _index3.TfIdfSearchIndex;
            }
        }), Object.defineProperty(exports, "UnorderedSearchIndex", {
            enumerable: !0,
            get: function() {
                return _index3.UnorderedSearchIndex;
            }
        });
        var _index4 = __webpack_require__(4);
        Object.defineProperty(exports, "SimpleTokenizer", {
            enumerable: !0,
            get: function() {
                return _index4.SimpleTokenizer;
            }
        }), Object.defineProperty(exports, "StemmingTokenizer", {
            enumerable: !0,
            get: function() {
                return _index4.StemmingTokenizer;
            }
        }), Object.defineProperty(exports, "StopWordsTokenizer", {
            enumerable: !0,
            get: function() {
                return _index4.StopWordsTokenizer;
            }
        });
        var _Search = __webpack_require__(6);
        Object.defineProperty(exports, "Search", {
            enumerable: !0,
            get: function() {
                return _Search.Search;
            }
        });
        var _StopWordsMap = __webpack_require__(3);
        Object.defineProperty(exports, "StopWordsMap", {
            enumerable: !0,
            get: function() {
                return _StopWordsMap.StopWordsMap;
            }
        });
        var _TokenHighlighter = __webpack_require__(7);
        Object.defineProperty(exports, "TokenHighlighter", {
            enumerable: !0,
            get: function() {
                return _TokenHighlighter.TokenHighlighter;
            }
        });
    } ]);
});