"use strict";

exports.__esModule = true;
exports.default = void 0;

var _cssSyntaxError = _interopRequireDefault(require("./css-syntax-error"));

var _previousMap = _interopRequireDefault(require("./previous-map"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var sequence = 0;
/**
 * Represents the source CSS.
 *
 * @example
 * const root  = postcss.parse(css, { from: file })
 * const input = root.source.input
 */

var Input =
/*#__PURE__*/
function () {
  /**
   * @param {string} css    Input CSS source.
   * @param {object} [opts] {@link Processor#process} options.
   */
  function Input(css, opts) {
    if (opts === void 0) {
      opts = {};
    }

    if (css === null || typeof css === 'object' && !css.toString) {
      throw new Error("PostCSS received " + css + " instead of CSS string");
    }
    /**
     * Input CSS source
     *
     * @type {string}
     *
     * @example
     * const input = postcss.parse('a{}', { from: file }).input
     * input.css //=> "a{}"
     */


    this.css = css.toString();

    if (this.css[0] === "\uFEFF" || this.css[0] === "\uFFFE") {
      this.hasBOM = true;
      this.css = this.css.slice(1);
    } else {
      this.hasBOM = false;
    }

    if (opts.from) {
      if (/^\w+:\/\//.test(opts.from)) {
        /**
         * The absolute path to the CSS source file defined
         * with the `from` option.
         *
         * @type {string}
         *
         * @example
         * const root = postcss.parse(css, { from: 'a.css' })
         * root.source.input.file //=> '/home/ai/a.css'
         */
        this.file = opts.from;
      } else {
        this.file = _path.default.resolve(opts.from);
      }
    }

    var map = new _previousMap.default(this.css, opts);

    if (map.text) {
      /**
       * The input source map passed from a compilation step before PostCSS
       * (for example, from Sass compiler).
       *
       * @type {PreviousMap}
       *
       * @example
       * root.source.input.map.consumer().sources //=> ['a.sass']
       */
      this.map = map;
      var file = map.consumer().file;
      if (!this.file && file) this.file = this.mapResolve(file);
    }

    if (!this.file) {
      sequence += 1;
      /**
       * The unique ID of the CSS source. It will be created if `from` option
       * is not provided (because PostCSS does not know the file path).
       *
       * @type {string}
       *
       * @example
       * const root = postcss.parse(css)
       * root.source.input.file //=> undefined
       * root.source.input.id   //=> "<input css 1>"
       */

      this.id = '<input css ' + sequence + '>';
    }

    if (this.map) this.map.file = this.from;
  }

  var _proto = Input.prototype;

  _proto.error = function error(message, line, column, opts) {
    if (opts === void 0) {
      opts = {};
    }

    var result;
    var origin = this.origin(line, column);

    if (origin) {
      result = new _cssSyntaxError.default(message, origin.line, origin.column, origin.source, origin.file, opts.plugin);
    } else {
      result = new _cssSyntaxError.default(message, line, column, this.css, this.file, opts.plugin);
    }

    result.input = {
      line: line,
      column: column,
      source: this.css
    };
    if (this.file) result.input.file = this.file;
    return result;
  };
  /**
   * Reads the input source map and returns a symbol position
   * in the input source (e.g., in a Sass file that was compiled
   * to CSS before being passed to PostCSS).
   *
   * @param {number} line   Line in input CSS.
   * @param {number} column Column in input CSS.
   *
   * @return {filePosition} Position in input source.
   *
   * @example
   * root.source.input.origin(1, 1) //=> { file: 'a.css', line: 3, column: 1 }
   */


  _proto.origin = function origin(line, column) {
    if (!this.map) return false;
    var consumer = this.map.consumer();
    var from = consumer.originalPositionFor({
      line: line,
      column: column
    });
    if (!from.source) return false;
    var result = {
      file: this.mapResolve(from.source),
      line: from.line,
      column: from.column
    };
    var source = consumer.sourceContentFor(from.source);
    if (source) result.source = source;
    return result;
  };

  _proto.mapResolve = function mapResolve(file) {
    if (/^\w+:\/\//.test(file)) {
      return file;
    }

    return _path.default.resolve(this.map.consumer().sourceRoot || '.', file);
  };
  /**
   * The CSS source identifier. Contains {@link Input#file} if the user
   * set the `from` option, or {@link Input#id} if they did not.
   *
   * @type {string}
   *
   * @example
   * const root = postcss.parse(css, { from: 'a.css' })
   * root.source.input.from //=> "/home/ai/a.css"
   *
   * const root = postcss.parse(css)
   * root.source.input.from //=> "<input css 1>"
   */


  _createClass(Input, [{
    key: "from",
    get: function get() {
      return this.file || this.id;
    }
  }]);

  return Input;
}();

var _default = Input;
/**
 * @typedef  {object} filePosition
 * @property {string} file   Path to file.
 * @property {number} line   Source line in file.
 * @property {number} column Source column in file.
 */

exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmVzNiJdLCJuYW1lcyI6WyJzZXF1ZW5jZSIsIklucHV0IiwiY3NzIiwib3B0cyIsInRvU3RyaW5nIiwiRXJyb3IiLCJoYXNCT00iLCJzbGljZSIsImZyb20iLCJ0ZXN0IiwiZmlsZSIsInBhdGgiLCJyZXNvbHZlIiwibWFwIiwiUHJldmlvdXNNYXAiLCJ0ZXh0IiwiY29uc3VtZXIiLCJtYXBSZXNvbHZlIiwiaWQiLCJlcnJvciIsIm1lc3NhZ2UiLCJsaW5lIiwiY29sdW1uIiwicmVzdWx0Iiwib3JpZ2luIiwiQ3NzU3ludGF4RXJyb3IiLCJzb3VyY2UiLCJwbHVnaW4iLCJpbnB1dCIsIm9yaWdpbmFsUG9zaXRpb25Gb3IiLCJzb3VyY2VDb250ZW50Rm9yIiwic291cmNlUm9vdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTs7QUFDQTs7QUFFQTs7Ozs7Ozs7QUFFQSxJQUFJQSxRQUFRLEdBQUcsQ0FBZjtBQUVBOzs7Ozs7OztJQU9NQyxLOzs7QUFDSjs7OztBQUlBLGlCQUFhQyxHQUFiLEVBQWtCQyxJQUFsQixFQUE4QjtBQUFBLFFBQVpBLElBQVk7QUFBWkEsTUFBQUEsSUFBWSxHQUFMLEVBQUs7QUFBQTs7QUFDNUIsUUFBSUQsR0FBRyxLQUFLLElBQVIsSUFBaUIsT0FBT0EsR0FBUCxLQUFlLFFBQWYsSUFBMkIsQ0FBQ0EsR0FBRyxDQUFDRSxRQUFyRCxFQUFnRTtBQUM5RCxZQUFNLElBQUlDLEtBQUosdUJBQStCSCxHQUEvQiw0QkFBTjtBQUNEO0FBRUQ7Ozs7Ozs7Ozs7O0FBU0EsU0FBS0EsR0FBTCxHQUFXQSxHQUFHLENBQUNFLFFBQUosRUFBWDs7QUFFQSxRQUFJLEtBQUtGLEdBQUwsQ0FBUyxDQUFULE1BQWdCLFFBQWhCLElBQTRCLEtBQUtBLEdBQUwsQ0FBUyxDQUFULE1BQWdCLFFBQWhELEVBQTBEO0FBQ3hELFdBQUtJLE1BQUwsR0FBYyxJQUFkO0FBQ0EsV0FBS0osR0FBTCxHQUFXLEtBQUtBLEdBQUwsQ0FBU0ssS0FBVCxDQUFlLENB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VixFQUFrQixPQUFPLEtBQVA7QUFFbEIsUUFBSUgsTUFBTSxHQUFHO0FBQ1hiLE1BQUFBLElBQUksRUFBRSxLQUFLTyxVQUFMLENBQWdCVCxJQUFJLENBQUNrQixNQUFyQixDQURLO0FBRVhMLE1BQUFBLElBQUksRUFBRWIsSUFBSSxDQUFDYSxJQUZBO0FBR1hDLE1BQUFBLE1BQU0sRUFBRWQsSUFBSSxDQUFDYztBQUhGLEtBQWI7QUFNQSxRQUFJSSxNQUFNLEdBQUdWLFFBQVEsQ0FBQ2MsZ0JBQVQsQ0FBMEJ0QixJQUFJLENBQUNrQixNQUEvQixDQUFiO0FBQ0EsUUFBSUEsTUFBSixFQUFZSCxNQUFNLENBQUNHLE1BQVAsR0FBZ0JBLE1BQWhCO0FBRVosV0FBT0gsTUFBUDtBQUNELEc7O1NBRUROLFUsdUJBQVlQLEksRUFBTTtBQUNoQixRQUFJLFlBQVlELElBQVosQ0FBaUJDLElBQWpCLENBQUosRUFBNEI7QUFDMUIsYUFBT0EsSUFBUDtBQUNEOztBQUNELFdBQU9DLGNBQUtDLE9BQUwsQ0FBYSxLQUFLQyxHQUFMLENBQVNHLFFBQVQsR0FBb0JlLFVBQXBCLElBQWtDLEdBQS9DLEVBQW9EckIsSUFBcEQsQ0FBUDtBQUNELEc7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7d0JBYVk7QUFDVixhQUFPLEtBQUtBLElBQUwsSUFBYSxLQUFLUSxFQUF6QjtBQUNEOzs7Ozs7ZUFHWWpCLEs7QUFFZiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBDc3NTeW50YXhFcnJvciBmcm9tICcuL2Nzcy1zeW50YXgtZXJyb3InXG5pbXBvcnQgUHJldmlvdXNNYXAgZnJvbSAnLi9wcmV2aW91cy1tYXAnXG5cbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5cbmxldCBzZXF1ZW5jZSA9IDBcblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBzb3VyY2UgQ1NTLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCByb290ICA9IHBvc3Rjc3MucGFyc2UoY3NzLCB7IGZyb206IGZpbGUgfSlcbiAqIGNvbnN0IGlucHV0ID0gcm9vdC5zb3VyY2UuaW5wdXRcbiAqL1xuY2xhc3MgSW5wdXQge1xuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IGNzcyAgICBJbnB1dCBDU1Mgc291cmNlLlxuICAgKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIHtAbGluayBQcm9jZXNzb3IjcHJvY2Vzc30gb3B0aW9ucy5cbiAgICovXG4gIGNvbnN0cnVjdG9yIChjc3MsIG9wdHMgPSB7IH0pIHtcbiAgICBpZiAoY3NzID09PSBudWxsIHx8ICh0eXBlb2YgY3NzID09PSAnb2JqZWN0JyAmJiAhY3NzLnRvU3RyaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb3N0Q1NTIHJlY2VpdmVkICR7IGNzcyB9IGluc3RlYWQgb2YgQ1NTIHN0cmluZ2ApXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5wdXQgQ1NTIHNvdXJjZVxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgaW5wdXQgPSBwb3N0Y3NzLnBhcnNlKCdhe30nLCB7IGZyb206IGZpbGUgfSkuaW5wdXRcbiAgICAgKiBpbnB1dC5jc3MgLy89PiBcImF7fVwiXG4gICAgICovXG4gICAgdGhpcy5jc3MgPSBjc3MudG9TdHJpbmcoKVxuXG4gICAgaWYgKHRoaXMuY3NzWzBdID09PSAnXFx1RkVGRicgfHwgdGhpcy5jc3NbMF0gPT09ICdcXHVGRkZFJykge1xuICAgICAgdGhpcy5oYXNCT00gPSB0cnVlXG4gICAgICB0aGlzLmNzcyA9IHRoaXMuY3NzLnNsaWNlKDEpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaGFzQk9NID0gZmFsc2VcbiAgICB9XG5cbiAgICBpZiAob3B0cy5mcm9tKSB7XG4gICAgICBpZiAoL15cXHcrOlxcL1xcLy8udGVzdChvcHRzLmZyb20pKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgQ1NTIHNvdXJjZSBmaWxlIGRlZmluZWRcbiAgICAgICAgICogd2l0aCB0aGUgYGZyb21gIG9wdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogY29uc3Qgcm9vdCA9IHBvc3Rjc3MucGFyc2UoY3NzLCB7IGZyb206ICdhLmNzcycgfSlcbiAgICAgICAgICogcm9vdC5zb3VyY2UuaW5wdXQuZmlsZSAvLz0+ICcvaG9tZS9haS9hLmNzcydcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZmlsZSA9IG9wdHMuZnJvbVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5maWxlID0gcGF0aC5yZXNvbHZlKG9wdHMuZnJvbSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgbWFwID0gbmV3IFByZXZpb3VzTWFwKHRoaXMuY3NzLCBvcHRzKVxuICAgIGlmIChtYXAudGV4dCkge1xuICAgICAgLyoqXG4gICAgICAgKiBUaGUgaW5wdXQgc291cmNlIG1hcCBwYXNzZWQgZnJvbSBhIGNvbXBpbGF0aW9uIHN0ZXAgYmVmb3JlIFBvc3RDU1NcbiAgICAgICAqIChmb3IgZXhhbXBsZSwgZnJvbSBTYXNzIGNvbXBpbGVyKS5cbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7UHJldmlvdXNNYXB9XG4gICAgICAgKlxuICAgICAgICogQGV4YW1wbGVcbiAgICAgICAqIHJvb3Quc291cmNlLmlucHV0Lm1hcC5jb25zdW1lcigpLnNvdXJjZXMgLy89PiBbJ2Euc2FzcyddXG4gICAgICAgKi9cbiAgICAgIHRoaXMubWFwID0gbWFwXG4gICAgICBsZXQgZmlsZSA9IG1hcC5jb25zdW1lcigpLmZpbGVcbiAgICAgIGlmICghdGhpcy5maWxlICYmIGZpbGUpIHRoaXMuZmlsZSA9IHRoaXMubWFwUmVzb2x2ZShmaWxlKVxuICAgIH1cblxuICAgIGlmICghdGhpcy5maWxlKSB7XG4gICAgICBzZXF1ZW5jZSArPSAxXG4gICAgICAvKipcbiAgICAgICAqIFRoZSB1bmlxdWUgSUQgb2YgdGhlIENTUyBzb3VyY2UuIEl0IHdpbGwgYmUgY3JlYXRlZCBpZiBgZnJvbWAgb3B0aW9uXG4gICAgICAgKiBpcyBub3QgcHJvdmlkZWQgKGJlY2F1c2UgUG9zdENTUyBkb2VzIG5vdCBrbm93IHRoZSBmaWxlIHBhdGgpLlxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgKlxuICAgICAgICogQGV4YW1wbGVcbiAgICAgICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKGNzcylcbiAgICAgICAqIHJvb3Quc291cmNlLmlucHV0LmZpbGUgLy89PiB1bmRlZmluZWRcbiAgICAgICAqIHJvb3Quc291cmNlLmlucHV0LmlkICAgLy89PiBcIjxpbnB1dCBjc3MgMT5cIlxuICAgICAgICovXG4gICAgICB0aGlzLmlkID0gJzxpbnB1dCBjc3MgJyArIHNlcXVlbmNlICsgJz4nXG4gICAgfVxuICAgIGlmICh0aGlzLm1hcCkgdGhpcy5tYXAuZmlsZSA9IHRoaXMuZnJvbVxuICB9XG5cbiAgZXJyb3IgKG1lc3NhZ2UsIGxpbmUsIGNvbHVtbiwgb3B0cyA9IHsgfSkge1xuICAgIGxldCByZXN1bHRcbiAgICBsZXQgb3JpZ2luID0gdGhpcy5vcmlnaW4obGluZSwgY29sdW1uKVxuICAgIGlmIChvcmlnaW4pIHtcbiAgICAgIHJlc3VsdCA9IG5ldyBDc3NTeW50YXhFcnJvcihcbiAgICAgICAgbWVzc2FnZSwgb3JpZ2luLmxpbmUsIG9yaWdpbi5jb2x1bW4sXG4gICAgICAgIG9yaWdpbi5zb3VyY2UsIG9yaWdpbi5maWxlLCBvcHRzLnBsdWdpblxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBuZXcgQ3NzU3ludGF4RXJyb3IoXG4gICAgICAgIG1lc3NhZ2UsIGxpbmUsIGNvbHVtbiwgdGhpcy5jc3MsIHRoaXMuZmlsZSwgb3B0cy5wbHVnaW4pXG4gICAgfVxuXG4gICAgcmVzdWx0LmlucHV0ID0geyBsaW5lLCBjb2x1bW4sIHNvdXJjZTogdGhpcy5jc3MgfVxuICAgIGlmICh0aGlzLmZpbGUpIHJlc3VsdC5pbnB1dC5maWxlID0gdGhpcy5maWxlXG5cbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICAvKipcbiAgICogUmVhZHMgdGhlIGlucHV0IHNvdXJjZSBtYXAgYW5kIHJldHVybnMgYSBzeW1ib2wgcG9zaXRpb25cbiAgICogaW4gdGhlIGlucHV0IHNvdXJjZSAoZS5nLiwgaW4gYSBTYXNzIGZpbGUgdGhhdCB3YXMgY29tcGlsZWRcbiAgICogdG8gQ1NTIGJlZm9yZSBiZWluZyBwYXNzZWQgdG8gUG9zdENTUykuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBsaW5lICAgTGluZSBpbiBpbnB1dCBDU1MuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBjb2x1bW4gQ29sdW1uIGluIGlucHV0IENTUy5cbiAgICpcbiAgICogQHJldHVybiB7ZmlsZVBvc2l0aW9ufSBQb3NpdGlvbiBpbiBpbnB1dCBzb3VyY2UuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHJvb3Quc291cmNlLmlucHV0Lm9yaWdpbigxLCAxKSAvLz0+IHsgZmlsZTogJ2EuY3NzJywgbGluZTogMywgY29sdW1uOiAxIH1cbiAgICovXG4gIG9yaWdpbiAobGluZSwgY29sdW1uKSB7XG4gICAgaWYgKCF0aGlzLm1hcCkgcmV0dXJuIGZhbHNlXG4gICAgbGV0IGNvbnN1bWVyID0gdGhpcy5tYXAuY29uc3VtZXIoKVxuXG4gICAgbGV0IGZyb20gPSBjb25zdW1lci5vcmlnaW5hbFBvc2l0aW9uRm9yKHsgbGluZSwgY29sdW1uIH0pXG4gICAgaWYgKCFmcm9tLnNvdXJjZSkgcmV0dXJuIGZhbHNlXG5cbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgZmlsZTogdGhpcy5tYXBSZXNvbHZlKGZyb20uc291cmNlKSxcbiAgICAgIGxpbmU6IGZyb20ubGluZSxcbiAgICAgIGNvbHVtbjogZnJvbS5jb2x1bW5cbiAgICB9XG5cbiAgICBsZXQgc291cmNlID0gY29uc3VtZXIuc291cmNlQ29udGVudEZvcihmcm9tLnNvdXJjZSlcbiAgICBpZiAoc291cmNlKSByZXN1bHQuc291cmNlID0gc291cmNlXG5cbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICBtYXBSZXNvbHZlIChmaWxlKSB7XG4gICAgaWYgKC9eXFx3KzpcXC9cXC8vLnRlc3QoZmlsZSkpIHtcbiAgICAgIHJldHVybiBmaWxlXG4gICAgfVxuICAgIHJldHVybiBwYXRoLnJlc29sdmUodGhpcy5tYXAuY29uc3VtZXIoKS5zb3VyY2VSb290IHx8ICcuJywgZmlsZSlcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgQ1NTIHNvdXJjZSBpZGVudGlmaWVyLiBDb250YWlucyB7QGxpbmsgSW5wdXQjZmlsZX0gaWYgdGhlIHVzZXJcbiAgICogc2V0IHRoZSBgZnJvbWAgb3B0aW9uLCBvciB7QGxpbmsgSW5wdXQjaWR9IGlmIHRoZXkgZGlkIG5vdC5cbiAgICpcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3Qgcm9vdCA9IHBvc3Rjc3MucGFyc2UoY3NzLCB7IGZyb206ICdhLmNzcycgfSlcbiAgICogcm9vdC5zb3VyY2UuaW5wdXQuZnJvbSAvLz0+IFwiL2hvbWUvYWkvYS5jc3NcIlxuICAgKlxuICAgKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZShjc3MpXG4gICAqIHJvb3Quc291cmNlLmlucHV0LmZyb20gLy89PiBcIjxpbnB1dCBjc3MgMT5cIlxuICAgKi9cbiAgZ2V0IGZyb20gKCkge1xuICAgIHJldHVybiB0aGlzLmZpbGUgfHwgdGhpcy5pZFxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IElucHV0XG5cbi8qKlxuICogQHR5cGVkZWYgIHtvYmplY3R9IGZpbGVQb3NpdGlvblxuICogQHByb3BlcnR5IHtzdHJpbmd9IGZpbGUgICBQYXRoIHRvIGZpbGUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGluZSAgIFNvdXJjZSBsaW5lIGluIGZpbGUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29sdW1uIFNvdXJjZSBjb2x1bW4gaW4gZmlsZS5cbiAqL1xuIl0sImZpbGUiOiJpbnB1dC5qcyJ9
