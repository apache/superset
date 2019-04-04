"use strict";

exports.__esModule = true;
exports.default = void 0;

var _container = _interopRequireDefault(require("./container"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents an at-rule.
 *
 * If it’s followed in the CSS by a {} block, this node will have
 * a nodes property representing its children.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('@charset "UTF-8"; @media print {}')
 *
 * const charset = root.first
 * charset.type  //=> 'atrule'
 * charset.nodes //=> undefined
 *
 * const media = root.last
 * media.nodes   //=> []
 */
var AtRule =
/*#__PURE__*/
function (_Container) {
  _inheritsLoose(AtRule, _Container);

  function AtRule(defaults) {
    var _this;

    _this = _Container.call(this, defaults) || this;
    _this.type = 'atrule';
    return _this;
  }

  var _proto = AtRule.prototype;

  _proto.append = function append() {
    var _Container$prototype$;

    if (!this.nodes) this.nodes = [];

    for (var _len = arguments.length, children = new Array(_len), _key = 0; _key < _len; _key++) {
      children[_key] = arguments[_key];
    }

    return (_Container$prototype$ = _Container.prototype.append).call.apply(_Container$prototype$, [this].concat(children));
  };

  _proto.prepend = function prepend() {
    var _Container$prototype$2;

    if (!this.nodes) this.nodes = [];

    for (var _len2 = arguments.length, children = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      children[_key2] = arguments[_key2];
    }

    return (_Container$prototype$2 = _Container.prototype.prepend).call.apply(_Container$prototype$2, [this].concat(children));
  };
  /**
   * @memberof AtRule#
   * @member {string} name The at-rule’s name immediately follows the `@`.
   *
   * @example
   * const root  = postcss.parse('@media print {}')
   * media.name //=> 'media'
   * const media = root.first
   */

  /**
   * @memberof AtRule#
   * @member {string} params The at-rule’s parameters, the values
   *                         that follow the at-rule’s name but precede
   *                         any {} block.
   *
   * @example
   * const root  = postcss.parse('@media print, screen {}')
   * const media = root.first
   * media.params //=> 'print, screen'
   */

  /**
   * @memberof AtRule#
   * @member {object} raws Information to generate byte-to-byte equal
   *                        node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `before`: the space symbols before the node. It also stores `*`
   *   and `_` symbols before the declaration (IE hack).
   * * `after`: the space symbols after the last child of the node
   *   to the end of the node.
   * * `between`: the symbols between the property and value
   *   for declarations, selector and `{` for rules, or last parameter
   *   and `{` for at-rules.
   * * `semicolon`: contains true if the last child has
   *   an (optional) semicolon.
   * * `afterName`: the space between the at-rule name and its parameters.
   *
   * PostCSS cleans at-rule parameters from comments and extra spaces,
   * but it stores origin content in raws properties.
   * As such, if you don’t change a declaration’s value,
   * PostCSS will use the raw value with comments.
   *
   * @example
   * const root = postcss.parse('  @media\nprint {\n}')
   * root.first.first.raws //=> { before: '  ',
   *                       //     between: ' ',
   *                       //     afterName: '\n',
   *                       //     after: '\n' }
   */


  return AtRule;
}(_container.default);

var _default = AtRule;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImF0LXJ1bGUuZXM2Il0sIm5hbWVzIjpbIkF0UnVsZSIsImRlZmF1bHRzIiwidHlwZSIsImFwcGVuZCIsIm5vZGVzIiwiY2hpbGRyZW4iLCJwcmVwZW5kIiwiQ29udGFpbmVyIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBOzs7Ozs7QUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBa0JNQSxNOzs7OztBQUNKLGtCQUFhQyxRQUFiLEVBQXVCO0FBQUE7O0FBQ3JCLGtDQUFNQSxRQUFOO0FBQ0EsVUFBS0MsSUFBTCxHQUFZLFFBQVo7QUFGcUI7QUFHdEI7Ozs7U0FFREMsTSxxQkFBcUI7QUFBQTs7QUFDbkIsUUFBSSxDQUFDLEtBQUtDLEtBQVYsRUFBaUIsS0FBS0EsS0FBTCxHQUFhLEVBQWI7O0FBREUsc0NBQVZDLFFBQVU7QUFBVkEsTUFBQUEsUUFBVTtBQUFBOztBQUVuQix5REFBYUYsTUFBYixrREFBdUJFLFFBQXZCO0FBQ0QsRzs7U0FFREMsTyxzQkFBc0I7QUFBQTs7QUFDcEIsUUFBSSxDQUFDLEtBQUtGLEtBQVYsRUFBaUIsS0FBS0EsS0FBTCxHQUFhLEVBQWI7O0FBREcsdUNBQVZDLFFBQVU7QUFBVkEsTUFBQUEsUUFBVTtBQUFBOztBQUVwQiwwREFBYUMsT0FBYixtREFBd0JELFFBQXhCO0FBQ0QsRztBQUVEOzs7Ozs7Ozs7O0FBVUE7Ozs7Ozs7Ozs7OztBQVlBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBdENtQkUsa0I7O2VBdUVOUCxNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IENvbnRhaW5lciBmcm9tICcuL2NvbnRhaW5lcidcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGF0LXJ1bGUuXG4gKlxuICogSWYgaXTigJlzIGZvbGxvd2VkIGluIHRoZSBDU1MgYnkgYSB7fSBibG9jaywgdGhpcyBub2RlIHdpbGwgaGF2ZVxuICogYSBub2RlcyBwcm9wZXJ0eSByZXByZXNlbnRpbmcgaXRzIGNoaWxkcmVuLlxuICpcbiAqIEBleHRlbmRzIENvbnRhaW5lclxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZSgnQGNoYXJzZXQgXCJVVEYtOFwiOyBAbWVkaWEgcHJpbnQge30nKVxuICpcbiAqIGNvbnN0IGNoYXJzZXQgPSByb290LmZpcnN0XG4gKiBjaGFyc2V0LnR5cGUgIC8vPT4gJ2F0cnVsZSdcbiAqIGNoYXJzZXQubm9kZXMgLy89PiB1bmRlZmluZWRcbiAqXG4gKiBjb25zdCBtZWRpYSA9IHJvb3QubGFzdFxuICogbWVkaWEubm9kZXMgICAvLz0+IFtdXG4gKi9cbmNsYXNzIEF0UnVsZSBleHRlbmRzIENvbnRhaW5lciB7XG4gIGNvbnN0cnVjdG9yIChkZWZhdWx0cykge1xuICAgIHN1cGVyKGRlZmF1bHRzKVxuICAgIHRoaXMudHlwZSA9ICdhdHJ1bGUnXG4gIH1cblxuICBhcHBlbmQgKC4uLmNoaWxkcmVuKSB7XG4gICAgaWYgKCF0aGlzLm5vZGVzKSB0aGlzLm5vZGVzID0gW11cbiAgICByZXR1cm4gc3VwZXIuYXBwZW5kKC4uLmNoaWxkcmVuKVxuICB9XG5cbiAgcHJlcGVuZCAoLi4uY2hpbGRyZW4pIHtcbiAgICBpZiAoIXRoaXMubm9kZXMpIHRoaXMubm9kZXMgPSBbXVxuICAgIHJldHVybiBzdXBlci5wcmVwZW5kKC4uLmNoaWxkcmVuKVxuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJvZiBBdFJ1bGUjXG4gICAqIEBtZW1iZXIge3N0cmluZ30gbmFtZSBUaGUgYXQtcnVsZeKAmXMgbmFtZSBpbW1lZGlhdGVseSBmb2xsb3dzIHRoZSBgQGAuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QgID0gcG9zdGNzcy5wYXJzZSgnQG1lZGlhIHByaW50IHt9JylcbiAgICogbWVkaWEubmFtZSAvLz0+ICdtZWRpYSdcbiAgICogY29uc3QgbWVkaWEgPSByb290LmZpcnN0XG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbWVtYmVyb2YgQXRSdWxlI1xuICAgKiBAbWVtYmVyIHtzdHJpbmd9IHBhcmFtcyBUaGUgYXQtcnVsZeKAmXMgcGFyYW1ldGVycywgdGhlIHZhbHVlc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0IGZvbGxvdyB0aGUgYXQtcnVsZeKAmXMgbmFtZSBidXQgcHJlY2VkZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICBhbnkge30gYmxvY2suXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QgID0gcG9zdGNzcy5wYXJzZSgnQG1lZGlhIHByaW50LCBzY3JlZW4ge30nKVxuICAgKiBjb25zdCBtZWRpYSA9IHJvb3QuZmlyc3RcbiAgICogbWVkaWEucGFyYW1zIC8vPT4gJ3ByaW50LCBzY3JlZW4nXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbWVtYmVyb2YgQXRSdWxlI1xuICAgKiBAbWVtYmVyIHtvYmplY3R9IHJhd3MgSW5mb3JtYXRpb24gdG8gZ2VuZXJhdGUgYnl0ZS10by1ieXRlIGVxdWFsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgbm9kZSBzdHJpbmcgYXMgaXQgd2FzIGluIHRoZSBvcmlnaW4gaW5wdXQuXG4gICAqXG4gICAqIEV2ZXJ5IHBhcnNlciBzYXZlcyBpdHMgb3duIHByb3BlcnRpZXMsXG4gICAqIGJ1dCB0aGUgZGVmYXVsdCBDU1MgcGFyc2VyIHVzZXM6XG4gICAqXG4gICAqICogYGJlZm9yZWA6IHRoZSBzcGFjZSBzeW1ib2xzIGJlZm9yZSB0aGUgbm9kZS4gSXQgYWxzbyBzdG9yZXMgYCpgXG4gICAqICAgYW5kIGBfYCBzeW1ib2xzIGJlZm9yZSB0aGUgZGVjbGFyYXRpb24gKElFIGhhY2spLlxuICAgKiAqIGBhZnRlcmA6IHRoZSBzcGFjZSBzeW1ib2xzIGFmdGVyIHRoZSBsYXN0IGNoaWxkIG9mIHRoZSBub2RlXG4gICAqICAgdG8gdGhlIGVuZCBvZiB0aGUgbm9kZS5cbiAgICogKiBgYmV0d2VlbmA6IHRoZSBzeW1ib2xzIGJldHdlZW4gdGhlIHByb3BlcnR5IGFuZCB2YWx1ZVxuICAgKiAgIGZvciBkZWNsYXJhdGlvbnMsIHNlbGVjdG9yIGFuZCBge2AgZm9yIHJ1bGVzLCBvciBsYXN0IHBhcmFtZXRlclxuICAgKiAgIGFuZCBge2AgZm9yIGF0LXJ1bGVzLlxuICAgKiAqIGBzZW1pY29sb25gOiBjb250YWlucyB0cnVlIGlmIHRoZSBsYXN0IGNoaWxkIGhhc1xuICAgKiAgIGFuIChvcHRpb25hbCkgc2VtaWNvbG9uLlxuICAgKiAqIGBhZnRlck5hbWVgOiB0aGUgc3BhY2UgYmV0d2VlbiB0aGUgYXQtcnVsZSBuYW1lIGFuZCBpdHMgcGFyYW1ldGVycy5cbiAgICpcbiAgICogUG9zdENTUyBjbGVhbnMgYXQtcnVsZSBwYXJhbWV0ZXJzIGZyb20gY29tbWVudHMgYW5kIGV4dHJhIHNwYWNlcyxcbiAgICogYnV0IGl0IHN0b3JlcyBvcmlnaW4gY29udGVudCBpbiByYXdzIHByb3BlcnRpZXMuXG4gICAqIEFzIHN1Y2gsIGlmIHlvdSBkb27igJl0IGNoYW5nZSBhIGRlY2xhcmF0aW9u4oCZcyB2YWx1ZSxcbiAgICogUG9zdENTUyB3aWxsIHVzZSB0aGUgcmF3IHZhbHVlIHdpdGggY29tbWVudHMuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCcgIEBtZWRpYVxcbnByaW50IHtcXG59JylcbiAgICogcm9vdC5maXJzdC5maXJzdC5yYXdzIC8vPT4geyBiZWZvcmU6ICcgICcsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgYmV0d2VlbjogJyAnLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgIGFmdGVyTmFtZTogJ1xcbicsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgYWZ0ZXI6ICdcXG4nIH1cbiAgICovXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0UnVsZVxuIl0sImZpbGUiOiJhdC1ydWxlLmpzIn0=
