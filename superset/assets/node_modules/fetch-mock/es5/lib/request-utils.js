'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _defineProperty2 = require('babel-runtime/helpers/defineProperty');

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _iterator = require('babel-runtime/core-js/symbol/iterator');

var _iterator2 = _interopRequireDefault(_iterator);

var _entries = require('babel-runtime/core-js/object/entries');

var _entries2 = _interopRequireDefault(_entries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var URL = require('whatwg-url');
// https://stackoverflow.com/a/19709846/308237
var absoluteUrlRX = new RegExp('^(?:[a-z]+:)?//', 'i');

var headersToArray = function headersToArray(headers) {
	// node-fetch 1 Headers
	if (typeof headers.raw === 'function') {
		return (0, _entries2.default)(headers.raw());
	} else if (headers[_iterator2.default]) {
		return [].concat((0, _toConsumableArray3.default)(headers));
	} else {
		return (0, _entries2.default)(headers);
	}
};

var zipObject = function zipObject(entries) {
	return entries.reduce(function (obj, _ref) {
		var _ref2 = (0, _slicedToArray3.default)(_ref, 2),
		    key = _ref2[0],
		    val = _ref2[1];

		return (0, _assign2.default)(obj, (0, _defineProperty3.default)({}, key, val));
	}, {});
};

var normalizeUrl = function normalizeUrl(url) {
	if (typeof url === 'function' || url instanceof RegExp || /^(begin|end|glob|express|path)\:/.test(url)) {
		return url;
	}
	if (absoluteUrlRX.test(url)) {
		var u = new URL.URL(url);
		return u.href;
	} else {
		var _u = new URL.URL(url, 'http://dummy');
		return _u.pathname + _u.search;
	}
};

module.exports = {
	normalizeRequest: function normalizeRequest(url, options, Request) {
		if (Request.prototype.isPrototypeOf(url)) {
			var obj = {
				url: normalizeUrl(url.url),
				options: {
					method: url.method
				},
				request: url
			};

			var headers = headersToArray(url.headers);

			if (headers.length) {
				obj.options.headers = zipObject(headers);
			}
			return obj;
		} else if (typeof url === 'string' ||
		// horrible URL object duck-typing
		(typeof url === 'undefined' ? 'undefined' : (0, _typeof3.default)(url)) === 'object' && 'href' in url) {
			return {
				url: normalizeUrl(url),
				options: options
			};
		} else if ((typeof url === 'undefined' ? 'undefined' : (0, _typeof3.default)(url)) === 'object') {
			throw new TypeError('fetch-mock: Unrecognised Request object. Read the Config and Installation sections of the docs');
		} else {
			throw new TypeError('fetch-mock: Invalid arguments passed to fetch');
		}
	},
	normalizeUrl: normalizeUrl,
	getPath: function getPath(url) {
		var u = absoluteUrlRX.test(url) ? new URL.URL(url) : new URL.URL(url, 'http://dummy');
		return u.pathname;
	},

	getQuery: function getQuery(url) {
		var u = absoluteUrlRX.test(url) ? new URL.URL(url) : new URL.URL(url, 'http://dummy');
		return u.search ? u.search.substr(1) : '';
	},
	headers: {
		normalize: function normalize(headers) {
			return zipObject(headersToArray(headers));
		},
		toLowerCase: function toLowerCase(headers) {
			return (0, _keys2.default)(headers).reduce(function (obj, k) {
				obj[k.toLowerCase()] = headers[k];
				return obj;
			}, {});
		},
		equal: function equal(actualHeader, expectedHeader) {
			actualHeader = Array.isArray(actualHeader) ? actualHeader : [actualHeader];
			expectedHeader = Array.isArray(expectedHeader) ? expectedHeader : [expectedHeader];

			if (actualHeader.length !== expectedHeader.length) {
				return false;
			}

			return actualHeader.every(function (val, i) {
				return val === expectedHeader[i];
			});
		}
	}
};