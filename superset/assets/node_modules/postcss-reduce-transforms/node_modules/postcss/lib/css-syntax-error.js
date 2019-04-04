"use strict";

exports.__esModule = true;
exports.default = void 0;

var _supportsColor = _interopRequireDefault(require("supports-color"));

var _chalk = _interopRequireDefault(require("chalk"));

var _terminalHighlight = _interopRequireDefault(require("./terminal-highlight"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The CSS parser throws this error for broken CSS.
 *
 * Custom parsers can throw this error for broken custom syntax using
 * the {@link Node#error} method.
 *
 * PostCSS will use the input source map to detect the original error location.
 * If you wrote a Sass file, compiled it to CSS and then parsed it with PostCSS,
 * PostCSS will show the original position in the Sass file.
 *
 * If you need the position in the PostCSS input
 * (e.g., to debug the previous compiler), use `error.input.file`.
 *
 * @example
 * // Catching and checking syntax error
 * try {
 *   postcss.parse('a{')
 * } catch (error) {
 *   if (error.name === 'CssSyntaxError') {
 *     error //=> CssSyntaxError
 *   }
 * }
 *
 * @example
 * // Raising error from plugin
 * throw node.error('Unknown variable', { plugin: 'postcss-vars' })
 */
var CssSyntaxError =
/*#__PURE__*/
function () {
  /**
   * @param {string} message  Error message.
   * @param {number} [line]   Source line of the error.
   * @param {number} [column] Source column of the error.
   * @param {string} [source] Source code of the broken file.
   * @param {string} [file]   Absolute path to the broken file.
   * @param {string} [plugin] PostCSS plugin name, if error came from plugin.
   */
  function CssSyntaxError(message, line, column, source, file, plugin) {
    /**
     * Always equal to `'CssSyntaxError'`. You should always check error type
     * by `error.name === 'CssSyntaxError'`
     * instead of `error instanceof CssSyntaxError`,
     * because npm could have several PostCSS versions.
     *
     * @type {string}
     *
     * @example
     * if (error.name === 'CssSyntaxError') {
     *   error //=> CssSyntaxError
     * }
     */
    this.name = 'CssSyntaxError';
    /**
     * Error message.
     *
     * @type {string}
     *
     * @example
     * error.message //=> 'Unclosed block'
     */

    this.reason = message;

    if (file) {
      /**
       * Absolute path to the broken file.
       *
       * @type {string}
       *
       * @example
       * error.file       //=> 'a.sass'
       * error.input.file //=> 'a.css'
       */
      this.file = file;
    }

    if (source) {
      /**
       * Source code of the broken file.
       *
       * @type {string}
       *
       * @example
       * error.source       //=> 'a { b {} }'
       * error.input.column //=> 'a b { }'
       */
      this.source = source;
    }

    if (plugin) {
      /**
       * Plugin name, if error came from plugin.
       *
       * @type {string}
       *
       * @example
       * error.plugin //=> 'postcss-vars'
       */
      this.plugin = plugin;
    }

    if (typeof line !== 'undefined' && typeof column !== 'undefined') {
      /**
       * Source line of the error.
       *
       * @type {number}
       *
       * @example
       * error.line       //=> 2
       * error.input.line //=> 4
       */
      this.line = line;
      /**
       * Source column of the error.
       *
       * @type {number}
       *
       * @example
       * error.column       //=> 1
       * error.input.column //=> 4
       */

      this.column = column;
    }

    this.setMessage();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CssSyntaxError);
    }
  }

  var _proto = CssSyntaxError.prototype;

  _proto.setMessage = function setMessage() {
    /**
     * Full error text in the GNU error format
     * with plugin, file, line and column.
     *
     * @type {string}
     *
     * @example
     * error.message //=> 'a.css:1:1: Unclosed block'
     */
    this.message = this.plugin ? this.plugin + ': ' : '';
    this.message += this.file ? this.file : '<css input>';

    if (typeof this.line !== 'undefined') {
      this.message += ':' + this.line + ':' + this.column;
    }

    this.message += ': ' + this.reason;
  };
  /**
   * Returns a few lines of CSS source that caused the error.
   *
   * If the CSS has an input source map without `sourceContent`,
   * this method will return an empty string.
   *
   * @param {boolean} [color] Whether arrow will be colored red by terminal
   *                          color codes. By default, PostCSS will detect
   *                          color support by `process.stdout.isTTY`
   *                          and `process.env.NODE_DISABLE_COLORS`.
   *
   * @example
   * error.showSourceCode() //=> "  4 | }
   *                        //      5 | a {
   *                        //    > 6 |   bad
   *                        //        |   ^
   *                        //      7 | }
   *                        //      8 | b {"
   *
   * @return {string} Few lines of CSS source that caused the error.
   */


  _proto.showSourceCode = function showSourceCode(color) {
    var _this = this;

    if (!this.source) return '';
    var css = this.source;

    if (_terminalHighlight.default) {
      if (typeof color === 'undefined') color = _supportsColor.default.stdout;
      if (color) css = (0, _terminalHighlight.default)(css);
    }

    var lines = css.split(/\r?\n/);
    var start = Math.max(this.line - 3, 0);
    var end = Math.min(this.line + 2, lines.length);
    var maxWidth = String(end).length;

    function mark(text) {
      if (color && _chalk.default.red) {
        return _chalk.default.red.bold(text);
      }

      return text;
    }

    function aside(text) {
      if (color && _chalk.default.gray) {
        return _chalk.default.gray(text);
      }

      return text;
    }

    return lines.slice(start, end).map(function (line, index) {
      var number = start + 1 + index;
      var gutter = ' ' + (' ' + number).slice(-maxWidth) + ' | ';

      if (number === _this.line) {
        var spacing = aside(gutter.replace(/\d/g, ' ')) + line.slice(0, _this.column - 1).replace(/[^\t]/g, ' ');
        return mark('>') + aside(gutter) + line + '\n ' + spacing + mark('^');
      }

      return ' ' + aside(gutter) + line;
    }).join('\n');
  };
  /**
   * Returns error position, message and source code of the broken part.
   *
   * @example
   * error.toString() //=> "CssSyntaxError: app.css:1:1: Unclosed block
   *                  //    > 1 | a {
   *                  //        | ^"
   *
   * @return {string} Error position, message and source code.
   */


  _proto.toString = function toString() {
    var code = this.showSourceCode();

    if (code) {
      code = '\n\n' + code + '\n';
    }

    return this.name + ': ' + this.message + code;
  };
  /**
   * @memberof CssSyntaxError#
   * @member {Input} input Input object with PostCSS internal information
   *                       about input file. If input has source map
   *                       from previous tool, PostCSS will use origin
   *                       (for example, Sass) source. You can use this
   *                       object to get PostCSS input source.
   *
   * @example
   * error.input.file //=> 'a.css'
   * error.file       //=> 'a.sass'
   */


  return CssSyntaxError;
}();

var _default = CssSyntaxError;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNzcy1zeW50YXgtZXJyb3IuZXM2Il0sIm5hbWVzIjpbIkNzc1N5bnRheEVycm9yIiwibWVzc2FnZSIsImxpbmUiLCJjb2x1bW4iLCJzb3VyY2UiLCJmaWxlIiwicGx1Z2luIiwibmFtZSIsInJlYXNvbiIsInNldE1lc3NhZ2UiLCJFcnJvciIsImNhcHR1cmVTdGFja1RyYWNlIiwic2hvd1NvdXJjZUNvZGUiLCJjb2xvciIsImNzcyIsInRlcm1pbmFsSGlnaGxpZ2h0Iiwic3VwcG9ydHNDb2xvciIsInN0ZG91dCIsImxpbmVzIiwic3BsaXQiLCJzdGFydCIsIk1hdGgiLCJtYXgiLCJlbmQiLCJtaW4iLCJsZW5ndGgiLCJtYXhXaWR0aCIsIlN0cmluZyIsIm1hcmsiLCJ0ZXh0IiwiY2hhbGsiLCJyZWQiLCJib2xkIiwiYXNpZGUiLCJncmF5Iiwic2xpY2UiLCJtYXAiLCJpbmRleCIsIm51bWJlciIsImd1dHRlciIsInNwYWNpbmciLCJyZXBsYWNlIiwiam9pbiIsInRvU3RyaW5nIiwiY29kZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTs7QUFDQTs7QUFFQTs7OztBQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUEyQk1BLGM7OztBQUNKOzs7Ozs7OztBQVFBLDBCQUFhQyxPQUFiLEVBQXNCQyxJQUF0QixFQUE0QkMsTUFBNUIsRUFBb0NDLE1BQXBDLEVBQTRDQyxJQUE1QyxFQUFrREMsTUFBbEQsRUFBMEQ7QUFDeEQ7Ozs7Ozs7Ozs7Ozs7QUFhQSxTQUFLQyxJQUFMLEdBQVksZ0JBQVo7QUFDQTs7Ozs7Ozs7O0FBUUEsU0FBS0MsTUFBTCxHQUFjUCxPQUFkOztBQUVBLFFBQUlJLElBQUosRUFBVTtBQUNSOzs7Ozs7Ozs7QUFTQSxXQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFDRDs7QUFDRCxRQUFJRCxNQUFKLEVBQVk7QUFDVjs7Ozs7Ozs7O0FBU0EsV0FBS0EsTUFBTCxHQUFjQSxNQUFkO0FBQ0Q7O0FBQ0QsUUFBSUUsTUFBSixFQUFZO0FBQ1Y7Ozs7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QUFJc0MsT0FBTyxHQUFHUCxLQUFLLENBQUNNLE1BQU0sQ0FBQ0UsT0FBUCxDQUFlLEtBQWYsRUFBc0IsR0FBdEIsQ0FBRCxDQUFMLEdBQ1p2QyxJQUFJLENBQUNpQyxLQUFMLENBQVcsQ0FBWCxFQUFjLEtBQUksQ0FBQ2hDLE1BQUwsR0FBYyxDQUE1QixFQUErQnNDLE9BQS9CLENBQXVDLFFBQXZDLEVBQWlELEdBQWpELENBREY7QUFFQSxlQUFPYixJQUFJLENBQUMsR0FBRCxDQUFKLEdBQVlLLEtBQUssQ0FBQ00sTUFBRCxDQUFqQixHQUE0QnJDLElBQTVCLEdBQW1DLEtBQW5DLEdBQTJDc0MsT0FBM0MsR0FBcURaLElBQUksQ0FBQyxHQUFELENBQWhFO0FBQ0Q7O0FBQ0QsYUFBTyxNQUFNSyxLQUFLLENBQUNNLE1BQUQsQ0FBWCxHQUFzQnJDLElBQTdCO0FBQ0QsS0FUTSxFQVNKd0MsSUFUSSxDQVNDLElBVEQsQ0FBUDtBQVVELEc7QUFFRDs7Ozs7Ozs7Ozs7O1NBVUFDLFEsdUJBQVk7QUFDVixRQUFJQyxJQUFJLEdBQUcsS0FBS2hDLGNBQUwsRUFBWDs7QUFDQSxRQUFJZ0MsSUFBSixFQUFVO0FBQ1JBLE1BQUFBLElBQUksR0FBRyxTQUFTQSxJQUFULEdBQWdCLElBQXZCO0FBQ0Q7O0FBQ0QsV0FBTyxLQUFLckMsSUFBTCxHQUFZLElBQVosR0FBbUIsS0FBS04sT0FBeEIsR0FBa0MyQyxJQUF6QztBQUNELEc7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7ZUFjYTVDLGMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgc3VwcG9ydHNDb2xvciBmcm9tICdzdXBwb3J0cy1jb2xvcidcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsaydcblxuaW1wb3J0IHRlcm1pbmFsSGlnaGxpZ2h0IGZyb20gJy4vdGVybWluYWwtaGlnaGxpZ2h0J1xuXG4vKipcbiAqIFRoZSBDU1MgcGFyc2VyIHRocm93cyB0aGlzIGVycm9yIGZvciBicm9rZW4gQ1NTLlxuICpcbiAqIEN1c3RvbSBwYXJzZXJzIGNhbiB0aHJvdyB0aGlzIGVycm9yIGZvciBicm9rZW4gY3VzdG9tIHN5bnRheCB1c2luZ1xuICogdGhlIHtAbGluayBOb2RlI2Vycm9yfSBtZXRob2QuXG4gKlxuICogUG9zdENTUyB3aWxsIHVzZSB0aGUgaW5wdXQgc291cmNlIG1hcCB0byBkZXRlY3QgdGhlIG9yaWdpbmFsIGVycm9yIGxvY2F0aW9uLlxuICogSWYgeW91IHdyb3RlIGEgU2FzcyBmaWxlLCBjb21waWxlZCBpdCB0byBDU1MgYW5kIHRoZW4gcGFyc2VkIGl0IHdpdGggUG9zdENTUyxcbiAqIFBvc3RDU1Mgd2lsbCBzaG93IHRoZSBvcmlnaW5hbCBwb3NpdGlvbiBpbiB0aGUgU2FzcyBmaWxlLlxuICpcbiAqIElmIHlvdSBuZWVkIHRoZSBwb3NpdGlvbiBpbiB0aGUgUG9zdENTUyBpbnB1dFxuICogKGUuZy4sIHRvIGRlYnVnIHRoZSBwcmV2aW91cyBjb21waWxlciksIHVzZSBgZXJyb3IuaW5wdXQuZmlsZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENhdGNoaW5nIGFuZCBjaGVja2luZyBzeW50YXggZXJyb3JcbiAqIHRyeSB7XG4gKiAgIHBvc3Rjc3MucGFyc2UoJ2F7JylcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChlcnJvci5uYW1lID09PSAnQ3NzU3ludGF4RXJyb3InKSB7XG4gKiAgICAgZXJyb3IgLy89PiBDc3NTeW50YXhFcnJvclxuICogICB9XG4gKiB9XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJhaXNpbmcgZXJyb3IgZnJvbSBwbHVnaW5cbiAqIHRocm93IG5vZGUuZXJyb3IoJ1Vua25vd24gdmFyaWFibGUnLCB7IHBsdWdpbjogJ3Bvc3Rjc3MtdmFycycgfSlcbiAqL1xuY2xhc3MgQ3NzU3ludGF4RXJyb3Ige1xuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgIEVycm9yIG1lc3NhZ2UuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbbGluZV0gICBTb3VyY2UgbGluZSBvZiB0aGUgZXJyb3IuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbY29sdW1uXSBTb3VyY2UgY29sdW1uIG9mIHRoZSBlcnJvci5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtzb3VyY2VdIFNvdXJjZSBjb2RlIG9mIHRoZSBicm9rZW4gZmlsZS5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtmaWxlXSAgIEFic29sdXRlIHBhdGggdG8gdGhlIGJyb2tlbiBmaWxlLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gW3BsdWdpbl0gUG9zdENTUyBwbHVnaW4gbmFtZSwgaWYgZXJyb3IgY2FtZSBmcm9tIHBsdWdpbi5cbiAgICovXG4gIGNvbnN0cnVjdG9yIChtZXNzYWdlLCBsaW5lLCBjb2x1bW4sIHNvdXJjZSwgZmlsZSwgcGx1Z2luKSB7XG4gICAgLyoqXG4gICAgICogQWx3YXlzIGVxdWFsIHRvIGAnQ3NzU3ludGF4RXJyb3InYC4gWW91IHNob3VsZCBhbHdheXMgY2hlY2sgZXJyb3IgdHlwZVxuICAgICAqIGJ5IGBlcnJvci5uYW1lID09PSAnQ3NzU3ludGF4RXJyb3InYFxuICAgICAqIGluc3RlYWQgb2YgYGVycm9yIGluc3RhbmNlb2YgQ3NzU3ludGF4RXJyb3JgLFxuICAgICAqIGJlY2F1c2UgbnBtIGNvdWxkIGhhdmUgc2V2ZXJhbCBQb3N0Q1NTIHZlcnNpb25zLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGVycm9yLm5hbWUgPT09ICdDc3NTeW50YXhFcnJvcicpIHtcbiAgICAgKiAgIGVycm9yIC8vPT4gQ3NzU3ludGF4RXJyb3JcbiAgICAgKiB9XG4gICAgICovXG4gICAgdGhpcy5uYW1lID0gJ0Nzc1N5bnRheEVycm9yJ1xuICAgIC8qKlxuICAgICAqIEVycm9yIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlcnJvci5tZXNzYWdlIC8vPT4gJ1VuY2xvc2VkIGJsb2NrJ1xuICAgICAqL1xuICAgIHRoaXMucmVhc29uID0gbWVzc2FnZVxuXG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIC8qKlxuICAgICAgICogQWJzb2x1dGUgcGF0aCB0byB0aGUgYnJva2VuIGZpbGUuXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAqXG4gICAgICAgKiBAZXhhbXBsZVxuICAgICAgICogZXJyb3IuZmlsZSAgICAgICAvLz0+ICdhLnNhc3MnXG4gICAgICAgKiBlcnJvci5pbnB1dC5maWxlIC8vPT4gJ2EuY3NzJ1xuICAgICAgICovXG4gICAgICB0aGlzLmZpbGUgPSBmaWxlXG4gICAgfVxuICAgIGlmIChzb3VyY2UpIHtcbiAgICAgIC8qKlxuICAgICAgICogU291cmNlIGNvZGUgb2YgdGhlIGJyb2tlbiBmaWxlLlxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgKlxuICAgICAgICogQGV4YW1wbGVcbiAgICAgICAqIGVycm9yLnNvdXJjZSAgICAgICAvLz0+ICdhIHsgYiB7fSB9J1xuICAgICAgICogZXJyb3IuaW5wdXQuY29sdW1uIC8vPT4gJ2EgYiB7IH0nXG4gICAgICAgKi9cbiAgICAgIHRoaXMuc291cmNlID0gc291cmNlXG4gICAgfVxuICAgIGlmIChwbHVnaW4pIHtcbiAgICAgIC8qKlxuICAgICAgICogUGx1Z2luIG5hbWUsIGlmIGVycm9yIGNhbWUgZnJvbSBwbHVnaW4uXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAqXG4gICAgICAgKiBAZXhhbXBsZVxuICAgICAgICogZXJyb3IucGx1Z2luIC8vPT4gJ3Bvc3Rjc3MtdmFycydcbiAgICAgICAqL1xuICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW5cbiAgICB9XG4gICAgaWYgKHR5cGVvZiBsaW5lICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgY29sdW1uICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgLyoqXG4gICAgICAgKiBTb3VyY2UgbGluZSBvZiB0aGUgZXJyb3IuXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqXG4gICAgICAgKiBAZXhhbXBsZVxuICAgICAgICogZXJyb3IubGluZSAgICAgICAvLz0+IDJcbiAgICAgICAqIGVycm9yLmlucHV0LmxpbmUgLy89PiA0XG4gICAgICAgKi9cbiAgICAgIHRoaXMubGluZSA9IGxpbmVcbiAgICAgIC8qKlxuICAgICAgICogU291cmNlIGNvbHVtbiBvZiB0aGUgZXJyb3IuXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqXG4gICAgICAgKiBAZXhhbXBsZVxuICAgICAgICogZXJyb3IuY29sdW1uICAgICAgIC8vPT4gMVxuICAgICAgICogZXJyb3IuaW5wdXQuY29sdW1uIC8vPT4gNFxuICAgICAgICovXG4gICAgICB0aGlzLmNvbHVtbiA9IGNvbHVtblxuICAgIH1cblxuICAgIHRoaXMuc2V0TWVzc2FnZSgpXG5cbiAgICBpZiAoRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIENzc1N5bnRheEVycm9yKVxuICAgIH1cbiAgfVxuXG4gIHNldE1lc3NhZ2UgKCkge1xuICAgIC8qKlxuICAgICAqIEZ1bGwgZXJyb3IgdGV4dCBpbiB0aGUgR05VIGVycm9yIGZvcm1hdFxuICAgICAqIHdpdGggcGx1Z2luLCBmaWxlLCBsaW5lIGFuZCBjb2x1bW4uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlcnJvci5tZXNzYWdlIC8vPT4gJ2EuY3NzOjE6MTogVW5jbG9zZWQgYmxvY2snXG4gICAgICovXG4gICAgdGhpcy5tZXNzYWdlID0gdGhpcy5wbHVnaW4gPyB0aGlzLnBsdWdpbiArICc6ICcgOiAnJ1xuICAgIHRoaXMubWVzc2FnZSArPSB0aGlzLmZpbGUgPyB0aGlzLmZpbGUgOiAnPGNzcyBpbnB1dD4nXG4gICAgaWYgKHR5cGVvZiB0aGlzLmxpbmUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgKz0gJzonICsgdGhpcy5saW5lICsgJzonICsgdGhpcy5jb2x1bW5cbiAgICB9XG4gICAgdGhpcy5tZXNzYWdlICs9ICc6ICcgKyB0aGlzLnJlYXNvblxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBmZXcgbGluZXMgb2YgQ1NTIHNvdXJjZSB0aGF0IGNhdXNlZCB0aGUgZXJyb3IuXG4gICAqXG4gICAqIElmIHRoZSBDU1MgaGFzIGFuIGlucHV0IHNvdXJjZSBtYXAgd2l0aG91dCBgc291cmNlQ29udGVudGAsXG4gICAqIHRoaXMgbWV0aG9kIHdpbGwgcmV0dXJuIGFuIGVtcHR5IHN0cmluZy5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIFdoZXRoZXIgYXJyb3cgd2lsbCBiZSBjb2xvcmVkIHJlZCBieSB0ZXJtaW5hbFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgY29kZXMuIEJ5IGRlZmF1bHQsIFBvc3RDU1Mgd2lsbCBkZXRlY3RcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yIHN1cHBvcnQgYnkgYHByb2Nlc3Muc3Rkb3V0LmlzVFRZYFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgYW5kIGBwcm9jZXNzLmVudi5OT0RFX0RJU0FCTEVfQ09MT1JTYC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogZXJyb3Iuc2hvd1NvdXJjZUNvZGUoKSAvLz0+IFwiICA0IHwgfVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgNSB8IGEge1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgID4gNiB8ICAgYmFkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgIHwgICBeXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICA3IHwgfVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgOCB8IGIge1wiXG4gICAqXG4gICAqIEByZXR1cm4ge3N0cmluZ30gRmV3IGxpbmVzIG9mIENTUyBzb3VyY2UgdGhhdCBjYXVzZWQgdGhlIGVycm9yLlxuICAgKi9cbiAgc2hvd1NvdXJjZUNvZGUgKGNvbG9yKSB7XG4gICAgaWYgKCF0aGlzLnNvdXJjZSkgcmV0dXJuICcnXG5cbiAgICBsZXQgY3NzID0gdGhpcy5zb3VyY2VcbiAgICBpZiAodGVybWluYWxIaWdobGlnaHQpIHtcbiAgICAgIGlmICh0eXBlb2YgY29sb3IgPT09ICd1bmRlZmluZWQnKSBjb2xvciA9IHN1cHBvcnRzQ29sb3Iuc3Rkb3V0XG4gICAgICBpZiAoY29sb3IpIGNzcyA9IHRlcm1pbmFsSGlnaGxpZ2h0KGNzcylcbiAgICB9XG5cbiAgICBsZXQgbGluZXMgPSBjc3Muc3BsaXQoL1xccj9cXG4vKVxuICAgIGxldCBzdGFydCA9IE1hdGgubWF4KHRoaXMubGluZSAtIDMsIDApXG4gICAgbGV0IGVuZCA9IE1hdGgubWluKHRoaXMubGluZSArIDIsIGxpbmVzLmxlbmd0aClcblxuICAgIGxldCBtYXhXaWR0aCA9IFN0cmluZyhlbmQpLmxlbmd0aFxuXG4gICAgZnVuY3Rpb24gbWFyayAodGV4dCkge1xuICAgICAgaWYgKGNvbG9yICYmIGNoYWxrLnJlZCkge1xuICAgICAgICByZXR1cm4gY2hhbGsucmVkLmJvbGQodGV4dClcbiAgICAgIH1cbiAgICAgIHJldHVybiB0ZXh0XG4gICAgfVxuICAgIGZ1bmN0aW9uIGFzaWRlICh0ZXh0KSB7XG4gICAgICBpZiAoY29sb3IgJiYgY2hhbGsuZ3JheSkge1xuICAgICAgICByZXR1cm4gY2hhbGsuZ3JheSh0ZXh0KVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRleHRcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXMuc2xpY2Uoc3RhcnQsIGVuZCkubWFwKChsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgbGV0IG51bWJlciA9IHN0YXJ0ICsgMSArIGluZGV4XG4gICAgICBsZXQgZ3V0dGVyID0gJyAnICsgKCcgJyArIG51bWJlcikuc2xpY2UoLW1heFdpZHRoKSArICcgfCAnXG4gICAgICBpZiAobnVtYmVyID09PSB0aGlzLmxpbmUpIHtcbiAgICAgICAgbGV0IHNwYWNpbmcgPSBhc2lkZShndXR0ZXIucmVwbGFjZSgvXFxkL2csICcgJykpICtcbiAgICAgICAgICBsaW5lLnNsaWNlKDAsIHRoaXMuY29sdW1uIC0gMSkucmVwbGFjZSgvW15cXHRdL2csICcgJylcbiAgICAgICAgcmV0dXJuIG1hcmsoJz4nKSArIGFzaWRlKGd1dHRlcikgKyBsaW5lICsgJ1xcbiAnICsgc3BhY2luZyArIG1hcmsoJ14nKVxuICAgICAgfVxuICAgICAgcmV0dXJuICcgJyArIGFzaWRlKGd1dHRlcikgKyBsaW5lXG4gICAgfSkuam9pbignXFxuJylcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGVycm9yIHBvc2l0aW9uLCBtZXNzYWdlIGFuZCBzb3VyY2UgY29kZSBvZiB0aGUgYnJva2VuIHBhcnQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGVycm9yLnRvU3RyaW5nKCkgLy89PiBcIkNzc1N5bnRheEVycm9yOiBhcHAuY3NzOjE6MTogVW5jbG9zZWQgYmxvY2tcbiAgICogICAgICAgICAgICAgICAgICAvLyAgICA+IDEgfCBhIHtcbiAgICogICAgICAgICAgICAgICAgICAvLyAgICAgICAgfCBeXCJcbiAgICpcbiAgICogQHJldHVybiB7c3RyaW5nfSBFcnJvciBwb3NpdGlvbiwgbWVzc2FnZSBhbmQgc291cmNlIGNvZGUuXG4gICAqL1xuICB0b1N0cmluZyAoKSB7XG4gICAgbGV0IGNvZGUgPSB0aGlzLnNob3dTb3VyY2VDb2RlKClcbiAgICBpZiAoY29kZSkge1xuICAgICAgY29kZSA9ICdcXG5cXG4nICsgY29kZSArICdcXG4nXG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5hbWUgKyAnOiAnICsgdGhpcy5tZXNzYWdlICsgY29kZVxuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJvZiBDc3NTeW50YXhFcnJvciNcbiAgICogQG1lbWJlciB7SW5wdXR9IGlucHV0IElucHV0IG9iamVjdCB3aXRoIFBvc3RDU1MgaW50ZXJuYWwgaW5mb3JtYXRpb25cbiAgICogICAgICAgICAgICAgICAgICAgICAgIGFib3V0IGlucHV0IGZpbGUuIElmIGlucHV0IGhhcyBzb3VyY2UgbWFwXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBmcm9tIHByZXZpb3VzIHRvb2wsIFBvc3RDU1Mgd2lsbCB1c2Ugb3JpZ2luXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAoZm9yIGV4YW1wbGUsIFNhc3MpIHNvdXJjZS4gWW91IGNhbiB1c2UgdGhpc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0IHRvIGdldCBQb3N0Q1NTIGlucHV0IHNvdXJjZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogZXJyb3IuaW5wdXQuZmlsZSAvLz0+ICdhLmNzcydcbiAgICogZXJyb3IuZmlsZSAgICAgICAvLz0+ICdhLnNhc3MnXG4gICAqL1xufVxuXG5leHBvcnQgZGVmYXVsdCBDc3NTeW50YXhFcnJvclxuIl0sImZpbGUiOiJjc3Mtc3ludGF4LWVycm9yLmpzIn0=
