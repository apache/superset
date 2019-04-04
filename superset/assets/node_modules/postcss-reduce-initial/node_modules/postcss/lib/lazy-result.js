"use strict";

exports.__esModule = true;
exports.default = void 0;

var _mapGenerator = _interopRequireDefault(require("./map-generator"));

var _stringify2 = _interopRequireDefault(require("./stringify"));

var _warnOnce = _interopRequireDefault(require("./warn-once"));

var _result = _interopRequireDefault(require("./result"));

var _parse = _interopRequireDefault(require("./parse"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function isPromise(obj) {
  return typeof obj === 'object' && typeof obj.then === 'function';
}
/**
 * A Promise proxy for the result of PostCSS transformations.
 *
 * A `LazyResult` instance is returned by {@link Processor#process}.
 *
 * @example
 * const lazy = postcss([autoprefixer]).process(css)
 */


var LazyResult =
/*#__PURE__*/
function () {
  function LazyResult(processor, css, opts) {
    this.stringified = false;
    this.processed = false;
    var root;

    if (typeof css === 'object' && css !== null && css.type === 'root') {
      root = css;
    } else if (css instanceof LazyResult || css instanceof _result.default) {
      root = css.root;

      if (css.map) {
        if (typeof opts.map === 'undefined') opts.map = {};
        if (!opts.map.inline) opts.map.inline = false;
        opts.map.prev = css.map;
      }
    } else {
      var parser = _parse.default;
      if (opts.syntax) parser = opts.syntax.parse;
      if (opts.parser) parser = opts.parser;
      if (parser.parse) parser = parser.parse;

      try {
        root = parser(css, opts);
      } catch (error) {
        this.error = error;
      }
    }

    this.result = new _result.default(processor, root, opts);
  }
  /**
   * Returns a {@link Processor} instance, which will be used
   * for CSS transformations.
   *
   * @type {Processor}
   */


  var _proto = LazyResult.prototype;

  /**
   * Processes input CSS through synchronous plugins
   * and calls {@link Result#warnings()}.
   *
   * @return {Warning[]} Warnings from plugins.
   */
  _proto.warnings = function warnings() {
    return this.sync().warnings();
  };
  /**
   * Alias for the {@link LazyResult#css} property.
   *
   * @example
   * lazy + '' === lazy.css
   *
   * @return {string} Output CSS.
   */


  _proto.toString = function toString() {
    return this.css;
  };
  /**
   * Processes input CSS through synchronous and asynchronous plugins
   * and calls `onFulfilled` with a Result instance. If a plugin throws
   * an error, the `onRejected` callback will be executed.
   *
   * It implements standard Promise API.
   *
   * @param {onFulfilled} onFulfilled Callback will be executed
   *                                  when all plugins will finish work.
   * @param {onRejected}  onRejected  Callback will be executed on any error.
   *
   * @return {Promise} Promise API to make queue.
   *
   * @example
   * postcss([autoprefixer]).process(css, { from: cssPath }).then(result => {
   *   console.log(result.css)
   * })
   */


  _proto.then = function then(onFulfilled, onRejected) {
    if (process.env.NODE_ENV !== 'production') {
      if (!('from' in this.opts)) {
        (0, _warnOnce.default)('Without `from` option PostCSS could generate wrong source map ' + 'and will not find Browserslist config. Set it to CSS file path ' + 'or to `undefined` to prevent this warning.');
      }
    }

    return this.async().then(onFulfilled, onRejected);
  };
  /**
   * Processes input CSS through synchronous and asynchronous plugins
   * and calls onRejected for each error thrown in any plugin.
   *
   * It implements standard Promise API.
   *
   * @param {onRejected} onRejected Callback will be executed on any error.
   *
   * @return {Promise} Promise API to make queue.
   *
   * @example
   * postcss([autoprefixer]).process(css).then(result => {
   *   console.log(result.css)
   * }).catch(error => {
   *   console.error(error)
   * })
   */


  _proto.catch = function _catch(onRejected) {
    return this.async().catch(onRejected);
  };
  /**
   * Processes input CSS through synchronous and asynchronous plugins
   * and calls onFinally on any error or when all plugins will finish work.
   *
   * It implements standard Promise API.
   *
   * @param {onFinally} onFinally Callback will be executed on any error or
   *                              when all plugins will finish work.
   *
   * @return {Promise} Promise API to make queue.
   *
   * @example
   * postcss([autoprefixer]).process(css).finally(() => {
   *   console.log('processing ended')
   * })
   */


  _proto.finally = function _finally(onFinally) {
    return this.async().then(onFinally, onFinally);
  };

  _proto.handleError = function handleError(error, plugin) {
    try {
      this.error = error;

      if (error.name === 'CssSyntaxError' && !error.plugin) {
        error.plugin = plugin.postcssPlugin;
        error.setMessage();
      } else if (plugin.postcssVersion) {
        if (process.env.NODE_ENV !== 'production') {
          var pluginName = plugin.postcssPlugin;
          var pluginVer = plugin.postcssVersion;
          var runtimeVer = this.result.processor.version;
          var a = pluginVer.split('.');
          var b = runtimeVer.split('.');

          if (a[0] !== b[0] || parseInt(a[1]) > parseInt(b[1])) {
            console.error('Unknown error from PostCSS plugin. Your current PostCSS ' + 'version is ' + runtimeVer + ', but ' + pluginName + ' uses ' + pluginVer + '. Perhaps this is the source of the error below.');
          }
        }
      }
    } catch (err) {
      if (console && console.error) console.error(err);
    }
  };

  _proto.asyncTick = function asyncTick(resolve, reject) {
    var _this = this;

    if (this.plugin >= this.processor.plugins.length) {
      this.processed = true;
      return resolve();
    }

    try {
      var plugin = this.processor.plugins[this.plugin];
      var promise = this.run(plugin);
      this.plugin += 1;

      if (isPromise(promise)) {
        promise.then(function () {
          _this.asyncTick(resolve, reject);
        }).catch(function (error) {
          _this.handleError(error, plugin);

          _this.processed = true;
          reject(error);
        });
      } else {
        this.asyncTick(resolve, reject);
      }
    } catch (error) {
      this.processed = true;
      reject(error);
    }
  };

  _proto.async = function async() {
    var _this2 = this;

    if (this.processed) {
      return new Promise(function (resolve, reject) {
        if (_this2.error) {
          reject(_this2.error);
        } else {
          resolve(_this2.stringify());
        }
      });
    }

    if (this.processing) {
      return this.processing;
    }

    this.processing = new Promise(function (resolve, reject) {
      if (_this2.error) return reject(_this2.error);
      _this2.plugin = 0;

      _this2.asyncTick(resolve, reject);
    }).then(function () {
      _this2.processed = true;
      return _this2.stringify();
    });
    return this.processing;
  };

  _proto.sync = function sync() {
    if (this.processed) return this.result;
    this.processed = true;

    if (this.processing) {
      throw new Error('Use process(css).then(cb) to work with async plugins');
    }

    if (this.error) throw this.error;

    for (var _iterator = this.result.processor.plugins, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      var plugin = _ref;
      var promise = this.run(plugin);

      if (isPromise(promise)) {
        throw new Error('Use process(css).then(cb) to work with async plugins');
      }
    }

    return this.result;
  };

  _proto.run = function run(plugin) {
    this.result.lastPlugin = plugin;

    try {
      return plugin(this.result.root, this.result);
    } catch (error) {
      this.handleError(error, plugin);
      throw error;
    }
  };

  _proto.stringify = function stringify() {
    if (this.stringified) return this.result;
    this.stringified = true;
    this.sync();
    var opts = this.result.opts;
    var str = _stringify2.default;
    if (opts.syntax) str = opts.syntax.stringify;
    if (opts.stringifier) str = opts.stringifier;
    if (str.stringify) str = str.stringify;
    var map = new _mapGenerator.default(str, this.result.root, this.result.opts);
    var data = map.generate();
    this.result.css = data[0];
    this.result.map = data[1];
    return this.result;
  };

  _createClass(LazyResult, [{
    key: "processor",
    get: function get() {
      return this.result.processor;
    }
    /**
     * Options from the {@link Processor#process} call.
     *
     * @type {processOptions}
     */

  }, {
    key: "opts",
    get: function get() {
      return this.result.opts;
    }
    /**
     * Processes input CSS through synchronous plugins, converts `Root`
     * to a CSS string and returns {@link Result#css}.
     *
     * This property will only work with synchronous plugins.
     * If the processor contains any asynchronous plugins
     * it will throw an error. This is why this method is only
     * for debug purpose, you should always use {@link LazyResult#then}.
     *
     * @type {string}
     * @see Result#css
     */

  }, {
    key: "css",
    get: function get() {
      return this.stringify().css;
    }
    /**
     * An alias for the `css` property. Use it with syntaxes
     * that generate non-CSS output.
     *
     * This property will only work with synchronous plugins.
     * If the processor contains any asynchronous plugins
     * it will throw an error. This is why this method is only
     * for debug purpose, you should always use {@link LazyResult#then}.
     *
     * @type {string}
     * @see Result#content
     */

  }, {
    key: "content",
    get: function get() {
      return this.stringify().content;
    }
    /**
     * Processes input CSS through synchronous plugins
     * and returns {@link Result#map}.
     *
     * This property will only work with synchronous plugins.
     * If the processor contains any asynchronous plugins
     * it will throw an error. This is why this method is only
     * for debug purpose, you should always use {@link LazyResult#then}.
     *
     * @type {SourceMapGenerator}
     * @see Result#map
     */

  }, {
    key: "map",
    get: function get() {
      return this.stringify().map;
    }
    /**
     * Processes input CSS through synchronous plugins
     * and returns {@link Result#root}.
     *
     * This property will only work with synchronous plugins. If the processor
     * contains any asynchronous plugins it will throw an error.
     *
     * This is why this method is only for debug purpose,
     * you should always use {@link LazyResult#then}.
     *
     * @type {Root}
     * @see Result#root
     */

  }, {
    key: "root",
    get: function get() {
      return this.sync().root;
    }
    /**
     * Processes input CSS through synchronous plugins
     * and returns {@link Result#messages}.
     *
     * This property will only work with synchronous plugins. If the processor
     * contains any asynchronous plugins it will throw an error.
     *
     * This is why this method is only for debug purpose,
     * you should always use {@link LazyResult#then}.
     *
     * @type {Message[]}
     * @see Result#messages
     */

  }, {
    key: "messages",
    get: function get() {
      return this.sync().messages;
    }
  }]);

  return LazyResult;
}();

var _default = LazyResult;
/**
 * @callback onFulfilled
 * @param {Result} result
 */

/**
 * @callback onRejected
 * @param {Error} error
 */

exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxhenktcmVzdWx0LmVzNiJdLCJuYW1lcyI6WyJpc1Byb21pc2UiLCJvYmoiLCJ0aGVuIiwiTGF6eVJlc3VsdCIsInByb2Nlc3NvciIsImNzcyIsIm9wdHMiLCJzdHJpbmdpZmllZCIsInByb2Nlc3NlZCIsInJvb3QiLCJ0eXBlIiwiUmVzdWx0IiwibWFwIiwiaW5saW5lIiwicHJldiIsInBhcnNlciIsInBhcnNlIiwic3ludGF4IiwiZXJyb3IiLCJyZXN1bHQiLCJ3YXJuaW5ncyIsInN5bmMiLCJ0b1N0cmluZyIsIm9uRnVsZmlsbGVkIiwib25SZWplY3RlZCIsInByb2Nlc3MiLCJlbnYiLCJOT0RFX0VOViIsImFzeW5jIiwiY2F0Y2giLCJmaW5hbGx5Iiwib25GaW5hbGx5IiwiaGFuZGxlRXJyb3IiLCJwbHVnaW4iLCJuYW1lIiwicG9zdGNzc1BsdWdpbiIsInNldE1lc3NhZ2UiLCJwb3N0Y3NzVmVyc2lvbiIsInBsdWdpbk5hbWUiLCJwbHVnaW5WZXIiLCJydW50aW1lVmVyIiwidmVyc2lvbiIsImEiLCJzcGxpdCIsImIiLCJwYXJzZUludCIsImNvbnNvbGUiLCJlcnIiLCJhc3luY1RpY2siLCJyZXNvbHZlIiwicmVqZWN0IiwicGx1Z2lucyIsImxlbmd0aCIsInByb21pc2UiLCJydW4iLCJQcm9taXNlIiwic3RyaW5naWZ5IiwicHJvY2Vzc2luZyIsIkVycm9yIiwibGFzdFBsdWdpbiIsInN0ciIsInN0cmluZ2lmaWVyIiwiTWFwR2VuZXJhdG9yIiwiZGF0YSIsImdlbmVyYXRlIiwiY29udGVudCIsIm1lc3NhZ2VzIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLFNBQVNBLFNBQVQsQ0FBb0JDLEdBQXBCLEVBQXlCO0FBQ3ZCLFNBQU8sT0FBT0EsR0FBUCxLQUFlLFFBQWYsSUFBMkIsT0FBT0EsR0FBRyxDQUFDQyxJQUFYLEtBQW9CLFVBQXREO0FBQ0Q7QUFFRDs7Ozs7Ozs7OztJQVFNQyxV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QUFMLENBQVlWLElBQWxDLEVBQXdDLEtBQUtVLE1BQUwsQ0FBWWIsSUFBcEQsQ0FBVjtBQUNBLFFBQUl5RCxJQUFJLEdBQUduRCxHQUFHLENBQUNvRCxRQUFKLEVBQVg7QUFDQSxTQUFLN0MsTUFBTCxDQUFZZCxHQUFaLEdBQWtCMEQsSUFBSSxDQUFDLENBQUQsQ0FBdEI7QUFDQSxTQUFLNUMsTUFBTCxDQUFZUCxHQUFaLEdBQWtCbUQsSUFBSSxDQUFDLENBQUQsQ0FBdEI7QUFFQSxXQUFPLEtBQUs1QyxNQUFaO0FBQ0QsRzs7Ozt3QkFqVWdCO0FBQ2YsYUFBTyxLQUFLQSxNQUFMLENBQVlmLFNBQW5CO0FBQ0Q7QUFFRDs7Ozs7Ozs7d0JBS1k7QUFDVixhQUFPLEtBQUtlLE1BQUwsQ0FBWWIsSUFBbkI7QUFDRDtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7d0JBWVc7QUFDVCxhQUFPLEtBQUtrRCxTQUFMLEdBQWlCbkQsR0FBeEI7QUFDRDtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7d0JBWWU7QUFDYixhQUFPLEtBQUttRCxTQUFMLEdBQWlCUyxPQUF4QjtBQUNEO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozt3QkFZVztBQUNULGFBQU8sS0FBS1QsU0FBTCxHQUFpQjVDLEdBQXhCO0FBQ0Q7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozt3QkFhWTtBQUNWLGFBQU8sS0FBS1MsSUFBTCxHQUFZWixJQUFuQjtBQUNEO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7d0JBYWdCO0FBQ2QsYUFBTyxLQUFLWSxJQUFMLEdBQVk2QyxRQUFuQjtBQUNEOzs7Ozs7ZUF1T1kvRCxVO0FBRWY7Ozs7O0FBS0EiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgTWFwR2VuZXJhdG9yIGZyb20gJy4vbWFwLWdlbmVyYXRvcidcbmltcG9ydCBzdHJpbmdpZnkgZnJvbSAnLi9zdHJpbmdpZnknXG5pbXBvcnQgd2Fybk9uY2UgZnJvbSAnLi93YXJuLW9uY2UnXG5pbXBvcnQgUmVzdWx0IGZyb20gJy4vcmVzdWx0J1xuaW1wb3J0IHBhcnNlIGZyb20gJy4vcGFyc2UnXG5cbmZ1bmN0aW9uIGlzUHJvbWlzZSAob2JqKSB7XG4gIHJldHVybiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2Ygb2JqLnRoZW4gPT09ICdmdW5jdGlvbidcbn1cblxuLyoqXG4gKiBBIFByb21pc2UgcHJveHkgZm9yIHRoZSByZXN1bHQgb2YgUG9zdENTUyB0cmFuc2Zvcm1hdGlvbnMuXG4gKlxuICogQSBgTGF6eVJlc3VsdGAgaW5zdGFuY2UgaXMgcmV0dXJuZWQgYnkge0BsaW5rIFByb2Nlc3NvciNwcm9jZXNzfS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbGF6eSA9IHBvc3Rjc3MoW2F1dG9wcmVmaXhlcl0pLnByb2Nlc3MoY3NzKVxuICovXG5jbGFzcyBMYXp5UmVzdWx0IHtcbiAgY29uc3RydWN0b3IgKHByb2Nlc3NvciwgY3NzLCBvcHRzKSB7XG4gICAgdGhpcy5zdHJpbmdpZmllZCA9IGZhbHNlXG4gICAgdGhpcy5wcm9jZXNzZWQgPSBmYWxzZVxuXG4gICAgbGV0IHJvb3RcbiAgICBpZiAodHlwZW9mIGNzcyA9PT0gJ29iamVjdCcgJiYgY3NzICE9PSBudWxsICYmIGNzcy50eXBlID09PSAncm9vdCcpIHtcbiAgICAgIHJvb3QgPSBjc3NcbiAgICB9IGVsc2UgaWYgKGNzcyBpbnN0YW5jZW9mIExhenlSZXN1bHQgfHwgY3NzIGluc3RhbmNlb2YgUmVzdWx0KSB7XG4gICAgICByb290ID0gY3NzLnJvb3RcbiAgICAgIGlmIChjc3MubWFwKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0cy5tYXAgPT09ICd1bmRlZmluZWQnKSBvcHRzLm1hcCA9IHsgfVxuICAgICAgICBpZiAoIW9wdHMubWFwLmlubGluZSkgb3B0cy5tYXAuaW5saW5lID0gZmFsc2VcbiAgICAgICAgb3B0cy5tYXAucHJldiA9IGNzcy5tYXBcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHBhcnNlciA9IHBhcnNlXG4gICAgICBpZiAob3B0cy5zeW50YXgpIHBhcnNlciA9IG9wdHMuc3ludGF4LnBhcnNlXG4gICAgICBpZiAob3B0cy5wYXJzZXIpIHBhcnNlciA9IG9wdHMucGFyc2VyXG4gICAgICBpZiAocGFyc2VyLnBhcnNlKSBwYXJzZXIgPSBwYXJzZXIucGFyc2VcblxuICAgICAgdHJ5IHtcbiAgICAgICAgcm9vdCA9IHBhcnNlcihjc3MsIG9wdHMpXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aGlzLmVycm9yID0gZXJyb3JcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnJlc3VsdCA9IG5ldyBSZXN1bHQocHJvY2Vzc29yLCByb290LCBvcHRzKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB7QGxpbmsgUHJvY2Vzc29yfSBpbnN0YW5jZSwgd2hpY2ggd2lsbCBiZSB1c2VkXG4gICAqIGZvciBDU1MgdHJhbnNmb3JtYXRpb25zLlxuICAgKlxuICAgKiBAdHlwZSB7UHJvY2Vzc29yfVxuICAgKi9cbiAgZ2V0IHByb2Nlc3NvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVzdWx0LnByb2Nlc3NvclxuICB9XG5cbiAgLyoqXG4gICAqIE9wdGlvbnMgZnJvbSB0aGUge0BsaW5rIFByb2Nlc3NvciNwcm9jZXNzfSBjYWxsLlxuICAgKlxuICAgKiBAdHlwZSB7cHJvY2Vzc09wdGlvbnN9XG4gICAqL1xuICBnZXQgb3B0cyAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVzdWx0Lm9wdHNcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgaW5wdXQgQ1NTIHRocm91Z2ggc3luY2hyb25vdXMgcGx1Z2lucywgY29udmVydHMgYFJvb3RgXG4gICAqIHRvIGEgQ1NTIHN0cmluZyBhbmQgcmV0dXJucyB7QGxpbmsgUmVzdWx0I2Nzc30uXG4gICAqXG4gICAqIFRoaXMgcHJvcGVydHkgd2lsbCBvbmx5IHdvcmsgd2l0aCBzeW5jaHJvbm91cyBwbHVnaW5zLlxuICAgKiBJZiB0aGUgcHJvY2Vzc29yIGNvbnRhaW5zIGFueSBhc3luY2hyb25vdXMgcGx1Z2luc1xuICAgKiBpdCB3aWxsIHRocm93IGFuIGVycm9yLiBUaGlzIGlzIHdoeSB0aGlzIG1ldGhvZCBpcyBvbmx5XG4gICAqIGZvciBkZWJ1ZyBwdXJwb3NlLCB5b3Ugc2hvdWxkIGFsd2F5cyB1c2Uge0BsaW5rIExhenlSZXN1bHQjdGhlbn0uXG4gICAqXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqIEBzZWUgUmVzdWx0I2Nzc1xuICAgKi9cbiAgZ2V0IGNzcyAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyaW5naWZ5KCkuY3NzXG4gIH1cblxuICAvKipcbiAgICogQW4gYWxpYXMgZm9yIHRoZSBgY3NzYCBwcm9wZXJ0eS4gVXNlIGl0IHdpdGggc3ludGF4ZXNcbiAgICogdGhhdCBnZW5lcmF0ZSBub24tQ1NTIG91dHB1dC5cbiAgICpcbiAgICogVGhpcyBwcm9wZXJ0eSB3aWxsIG9ubHkgd29yayB3aXRoIHN5bmNocm9ub3VzIHBsdWdpbnMuXG4gICAqIElmIHRoZSBwcm9jZXNzb3IgY29udGFpbnMgYW55IGFzeW5jaHJvbm91cyBwbHVnaW5zXG4gICAqIGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuIFRoaXMgaXMgd2h5IHRoaXMgbWV0aG9kIGlzIG9ubHlcbiAgICogZm9yIGRlYnVnIHB1cnBvc2UsIHlvdSBzaG91bGQgYWx3YXlzIHVzZSB7QGxpbmsgTGF6eVJlc3VsdCN0aGVufS5cbiAgICpcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICogQHNlZSBSZXN1bHQjY29udGVudFxuICAgKi9cbiAgZ2V0IGNvbnRlbnQgKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmluZ2lmeSgpLmNvbnRlbnRcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgaW5wdXQgQ1NTIHRocm91Z2ggc3luY2hyb25vdXMgcGx1Z2luc1xuICAgKiBhbmQgcmV0dXJucyB7QGxpbmsgUmVzdWx0I21hcH0uXG4gICAqXG4gICAqIFRoaXMgcHJvcGVydHkgd2lsbCBvbmx5IHdvcmsgd2l0aCBzeW5jaHJvbm91cyBwbHVnaW5zLlxuICAgKiBJZiB0aGUgcHJvY2Vzc29yIGNvbnRhaW5zIGFueSBhc3luY2hyb25vdXMgcGx1Z2luc1xuICAgKiBpdCB3aWxsIHRocm93IGFuIGVycm9yLiBUaGlzIGlzIHdoeSB0aGlzIG1ldGhvZCBpcyBvbmx5XG4gICAqIGZvciBkZWJ1ZyBwdXJwb3NlLCB5b3Ugc2hvdWxkIGFsd2F5cyB1c2Uge0BsaW5rIExhenlSZXN1bHQjdGhlbn0uXG4gICAqXG4gICAqIEB0eXBlIHtTb3VyY2VNYXBHZW5lcmF0b3J9XG4gICAqIEBzZWUgUmVzdWx0I21hcFxuICAgKi9cbiAgZ2V0IG1hcCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyaW5naWZ5KCkubWFwXG4gIH1cblxuICAvKipcbiAgICogUHJvY2Vzc2VzIGlucHV0IENTUyB0aHJvdWdoIHN5bmNocm9ub3VzIHBsdWdpbnNcbiAgICogYW5kIHJldHVybnMge0BsaW5rIFJlc3VsdCNyb290fS5cbiAgICpcbiAgICogVGhpcyBwcm9wZXJ0eSB3aWxsIG9ubHkgd29yayB3aXRoIHN5bmNocm9ub3VzIHBsdWdpbnMuIElmIHRoZSBwcm9jZXNzb3JcbiAgICogY29udGFpbnMgYW55IGFzeW5jaHJvbm91cyBwbHVnaW5zIGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gICAqXG4gICAqIFRoaXMgaXMgd2h5IHRoaXMgbWV0aG9kIGlzIG9ubHkgZm9yIGRlYnVnIHB1cnBvc2UsXG4gICAqIHlvdSBzaG91bGQgYWx3YXlzIHVzZSB7QGxpbmsgTGF6eVJlc3VsdCN0aGVufS5cbiAgICpcbiAgICogQHR5cGUge1Jvb3R9XG4gICAqIEBzZWUgUmVzdWx0I3Jvb3RcbiAgICovXG4gIGdldCByb290ICgpIHtcbiAgICByZXR1cm4gdGhpcy5zeW5jKCkucm9vdFxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3NlcyBpbnB1dCBDU1MgdGhyb3VnaCBzeW5jaHJvbm91cyBwbHVnaW5zXG4gICAqIGFuZCByZXR1cm5zIHtAbGluayBSZXN1bHQjbWVzc2FnZXN9LlxuICAgKlxuICAgKiBUaGlzIHByb3BlcnR5IHdpbGwgb25seSB3b3JrIHdpdGggc3luY2hyb25vdXMgcGx1Z2lucy4gSWYgdGhlIHByb2Nlc3NvclxuICAgKiBjb250YWlucyBhbnkgYXN5bmNocm9ub3VzIHBsdWdpbnMgaXQgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAgICpcbiAgICogVGhpcyBpcyB3aHkgdGhpcyBtZXRob2QgaXMgb25seSBmb3IgZGVidWcgcHVycG9zZSxcbiAgICogeW91IHNob3VsZCBhbHdheXMgdXNlIHtAbGluayBMYXp5UmVzdWx0I3RoZW59LlxuICAgKlxuICAgKiBAdHlwZSB7TWVzc2FnZVtdfVxuICAgKiBAc2VlIFJlc3VsdCNtZXNzYWdlc1xuICAgKi9cbiAgZ2V0IG1lc3NhZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcy5zeW5jKCkubWVzc2FnZXNcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgaW5wdXQgQ1NTIHRocm91Z2ggc3luY2hyb25vdXMgcGx1Z2luc1xuICAgKiBhbmQgY2FsbHMge0BsaW5rIFJlc3VsdCN3YXJuaW5ncygpfS5cbiAgICpcbiAgICogQHJldHVybiB7V2FybmluZ1tdfSBXYXJuaW5ncyBmcm9tIHBsdWdpbnMuXG4gICAqL1xuICB3YXJuaW5ncyAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luYygpLndhcm5pbmdzKClcbiAgfVxuXG4gIC8qKlxuICAgKiBBbGlhcyBmb3IgdGhlIHtAbGluayBMYXp5UmVzdWx0I2Nzc30gcHJvcGVydHkuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGxhenkgKyAnJyA9PT0gbGF6eS5jc3NcbiAgICpcbiAgICogQHJldHVybiB7c3RyaW5nfSBPdXRwdXQgQ1NTLlxuICAgKi9cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiB0aGlzLmNzc1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3NlcyBpbnB1dCBDU1MgdGhyb3VnaCBzeW5jaHJvbm91cyBhbmQgYXN5bmNocm9ub3VzIHBsdWdpbnNcbiAgICogYW5kIGNhbGxzIGBvbkZ1bGZpbGxlZGAgd2l0aCBhIFJlc3VsdCBpbnN0YW5jZS4gSWYgYSBwbHVnaW4gdGhyb3dzXG4gICAqIGFuIGVycm9yLCB0aGUgYG9uUmVqZWN0ZWRgIGNhbGxiYWNrIHdpbGwgYmUgZXhlY3V0ZWQuXG4gICAqXG4gICAqIEl0IGltcGxlbWVudHMgc3RhbmRhcmQgUHJvbWlzZSBBUEkuXG4gICAqXG4gICAqIEBwYXJhbSB7b25GdWxmaWxsZWR9IG9uRnVsZmlsbGVkIENhbGxiYWNrIHdpbGwgYmUgZXhlY3V0ZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hlbiBhbGwgcGx1Z2lucyB3aWxsIGZpbmlzaCB3b3JrLlxuICAgKiBAcGFyYW0ge29uUmVqZWN0ZWR9ICBvblJlamVjdGVkICBDYWxsYmFjayB3aWxsIGJlIGV4ZWN1dGVkIG9uIGFueSBlcnJvci5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSBBUEkgdG8gbWFrZSBxdWV1ZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcG9zdGNzcyhbYXV0b3ByZWZpeGVyXSkucHJvY2Vzcyhjc3MsIHsgZnJvbTogY3NzUGF0aCB9KS50aGVuKHJlc3VsdCA9PiB7XG4gICAqICAgY29uc29sZS5sb2cocmVzdWx0LmNzcylcbiAgICogfSlcbiAgICovXG4gIHRoZW4gKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGlmICghKCdmcm9tJyBpbiB0aGlzLm9wdHMpKSB7XG4gICAgICAgIHdhcm5PbmNlKFxuICAgICAgICAgICdXaXRob3V0IGBmcm9tYCBvcHRpb24gUG9zdENTUyBjb3VsZCBnZW5lcmF0ZSB3cm9uZyBzb3VyY2UgbWFwICcgK1xuICAgICAgICAgICdhbmQgd2lsbCBub3QgZmluZCBCcm93c2Vyc2xpc3QgY29uZmlnLiBTZXQgaXQgdG8gQ1NTIGZpbGUgcGF0aCAnICtcbiAgICAgICAgICAnb3IgdG8gYHVuZGVmaW5lZGAgdG8gcHJldmVudCB0aGlzIHdhcm5pbmcuJ1xuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFzeW5jKCkudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZClcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgaW5wdXQgQ1NTIHRocm91Z2ggc3luY2hyb25vdXMgYW5kIGFzeW5jaHJvbm91cyBwbHVnaW5zXG4gICAqIGFuZCBjYWxscyBvblJlamVjdGVkIGZvciBlYWNoIGVycm9yIHRocm93biBpbiBhbnkgcGx1Z2luLlxuICAgKlxuICAgKiBJdCBpbXBsZW1lbnRzIHN0YW5kYXJkIFByb21pc2UgQVBJLlxuICAgKlxuICAgKiBAcGFyYW0ge29uUmVqZWN0ZWR9IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgd2lsbCBiZSBleGVjdXRlZCBvbiBhbnkgZXJyb3IuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2UgQVBJIHRvIG1ha2UgcXVldWUuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHBvc3Rjc3MoW2F1dG9wcmVmaXhlcl0pLnByb2Nlc3MoY3NzKS50aGVuKHJlc3VsdCA9PiB7XG4gICAqICAgY29uc29sZS5sb2cocmVzdWx0LmNzcylcbiAgICogfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgKiAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpXG4gICAqIH0pXG4gICAqL1xuICBjYXRjaCAob25SZWplY3RlZCkge1xuICAgIHJldHVybiB0aGlzLmFzeW5jKCkuY2F0Y2gob25SZWplY3RlZClcbiAgfVxuICAvKipcbiAgICogUHJvY2Vzc2VzIGlucHV0IENTUyB0aHJvdWdoIHN5bmNocm9ub3VzIGFuZCBhc3luY2hyb25vdXMgcGx1Z2luc1xuICAgKiBhbmQgY2FsbHMgb25GaW5hbGx5IG9uIGFueSBlcnJvciBvciB3aGVuIGFsbCBwbHVnaW5zIHdpbGwgZmluaXNoIHdvcmsuXG4gICAqXG4gICAqIEl0IGltcGxlbWVudHMgc3RhbmRhcmQgUHJvbWlzZSBBUEkuXG4gICAqXG4gICAqIEBwYXJhbSB7b25GaW5hbGx5fSBvbkZpbmFsbHkgQ2FsbGJhY2sgd2lsbCBiZSBleGVjdXRlZCBvbiBhbnkgZXJyb3Igb3JcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGVuIGFsbCBwbHVnaW5zIHdpbGwgZmluaXNoIHdvcmsuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2UgQVBJIHRvIG1ha2UgcXVldWUuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHBvc3Rjc3MoW2F1dG9wcmVmaXhlcl0pLnByb2Nlc3MoY3NzKS5maW5hbGx5KCgpID0+IHtcbiAgICogICBjb25zb2xlLmxvZygncHJvY2Vzc2luZyBlbmRlZCcpXG4gICAqIH0pXG4gICAqL1xuICBmaW5hbGx5IChvbkZpbmFsbHkpIHtcbiAgICByZXR1cm4gdGhpcy5hc3luYygpLnRoZW4ob25GaW5hbGx5LCBvbkZpbmFsbHkpXG4gIH1cblxuICBoYW5kbGVFcnJvciAoZXJyb3IsIHBsdWdpbikge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmVycm9yID0gZXJyb3JcbiAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQ3NzU3ludGF4RXJyb3InICYmICFlcnJvci5wbHVnaW4pIHtcbiAgICAgICAgZXJyb3IucGx1Z2luID0gcGx1Z2luLnBvc3Rjc3NQbHVnaW5cbiAgICAgICAgZXJyb3Iuc2V0TWVzc2FnZSgpXG4gICAgICB9IGVsc2UgaWYgKHBsdWdpbi5wb3N0Y3NzVmVyc2lvbikge1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIGxldCBwbHVnaW5OYW1lID0gcGx1Z2luLnBvc3Rjc3NQbHVnaW5cbiAgICAgICAgICBsZXQgcGx1Z2luVmVyID0gcGx1Z2luLnBvc3Rjc3NWZXJzaW9uXG4gICAgICAgICAgbGV0IHJ1bnRpbWVWZXIgPSB0aGlzLnJlc3VsdC5wcm9jZXNzb3IudmVyc2lvblxuICAgICAgICAgIGxldCBhID0gcGx1Z2luVmVyLnNwbGl0KCcuJylcbiAgICAgICAgICBsZXQgYiA9IHJ1bnRpbWVWZXIuc3BsaXQoJy4nKVxuXG4gICAgICAgICAgaWYgKGFbMF0gIT09IGJbMF0gfHwgcGFyc2VJbnQoYVsxXSkgPiBwYXJzZUludChiWzFdKSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgJ1Vua25vd24gZXJyb3IgZnJvbSBQb3N0Q1NTIHBsdWdpbi4gWW91ciBjdXJyZW50IFBvc3RDU1MgJyArXG4gICAgICAgICAgICAgICd2ZXJzaW9uIGlzICcgKyBydW50aW1lVmVyICsgJywgYnV0ICcgKyBwbHVnaW5OYW1lICsgJyB1c2VzICcgK1xuICAgICAgICAgICAgICBwbHVnaW5WZXIgKyAnLiBQZXJoYXBzIHRoaXMgaXMgdGhlIHNvdXJjZSBvZiB0aGUgZXJyb3IgYmVsb3cuJ1xuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGNvbnNvbGUgJiYgY29uc29sZS5lcnJvcikgY29uc29sZS5lcnJvcihlcnIpXG4gICAgfVxuICB9XG5cbiAgYXN5bmNUaWNrIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICBpZiAodGhpcy5wbHVnaW4gPj0gdGhpcy5wcm9jZXNzb3IucGx1Z2lucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucHJvY2Vzc2VkID0gdHJ1ZVxuICAgICAgcmV0dXJuIHJlc29sdmUoKVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBsZXQgcGx1Z2luID0gdGhpcy5wcm9jZXNzb3IucGx1Z2luc1t0aGlzLnBsdWdpbl1cbiAgICAgIGxldCBwcm9taXNlID0gdGhpcy5ydW4ocGx1Z2luKVxuICAgICAgdGhpcy5wbHVnaW4gKz0gMVxuXG4gICAgICBpZiAoaXNQcm9taXNlKHByb21pc2UpKSB7XG4gICAgICAgIHByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hc3luY1RpY2socmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnJvciwgcGx1Z2luKVxuICAgICAgICAgIHRoaXMucHJvY2Vzc2VkID0gdHJ1ZVxuICAgICAgICAgIHJlamVjdChlcnJvcilcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYXN5bmNUaWNrKHJlc29sdmUsIHJlamVjdClcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5wcm9jZXNzZWQgPSB0cnVlXG4gICAgICByZWplY3QoZXJyb3IpXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgKCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3NlZCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QodGhpcy5lcnJvcilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuc3RyaW5naWZ5KCkpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIGlmICh0aGlzLnByb2Nlc3NpbmcpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb2Nlc3NpbmdcbiAgICB9XG5cbiAgICB0aGlzLnByb2Nlc3NpbmcgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodGhpcy5lcnJvcikgcmV0dXJuIHJlamVjdCh0aGlzLmVycm9yKVxuICAgICAgdGhpcy5wbHVnaW4gPSAwXG4gICAgICB0aGlzLmFzeW5jVGljayhyZXNvbHZlLCByZWplY3QpXG4gICAgfSkudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLnByb2Nlc3NlZCA9IHRydWVcbiAgICAgIHJldHVybiB0aGlzLnN0cmluZ2lmeSgpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzLnByb2Nlc3NpbmdcbiAgfVxuXG4gIHN5bmMgKCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3NlZCkgcmV0dXJuIHRoaXMucmVzdWx0XG4gICAgdGhpcy5wcm9jZXNzZWQgPSB0cnVlXG5cbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdVc2UgcHJvY2Vzcyhjc3MpLnRoZW4oY2IpIHRvIHdvcmsgd2l0aCBhc3luYyBwbHVnaW5zJylcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lcnJvcikgdGhyb3cgdGhpcy5lcnJvclxuXG4gICAgZm9yIChsZXQgcGx1Z2luIG9mIHRoaXMucmVzdWx0LnByb2Nlc3Nvci5wbHVnaW5zKSB7XG4gICAgICBsZXQgcHJvbWlzZSA9IHRoaXMucnVuKHBsdWdpbilcbiAgICAgIGlmIChpc1Byb21pc2UocHJvbWlzZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdVc2UgcHJvY2Vzcyhjc3MpLnRoZW4oY2IpIHRvIHdvcmsgd2l0aCBhc3luYyBwbHVnaW5zJylcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZXN1bHRcbiAgfVxuXG4gIHJ1biAocGx1Z2luKSB7XG4gICAgdGhpcy5yZXN1bHQubGFzdFBsdWdpbiA9IHBsdWdpblxuXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBwbHVnaW4odGhpcy5yZXN1bHQucm9vdCwgdGhpcy5yZXN1bHQpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyb3IsIHBsdWdpbilcbiAgICAgIHRocm93IGVycm9yXG4gICAgfVxuICB9XG5cbiAgc3RyaW5naWZ5ICgpIHtcbiAgICBpZiAodGhpcy5zdHJpbmdpZmllZCkgcmV0dXJuIHRoaXMucmVzdWx0XG4gICAgdGhpcy5zdHJpbmdpZmllZCA9IHRydWVcblxuICAgIHRoaXMuc3luYygpXG5cbiAgICBsZXQgb3B0cyA9IHRoaXMucmVzdWx0Lm9wdHNcbiAgICBsZXQgc3RyID0gc3RyaW5naWZ5XG4gICAgaWYgKG9wdHMuc3ludGF4KSBzdHIgPSBvcHRzLnN5bnRheC5zdHJpbmdpZnlcbiAgICBpZiAob3B0cy5zdHJpbmdpZmllcikgc3RyID0gb3B0cy5zdHJpbmdpZmllclxuICAgIGlmIChzdHIuc3RyaW5naWZ5KSBzdHIgPSBzdHIuc3RyaW5naWZ5XG5cbiAgICBsZXQgbWFwID0gbmV3IE1hcEdlbmVyYXRvcihzdHIsIHRoaXMucmVzdWx0LnJvb3QsIHRoaXMucmVzdWx0Lm9wdHMpXG4gICAgbGV0IGRhdGEgPSBtYXAuZ2VuZXJhdGUoKVxuICAgIHRoaXMucmVzdWx0LmNzcyA9IGRhdGFbMF1cbiAgICB0aGlzLnJlc3VsdC5tYXAgPSBkYXRhWzFdXG5cbiAgICByZXR1cm4gdGhpcy5yZXN1bHRcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMYXp5UmVzdWx0XG5cbi8qKlxuICogQGNhbGxiYWNrIG9uRnVsZmlsbGVkXG4gKiBAcGFyYW0ge1Jlc3VsdH0gcmVzdWx0XG4gKi9cblxuLyoqXG4gKiBAY2FsbGJhY2sgb25SZWplY3RlZFxuICogQHBhcmFtIHtFcnJvcn0gZXJyb3JcbiAqL1xuIl0sImZpbGUiOiJsYXp5LXJlc3VsdC5qcyJ9
