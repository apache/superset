import "core-js/modules/es.array.filter";
import "core-js/modules/es.array.slice";
import "core-js/modules/es.array.some";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

export var CACHE_PREFIX = 'react-avatar/';
export var CACHE_KEY_FAILING = 'failing';

var _hasLocalStorage = function isLocalStorageAvailable() {
  try {
    return 'localStorage' in window && window['localStorage'];
  } catch (err) {
    return false;
  }
}();

export var Cache = /*#__PURE__*/function () {
  function Cache() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Cache);

    var _options$cachePrefix = options.cachePrefix,
        cachePrefix = _options$cachePrefix === void 0 ? CACHE_PREFIX : _options$cachePrefix,
        _options$sourceTTL = options.sourceTTL,
        sourceTTL = _options$sourceTTL === void 0 ? 7 * 24 * 3600 * 1000 : _options$sourceTTL,
        _options$sourceSize = options.sourceSize,
        sourceSize = _options$sourceSize === void 0 ? 20 : _options$sourceSize;
    this.cachePrefix = cachePrefix;
    this.sourceTTL = sourceTTL;
    this.sourceSize = sourceSize;
  }

  _createClass(Cache, [{
    key: "set",
    value: function set(key, value) {
      // cache not available
      if (!_hasLocalStorage) return;
      value = JSON.stringify(value);

      try {
        localStorage.setItem(this.cachePrefix + key, value);
      } catch (e) {
        // failsafe for mobile Safari private mode
        console.error(e); // eslint-disable-line no-console
      }
    }
  }, {
    key: "get",
    value: function get(key) {
      // cache not available
      if (!_hasLocalStorage) return null;
      var value = localStorage.getItem(this.cachePrefix + key);
      if (value) return JSON.parse(value);
      return null;
    }
  }, {
    key: "sourceFailed",
    value: function sourceFailed(source) {
      var cacheList = this.get(CACHE_KEY_FAILING) || []; // Remove expired entries or previous instances of this source

      cacheList = cacheList.filter(function (entry) {
        var hasExpired = entry.expires > 0 && entry.expires < Date.now();
        var isMatch = entry === source || entry.url == source;
        return !hasExpired && !isMatch;
      }); // Add the source to the end of the list

      cacheList.unshift({
        url: source,
        expires: Date.now() + this.sourceTTL
      }); // only keep the last X results so we don't fill up local storage

      cacheList = cacheList.slice(0, this.sourceSize - 1);
      return this.set(CACHE_KEY_FAILING, cacheList);
    }
  }, {
    key: "hasSourceFailedBefore",
    value: function hasSourceFailedBefore(source) {
      var cacheList = this.get(CACHE_KEY_FAILING) || [];
      return cacheList.some(function (entry) {
        var hasExpired = entry.expires > 0 && entry.expires < Date.now();
        var isMatch = entry === source || entry.url == source;
        return isMatch && !hasExpired;
      });
    }
  }]);

  return Cache;
}();
export default new Cache();