"use strict";

exports.__esModule = true;
exports.default = void 0;

var _cssSyntaxError = _interopRequireDefault(require("./css-syntax-error"));

var _stringifier = _interopRequireDefault(require("./stringifier"));

var _stringify = _interopRequireDefault(require("./stringify"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cloneNode(obj, parent) {
  var cloned = new obj.constructor();

  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue;
    var value = obj[i];
    var type = typeof value;

    if (i === 'parent' && type === 'object') {
      if (parent) cloned[i] = parent;
    } else if (i === 'source') {
      cloned[i] = value;
    } else if (value instanceof Array) {
      cloned[i] = value.map(function (j) {
        return cloneNode(j, cloned);
      });
    } else {
      if (type === 'object' && value !== null) value = cloneNode(value);
      cloned[i] = value;
    }
  }

  return cloned;
}
/**
 * All node classes inherit the following common methods.
 *
 * @abstract
 */


var Node =
/*#__PURE__*/
function () {
  /**
   * @param {object} [defaults] Value for node properties.
   */
  function Node(defaults) {
    if (defaults === void 0) {
      defaults = {};
    }

    this.raws = {};

    if (process.env.NODE_ENV !== 'production') {
      if (typeof defaults !== 'object' && typeof defaults !== 'undefined') {
        throw new Error('PostCSS nodes constructor accepts object, not ' + JSON.stringify(defaults));
      }
    }

    for (var name in defaults) {
      this[name] = defaults[name];
    }
  }
  /**
   * Returns a `CssSyntaxError` instance containing the original position
   * of the node in the source, showing line and column numbers and also
   * a small excerpt to facilitate debugging.
   *
   * If present, an input source map will be used to get the original position
   * of the source, even from a previous compilation step
   * (e.g., from Sass compilation).
   *
   * This method produces very useful error messages.
   *
   * @param {string} message     Error description.
   * @param {object} [opts]      Options.
   * @param {string} opts.plugin Plugin name that created this error.
   *                             PostCSS will set it automatically.
   * @param {string} opts.word   A word inside a node’s string that should
   *                             be highlighted as the source of the error.
   * @param {number} opts.index  An index inside a node’s string that should
   *                             be highlighted as the source of the error.
   *
   * @return {CssSyntaxError} Error object to throw it.
   *
   * @example
   * if (!variables[name]) {
   *   throw decl.error('Unknown variable ' + name, { word: name })
   *   // CssSyntaxError: postcss-vars:a.sass:4:3: Unknown variable $black
   *   //   color: $black
   *   // a
   *   //          ^
   *   //   background: white
   * }
   */


  var _proto = Node.prototype;

  _proto.error = function error(message, opts) {
    if (opts === void 0) {
      opts = {};
    }

    if (this.source) {
      var pos = this.positionBy(opts);
      return this.source.input.error(message, pos.line, pos.column, opts);
    }

    return new _cssSyntaxError.default(message);
  };
  /**
   * This method is provided as a convenience wrapper for {@link Result#warn}.
   *
   * @param {Result} result      The {@link Result} instance
   *                             that will receive the warning.
   * @param {string} text        Warning message.
   * @param {object} [opts]      Options
   * @param {string} opts.plugin Plugin name that created this warning.
   *                             PostCSS will set it automatically.
   * @param {string} opts.word   A word inside a node’s string that should
   *                             be highlighted as the source of the warning.
   * @param {number} opts.index  An index inside a node’s string that should
   *                             be highlighted as the source of the warning.
   *
   * @return {Warning} Created warning object.
   *
   * @example
   * const plugin = postcss.plugin('postcss-deprecated', () => {
   *   return (root, result) => {
   *     root.walkDecls('bad', decl => {
   *       decl.warn(result, 'Deprecated property bad')
   *     })
   *   }
   * })
   */


  _proto.warn = function warn(result, text, opts) {
    var data = {
      node: this
    };

    for (var i in opts) {
      data[i] = opts[i];
    }

    return result.warn(text, data);
  };
  /**
   * Removes the node from its parent and cleans the parent properties
   * from the node and its children.
   *
   * @example
   * if (decl.prop.match(/^-webkit-/)) {
   *   decl.remove()
   * }
   *
   * @return {Node} Node to make calls chain.
   */


  _proto.remove = function remove() {
    if (this.parent) {
      this.parent.removeChild(this);
    }

    this.parent = undefined;
    return this;
  };
  /**
   * Returns a CSS string representing the node.
   *
   * @param {stringifier|syntax} [stringifier] A syntax to use
   *                                           in string generation.
   *
   * @return {string} CSS string of this node.
   *
   * @example
   * postcss.rule({ selector: 'a' }).toString() //=> "a {}"
   */


  _proto.toString = function toString(stringifier) {
    if (stringifier === void 0) {
      stringifier = _stringify.default;
    }

    if (stringifier.stringify) stringifier = stringifier.stringify;
    var result = '';
    stringifier(this, function (i) {
      result += i;
    });
    return result;
  };
  /**
   * Returns an exact clone of the node.
   *
   * The resulting cloned node and its (cloned) children will retain
   * code style properties.
   *
   * @param {object} [overrides] New properties to override in the clone.
   *
   * @example
   * decl.raws.before    //=> "\n  "
   * const cloned = decl.clone({ prop: '-moz-' + decl.prop })
   * cloned.raws.before  //=> "\n  "
   * cloned.toString()   //=> -moz-transform: scale(0)
   *
   * @return {Node} Clone of the node.
   */


  _proto.clone = function clone(overrides) {
    if (overrides === void 0) {
      overrides = {};
    }

    var cloned = cloneNode(this);

    for (var name in overrides) {
      cloned[name] = overrides[name];
    }

    return cloned;
  };
  /**
   * Shortcut to clone the node and insert the resulting cloned node
   * before the current node.
   *
   * @param {object} [overrides] Mew properties to override in the clone.
   *
   * @example
   * decl.cloneBefore({ prop: '-moz-' + decl.prop })
   *
   * @return {Node} New node
   */


  _proto.cloneBefore = function cloneBefore(overrides) {
    if (overrides === void 0) {
      overrides = {};
    }

    var cloned = this.clone(overrides);
    this.parent.insertBefore(this, cloned);
    return cloned;
  };
  /**
   * Shortcut to clone the node and insert the resulting cloned node
   * after the current node.
   *
   * @param {object} [overrides] New properties to override in the clone.
   *
   * @return {Node} New node.
   */


  _proto.cloneAfter = function cloneAfter(overrides) {
    if (overrides === void 0) {
      overrides = {};
    }

    var cloned = this.clone(overrides);
    this.parent.insertAfter(this, cloned);
    return cloned;
  };
  /**
   * Inserts node(s) before the current node and removes the current node.
   *
   * @param {...Node} nodes Mode(s) to replace current one.
   *
   * @example
   * if (atrule.name === 'mixin') {
   *   atrule.replaceWith(mixinRules[atrule.params])
   * }
   *
   * @return {Node} Current node to methods chain.
   */


  _proto.replaceWith = function replaceWith() {
    if (this.parent) {
      for (var _len = arguments.length, nodes = new Array(_len), _key = 0; _key < _len; _key++) {
        nodes[_key] = arguments[_key];
      }

      for (var _i = 0; _i < nodes.length; _i++) {
        var node = nodes[_i];
        this.parent.insertBefore(this, node);
      }

      this.remove();
    }

    return this;
  };
  /**
   * Returns the next child of the node’s parent.
   * Returns `undefined` if the current node is the last child.
   *
   * @return {Node|undefined} Next node.
   *
   * @example
   * if (comment.text === 'delete next') {
   *   const next = comment.next()
   *   if (next) {
   *     next.remove()
   *   }
   * }
   */


  _proto.next = function next() {
    if (!this.parent) return undefined;
    var index = this.parent.index(this);
    return this.parent.nodes[index + 1];
  };
  /**
   * Returns the previous child of the node’s parent.
   * Returns `undefined` if the current node is the first child.
   *
   * @return {Node|undefined} Previous node.
   *
   * @example
   * const annotation = decl.prev()
   * if (annotation.type === 'comment') {
   *   readAnnotation(annotation.text)
   * }
   */


  _proto.prev = function prev() {
    if (!this.parent) return undefined;
    var index = this.parent.index(this);
    return this.parent.nodes[index - 1];
  };
  /**
   * Insert new node before current node to current node’s parent.
   *
   * Just alias for `node.parent.insertBefore(node, add)`.
   *
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * decl.before('content: ""')
   */


  _proto.before = function before(add) {
    this.parent.insertBefore(this, add);
    return this;
  };
  /**
   * Insert new node after current node to current node’s parent.
   *
   * Just alias for `node.parent.insertAfter(node, add)`.
   *
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * decl.after('color: black')
   */


  _proto.after = function after(add) {
    this.parent.insertAfter(this, add);
    return this;
  };

  _proto.toJSON = function toJSON() {
    var fixed = {};

    for (var name in this) {
      if (!this.hasOwnProperty(name)) continue;
      if (name === 'parent') continue;
      var value = this[name];

      if (value instanceof Array) {
        fixed[name] = value.map(function (i) {
          if (typeof i === 'object' && i.toJSON) {
            return i.toJSON();
          } else {
            return i;
          }
        });
      } else if (typeof value === 'object' && value.toJSON) {
        fixed[name] = value.toJSON();
      } else {
        fixed[name] = value;
      }
    }

    return fixed;
  };
  /**
   * Returns a {@link Node#raws} value. If the node is missing
   * the code style property (because the node was manually built or cloned),
   * PostCSS will try to autodetect the code style property by looking
   * at other nodes in the tree.
   *
   * @param {string} prop          Name of code style property.
   * @param {string} [defaultType] Name of default value, it can be missed
   *                               if the value is the same as prop.
   *
   * @example
   * const root = postcss.parse('a { background: white }')
   * root.nodes[0].append({ prop: 'color', value: 'black' })
   * root.nodes[0].nodes[1].raws.before   //=> undefined
   * root.nodes[0].nodes[1].raw('before') //=> ' '
   *
   * @return {string} Code style value.
   */


  _proto.raw = function raw(prop, defaultType) {
    var str = new _stringifier.default();
    return str.raw(this, prop, defaultType);
  };
  /**
   * Finds the Root instance of the node’s tree.
   *
   * @example
   * root.nodes[0].nodes[0].root() === root
   *
   * @return {Root} Root parent.
   */


  _proto.root = function root() {
    var result = this;

    while (result.parent) {
      result = result.parent;
    }

    return result;
  };
  /**
   * Clear the code style properties for the node and its children.
   *
   * @param {boolean} [keepBetween] Keep the raws.between symbols.
   *
   * @return {undefined}
   *
   * @example
   * node.raws.before  //=> ' '
   * node.cleanRaws()
   * node.raws.before  //=> undefined
   */


  _proto.cleanRaws = function cleanRaws(keepBetween) {
    delete this.raws.before;
    delete this.raws.after;
    if (!keepBetween) delete this.raws.between;
  };

  _proto.positionInside = function positionInside(index) {
    var string = this.toString();
    var column = this.source.start.column;
    var line = this.source.start.line;

    for (var i = 0; i < index; i++) {
      if (string[i] === '\n') {
        column = 1;
        line += 1;
      } else {
        column += 1;
      }
    }

    return {
      line: line,
      column: column
    };
  };

  _proto.positionBy = function positionBy(opts) {
    var pos = this.source.start;

    if (opts.index) {
      pos = this.positionInside(opts.index);
    } else if (opts.word) {
      var index = this.toString().indexOf(opts.word);
      if (index !== -1) pos = this.positionInside(index);
    }

    return pos;
  };
  /**
   * @memberof Node#
   * @member {string} type String representing the node’s type.
   *                       Possible values are `root`, `atrule`, `rule`,
   *                       `decl`, or `comment`.
   *
   * @example
   * postcss.decl({ prop: 'color', value: 'black' }).type //=> 'decl'
   */

  /**
   * @memberof Node#
   * @member {Container} parent The node’s parent node.
   *
   * @example
   * root.nodes[0].parent === root
   */

  /**
   * @memberof Node#
   * @member {source} source The input source of the node.
   *
   * The property is used in source map generation.
   *
   * If you create a node manually (e.g., with `postcss.decl()`),
   * that node will not have a `source` property and will be absent
   * from the source map. For this reason, the plugin developer should
   * consider cloning nodes to create new ones (in which case the new node’s
   * source will reference the original, cloned node) or setting
   * the `source` property manually.
   *
   * ```js
   * // Bad
   * const prefixed = postcss.decl({
   *   prop: '-moz-' + decl.prop,
   *   value: decl.value
   * })
   *
   * // Good
   * const prefixed = decl.clone({ prop: '-moz-' + decl.prop })
   * ```
   *
   * ```js
   * if (atrule.name === 'add-link') {
   *   const rule = postcss.rule({ selector: 'a', source: atrule.source })
   *   atrule.parent.insertBefore(atrule, rule)
   * }
   * ```
   *
   * @example
   * decl.source.input.from //=> '/home/ai/a.sass'
   * decl.source.start      //=> { line: 10, column: 2 }
   * decl.source.end        //=> { line: 10, column: 12 }
   */

  /**
   * @memberof Node#
   * @member {object} raws Information to generate byte-to-byte equal
   *                       node string as it was in the origin input.
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
   * * `left`: the space symbols between `/*` and the comment’s text.
   * * `right`: the space symbols between the comment’s text
   *   and <code>*&#47;</code>.
   * * `important`: the content of the important statement,
   *   if it is not just `!important`.
   *
   * PostCSS cleans selectors, declaration values and at-rule parameters
   * from comments and extra spaces, but it stores origin content in raws
   * properties. As such, if you don’t change a declaration’s value,
   * PostCSS will use the raw value with comments.
   *
   * @example
   * const root = postcss.parse('a {\n  color:black\n}')
   * root.first.first.raws //=> { before: '\n  ', between: ':' }
   */


  return Node;
}();

var _default = Node;
/**
 * @typedef {object} position
 * @property {number} line   Source line in file.
 * @property {number} column Source column in file.
 */

/**
 * @typedef {object} source
 * @property {Input} input    {@link Input} with input file
 * @property {position} start The starting position of the node’s source.
 * @property {position} end   The ending position of the node’s source.
 */

exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGUuZXM2Il0sIm5hbWVzIjpbImNsb25lTm9kZSIsIm9iaiIsInBhcmVudCIsImNsb25lZCIsImNvbnN0cnVjdG9yIiwiaSIsImhhc093blByb3BlcnR5IiwidmFsdWUiLCJ0eXBlIiwiQXJyYXkiLCJtYXAiLCJqIiwiTm9kZSIsImRlZmF1bHRzIiwicmF3cyIsInByb2Nlc3MiLCJlbnYiLCJOT0RFX0VOViIsIkVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5hbWUiLCJlcnJvciIsIm1lc3NhZ2UiLCJvcHRzIiwic291cmNlIiwicG9zIiwicG9zaXRpb25CeSIsImlucHV0IiwibGluZSIsImNvbHVtbiIsIkNzc1N5bnRheEVycm9yIiwid2FybiIsInJlc3VsdCIsInRleHQiLCJkYXRhIiwibm9kZSIsInJlbW92ZSIsInJlbW92ZUNoaWxkIiwidW5kZWZpbmVkIiwidG9TdHJpbmciLCJzdHJpbmdpZmllciIsImNsb25lIiwib3ZlcnJpZGVzIiwiY2xvbmVCZWZvcmUiLCJpbnNlcnRCZWZvcmUiLCJjbG9uZUFmdGVyIiwiaW5zZXJ0QWZ0ZXIiLCJyZXBsYWNlV2l0aCIsIm5vZGVzIiwibmV4dCIsImluZGV4IiwicHJldiIsImJlZm9yZSIsImFkZCIsImFmdGVyIiwidG9KU09OIiwiZml4ZWQiLCJyYXciLCJwcm9wIiwiZGVmYXVsdFR5cGUiLCJzdHIiLCJTdHJpbmdpZmllciIsInJvb3QiLCJjbGVhblJhd3MiLCJrZWVwQmV0d2VlbiIsImJldHdlZW4iLCJwb3NpdGlvbkluc2lkZSIsInN0cmluZyIsInN0YXJ0Iiwid29yZCIsImluZGV4T2YiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7Ozs7QUFFQSxTQUFTQSxTQUFULENBQW9CQyxHQUFwQixFQUF5QkMsTUFBekIsRUFBaUM7QUFDL0IsTUFBSUMsTUFBTSxHQUFHLElBQUlGLEdBQUcsQ0FBQ0csV0FBUixFQUFiOztBQUVBLE9BQUssSUFBSUMsQ0FBVCxJQUFjSixHQUFkLEVBQW1C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QUFOLEtBQWMsSUFBbEIsRUFBd0I7QUFDdEJ5QixRQUFBQSxNQUFNLEdBQUcsQ0FBVDtBQUNBRCxRQUFBQSxJQUFJLElBQUksQ0FBUjtBQUNELE9BSEQsTUFHTztBQUNMQyxRQUFBQSxNQUFNLElBQUksQ0FBVjtBQUNEO0FBQ0Y7O0FBRUQsV0FBTztBQUFFRCxNQUFBQSxJQUFJLEVBQUpBLElBQUY7QUFBUUMsTUFBQUEsTUFBTSxFQUFOQTtBQUFSLEtBQVA7QUFDRCxHOztTQUVESCxVLHVCQUFZSCxJLEVBQU07QUFDaEIsUUFBSUUsR0FBRyxHQUFHLEtBQUtELE1BQUwsQ0FBWTRDLEtBQXRCOztBQUNBLFFBQUk3QyxJQUFJLENBQUMyQixLQUFULEVBQWdCO0FBQ2R6QixNQUFBQSxHQUFHLEdBQUcsS0FBS3lDLGNBQUwsQ0FBb0IzQyxJQUFJLENBQUMyQixLQUF6QixDQUFOO0FBQ0QsS0FGRCxNQUVPLElBQUkzQixJQUFJLENBQUM4QyxJQUFULEVBQWU7QUFDcEIsVUFBSW5CLEtBQUssR0FBRyxLQUFLWCxRQUFMLEdBQWdCK0IsT0FBaEIsQ0FBd0IvQyxJQUFJLENBQUM4QyxJQUE3QixDQUFaO0FBQ0EsVUFBSW5CLEtBQUssS0FBSyxDQUFDLENBQWYsRUFBa0J6QixHQUFHLEdBQUcsS0FBS3lDLGNBQUwsQ0FBb0JoQixLQUFwQixDQUFOO0FBQ25COztBQUNELFdBQU96QixHQUFQO0FBQ0QsRztBQUVEOzs7Ozs7Ozs7O0FBVUE7Ozs7Ozs7O0FBUUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2VBbUNhZCxJO0FBRWY7Ozs7OztBQU1BIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IENzc1N5bnRheEVycm9yIGZyb20gJy4vY3NzLXN5bnRheC1lcnJvcidcbmltcG9ydCBTdHJpbmdpZmllciBmcm9tICcuL3N0cmluZ2lmaWVyJ1xuaW1wb3J0IHN0cmluZ2lmeSBmcm9tICcuL3N0cmluZ2lmeSdcblxuZnVuY3Rpb24gY2xvbmVOb2RlIChvYmosIHBhcmVudCkge1xuICBsZXQgY2xvbmVkID0gbmV3IG9iai5jb25zdHJ1Y3RvcigpXG5cbiAgZm9yIChsZXQgaSBpbiBvYmopIHtcbiAgICBpZiAoIW9iai5oYXNPd25Qcm9wZXJ0eShpKSkgY29udGludWVcbiAgICBsZXQgdmFsdWUgPSBvYmpbaV1cbiAgICBsZXQgdHlwZSA9IHR5cGVvZiB2YWx1ZVxuXG4gICAgaWYgKGkgPT09ICdwYXJlbnQnICYmIHR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAocGFyZW50KSBjbG9uZWRbaV0gPSBwYXJlbnRcbiAgICB9IGVsc2UgaWYgKGkgPT09ICdzb3VyY2UnKSB7XG4gICAgICBjbG9uZWRbaV0gPSB2YWx1ZVxuICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgY2xvbmVkW2ldID0gdmFsdWUubWFwKGogPT4gY2xvbmVOb2RlKGosIGNsb25lZCkpXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkgdmFsdWUgPSBjbG9uZU5vZGUodmFsdWUpXG4gICAgICBjbG9uZWRbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjbG9uZWRcbn1cblxuLyoqXG4gKiBBbGwgbm9kZSBjbGFzc2VzIGluaGVyaXQgdGhlIGZvbGxvd2luZyBjb21tb24gbWV0aG9kcy5cbiAqXG4gKiBAYWJzdHJhY3RcbiAqL1xuY2xhc3MgTm9kZSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge29iamVjdH0gW2RlZmF1bHRzXSBWYWx1ZSBmb3Igbm9kZSBwcm9wZXJ0aWVzLlxuICAgKi9cbiAgY29uc3RydWN0b3IgKGRlZmF1bHRzID0geyB9KSB7XG4gICAgdGhpcy5yYXdzID0geyB9XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGlmICh0eXBlb2YgZGVmYXVsdHMgIT09ICdvYmplY3QnICYmIHR5cGVvZiBkZWZhdWx0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdQb3N0Q1NTIG5vZGVzIGNvbnN0cnVjdG9yIGFjY2VwdHMgb2JqZWN0LCBub3QgJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdHMpXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChsZXQgbmFtZSBpbiBkZWZhdWx0cykge1xuICAgICAgdGhpc1tuYW1lXSA9IGRlZmF1bHRzW25hbWVdXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBgQ3NzU3ludGF4RXJyb3JgIGluc3RhbmNlIGNvbnRhaW5pbmcgdGhlIG9yaWdpbmFsIHBvc2l0aW9uXG4gICAqIG9mIHRoZSBub2RlIGluIHRoZSBzb3VyY2UsIHNob3dpbmcgbGluZSBhbmQgY29sdW1uIG51bWJlcnMgYW5kIGFsc29cbiAgICogYSBzbWFsbCBleGNlcnB0IHRvIGZhY2lsaXRhdGUgZGVidWdnaW5nLlxuICAgKlxuICAgKiBJZiBwcmVzZW50LCBhbiBpbnB1dCBzb3VyY2UgbWFwIHdpbGwgYmUgdXNlZCB0byBnZXQgdGhlIG9yaWdpbmFsIHBvc2l0aW9uXG4gICAqIG9mIHRoZSBzb3VyY2UsIGV2ZW4gZnJvbSBhIHByZXZpb3VzIGNvbXBpbGF0aW9uIHN0ZXBcbiAgICogKGUuZy4sIGZyb20gU2FzcyBjb21waWxhdGlvbikuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHByb2R1Y2VzIHZlcnkgdXNlZnVsIGVycm9yIG1lc3NhZ2VzLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAgICAgRXJyb3IgZGVzY3JpcHRpb24uXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gICAgICBPcHRpb25zLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0cy5wbHVnaW4gUGx1Z2luIG5hbWUgdGhhdCBjcmVhdGVkIHRoaXMgZXJyb3IuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQb3N0Q1NTIHdpbGwgc2V0IGl0IGF1dG9tYXRpY2FsbHkuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRzLndvcmQgICBBIHdvcmQgaW5zaWRlIGEgbm9kZeKAmXMgc3RyaW5nIHRoYXQgc2hvdWxkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZSBoaWdobGlnaHRlZCBhcyB0aGUgc291cmNlIG9mIHRoZSBlcnJvci5cbiAgICogQHBhcmFtIHtudW1iZXJ9IG9wdHMuaW5kZXggIEFuIGluZGV4IGluc2lkZSBhIG5vZGXigJlzIHN0cmluZyB0aGF0IHNob3VsZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmUgaGlnaGxpZ2h0ZWQgYXMgdGhlIHNvdXJjZSBvZiB0aGUgZXJyb3IuXG4gICAqXG4gICAqIEByZXR1cm4ge0Nzc1N5bnRheEVycm9yfSBFcnJvciBvYmplY3QgdG8gdGhyb3cgaXQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlmICghdmFyaWFibGVzW25hbWVdKSB7XG4gICAqICAgdGhyb3cgZGVjbC5lcnJvcignVW5rbm93biB2YXJpYWJsZSAnICsgbmFtZSwgeyB3b3JkOiBuYW1lIH0pXG4gICAqICAgLy8gQ3NzU3ludGF4RXJyb3I6IHBvc3Rjc3MtdmFyczphLnNhc3M6NDozOiBVbmtub3duIHZhcmlhYmxlICRibGFja1xuICAgKiAgIC8vICAgY29sb3I6ICRibGFja1xuICAgKiAgIC8vIGFcbiAgICogICAvLyAgICAgICAgICBeXG4gICAqICAgLy8gICBiYWNrZ3JvdW5kOiB3aGl0ZVxuICAgKiB9XG4gICAqL1xuICBlcnJvciAobWVzc2FnZSwgb3B0cyA9IHsgfSkge1xuICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgbGV0IHBvcyA9IHRoaXMucG9zaXRpb25CeShvcHRzKVxuICAgICAgcmV0dXJuIHRoaXMuc291cmNlLmlucHV0LmVycm9yKG1lc3NhZ2UsIHBvcy5saW5lLCBwb3MuY29sdW1uLCBvcHRzKVxuICAgIH1cbiAgICByZXR1cm4gbmV3IENzc1N5bnRheEVycm9yKG1lc3NhZ2UpXG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgaXMgcHJvdmlkZWQgYXMgYSBjb252ZW5pZW5jZSB3cmFwcGVyIGZvciB7QGxpbmsgUmVzdWx0I3dhcm59LlxuICAgKlxuICAgKiBAcGFyYW0ge1Jlc3VsdH0gcmVzdWx0ICAgICAgVGhlIHtAbGluayBSZXN1bHR9IGluc3RhbmNlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0IHdpbGwgcmVjZWl2ZSB0aGUgd2FybmluZy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgICAgICAgIFdhcm5pbmcgbWVzc2FnZS5cbiAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAgICAgIE9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdHMucGx1Z2luIFBsdWdpbiBuYW1lIHRoYXQgY3JlYXRlZCB0aGlzIHdhcm5pbmcuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQb3N0Q1NTIHdpbGwgc2V0IGl0IGF1dG9tYXRpY2FsbHkuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRzLndvcmQgICBBIHdvcmQgaW5zaWRlIGEgbm9kZeKAmXMgc3RyaW5nIHRoYXQgc2hvdWxkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZSBoaWdobGlnaHRlZCBhcyB0aGUgc291cmNlIG9mIHRoZSB3YXJuaW5nLlxuICAgKiBAcGFyYW0ge251bWJlcn0gb3B0cy5pbmRleCAgQW4gaW5kZXggaW5zaWRlIGEgbm9kZeKAmXMgc3RyaW5nIHRoYXQgc2hvdWxkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZSBoaWdobGlnaHRlZCBhcyB0aGUgc291cmNlIG9mIHRoZSB3YXJuaW5nLlxuICAgKlxuICAgKiBAcmV0dXJuIHtXYXJuaW5nfSBDcmVhdGVkIHdhcm5pbmcgb2JqZWN0LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBwbHVnaW4gPSBwb3N0Y3NzLnBsdWdpbigncG9zdGNzcy1kZXByZWNhdGVkJywgKCkgPT4ge1xuICAgKiAgIHJldHVybiAocm9vdCwgcmVzdWx0KSA9PiB7XG4gICAqICAgICByb290LndhbGtEZWNscygnYmFkJywgZGVjbCA9PiB7XG4gICAqICAgICAgIGRlY2wud2FybihyZXN1bHQsICdEZXByZWNhdGVkIHByb3BlcnR5IGJhZCcpXG4gICAqICAgICB9KVxuICAgKiAgIH1cbiAgICogfSlcbiAgICovXG4gIHdhcm4gKHJlc3VsdCwgdGV4dCwgb3B0cykge1xuICAgIGxldCBkYXRhID0geyBub2RlOiB0aGlzIH1cbiAgICBmb3IgKGxldCBpIGluIG9wdHMpIGRhdGFbaV0gPSBvcHRzW2ldXG4gICAgcmV0dXJuIHJlc3VsdC53YXJuKHRleHQsIGRhdGEpXG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgbm9kZSBmcm9tIGl0cyBwYXJlbnQgYW5kIGNsZWFucyB0aGUgcGFyZW50IHByb3BlcnRpZXNcbiAgICogZnJvbSB0aGUgbm9kZSBhbmQgaXRzIGNoaWxkcmVuLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpZiAoZGVjbC5wcm9wLm1hdGNoKC9eLXdlYmtpdC0vKSkge1xuICAgKiAgIGRlY2wucmVtb3ZlKClcbiAgICogfVxuICAgKlxuICAgKiBAcmV0dXJuIHtOb2RlfSBOb2RlIHRvIG1ha2UgY2FsbHMgY2hhaW4uXG4gICAqL1xuICByZW1vdmUgKCkge1xuICAgIGlmICh0aGlzLnBhcmVudCkge1xuICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcylcbiAgICB9XG4gICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBDU1Mgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmdpZmllcnxzeW50YXh9IFtzdHJpbmdpZmllcl0gQSBzeW50YXggdG8gdXNlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluIHN0cmluZyBnZW5lcmF0aW9uLlxuICAgKlxuICAgKiBAcmV0dXJuIHtzdHJpbmd9IENTUyBzdHJpbmcgb2YgdGhpcyBub2RlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBwb3N0Y3NzLnJ1bGUoeyBzZWxlY3RvcjogJ2EnIH0pLnRvU3RyaW5nKCkgLy89PiBcImEge31cIlxuICAgKi9cbiAgdG9TdHJpbmcgKHN0cmluZ2lmaWVyID0gc3RyaW5naWZ5KSB7XG4gICAgaWYgKHN0cmluZ2lmaWVyLnN0cmluZ2lmeSkgc3RyaW5naWZpZXIgPSBzdHJpbmdpZmllci5zdHJpbmdpZnlcbiAgICBsZXQgcmVzdWx0ID0gJydcbiAgICBzdHJpbmdpZmllcih0aGlzLCBpID0+IHtcbiAgICAgIHJlc3VsdCArPSBpXG4gICAgfSlcbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBleGFjdCBjbG9uZSBvZiB0aGUgbm9kZS5cbiAgICpcbiAgICogVGhlIHJlc3VsdGluZyBjbG9uZWQgbm9kZSBhbmQgaXRzIChjbG9uZWQpIGNoaWxkcmVuIHdpbGwgcmV0YWluXG4gICAqIGNvZGUgc3R5bGUgcHJvcGVydGllcy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IFtvdmVycmlkZXNdIE5ldyBwcm9wZXJ0aWVzIHRvIG92ZXJyaWRlIGluIHRoZSBjbG9uZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogZGVjbC5yYXdzLmJlZm9yZSAgICAvLz0+IFwiXFxuICBcIlxuICAgKiBjb25zdCBjbG9uZWQgPSBkZWNsLmNsb25lKHsgcHJvcDogJy1tb3otJyArIGRlY2wucHJvcCB9KVxuICAgKiBjbG9uZWQucmF3cy5iZWZvcmUgIC8vPT4gXCJcXG4gIFwiXG4gICAqIGNsb25lZC50b1N0cmluZygpICAgLy89PiAtbW96LXRyYW5zZm9ybTogc2NhbGUoMClcbiAgICpcbiAgICogQHJldHVybiB7Tm9kZX0gQ2xvbmUgb2YgdGhlIG5vZGUuXG4gICAqL1xuICBjbG9uZSAob3ZlcnJpZGVzID0geyB9KSB7XG4gICAgbGV0IGNsb25lZCA9IGNsb25lTm9kZSh0aGlzKVxuICAgIGZvciAobGV0IG5hbWUgaW4gb3ZlcnJpZGVzKSB7XG4gICAgICBjbG9uZWRbbmFtZV0gPSBvdmVycmlkZXNbbmFtZV1cbiAgICB9XG4gICAgcmV0dXJuIGNsb25lZFxuICB9XG5cbiAgLyoqXG4gICAqIFNob3J0Y3V0IHRvIGNsb25lIHRoZSBub2RlIGFuZCBpbnNlcnQgdGhlIHJlc3VsdGluZyBjbG9uZWQgbm9kZVxuICAgKiBiZWZvcmUgdGhlIGN1cnJlbnQgbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IFtvdmVycmlkZXNdIE1ldyBwcm9wZXJ0aWVzIHRvIG92ZXJyaWRlIGluIHRoZSBjbG9uZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogZGVjbC5jbG9uZUJlZm9yZSh7IHByb3A6ICctbW96LScgKyBkZWNsLnByb3AgfSlcbiAgICpcbiAgICogQHJldHVybiB7Tm9kZX0gTmV3IG5vZGVcbiAgICovXG4gIGNsb25lQmVmb3JlIChvdmVycmlkZXMgPSB7IH0pIHtcbiAgICBsZXQgY2xvbmVkID0gdGhpcy5jbG9uZShvdmVycmlkZXMpXG4gICAgdGhpcy5wYXJlbnQuaW5zZXJ0QmVmb3JlKHRoaXMsIGNsb25lZClcbiAgICByZXR1cm4gY2xvbmVkXG4gIH1cblxuICAvKipcbiAgICogU2hvcnRjdXQgdG8gY2xvbmUgdGhlIG5vZGUgYW5kIGluc2VydCB0aGUgcmVzdWx0aW5nIGNsb25lZCBub2RlXG4gICAqIGFmdGVyIHRoZSBjdXJyZW50IG5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBbb3ZlcnJpZGVzXSBOZXcgcHJvcGVydGllcyB0byBvdmVycmlkZSBpbiB0aGUgY2xvbmUuXG4gICAqXG4gICAqIEByZXR1cm4ge05vZGV9IE5ldyBub2RlLlxuICAgKi9cbiAgY2xvbmVBZnRlciAob3ZlcnJpZGVzID0geyB9KSB7XG4gICAgbGV0IGNsb25lZCA9IHRoaXMuY2xvbmUob3ZlcnJpZGVzKVxuICAgIHRoaXMucGFyZW50Lmluc2VydEFmdGVyKHRoaXMsIGNsb25lZClcbiAgICByZXR1cm4gY2xvbmVkXG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0cyBub2RlKHMpIGJlZm9yZSB0aGUgY3VycmVudCBub2RlIGFuZCByZW1vdmVzIHRoZSBjdXJyZW50IG5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSB7Li4uTm9kZX0gbm9kZXMgTW9kZShzKSB0byByZXBsYWNlIGN1cnJlbnQgb25lLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpZiAoYXRydWxlLm5hbWUgPT09ICdtaXhpbicpIHtcbiAgICogICBhdHJ1bGUucmVwbGFjZVdpdGgobWl4aW5SdWxlc1thdHJ1bGUucGFyYW1zXSlcbiAgICogfVxuICAgKlxuICAgKiBAcmV0dXJuIHtOb2RlfSBDdXJyZW50IG5vZGUgdG8gbWV0aG9kcyBjaGFpbi5cbiAgICovXG4gIHJlcGxhY2VXaXRoICguLi5ub2Rlcykge1xuICAgIGlmICh0aGlzLnBhcmVudCkge1xuICAgICAgZm9yIChsZXQgbm9kZSBvZiBub2Rlcykge1xuICAgICAgICB0aGlzLnBhcmVudC5pbnNlcnRCZWZvcmUodGhpcywgbm9kZSlcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZW1vdmUoKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbmV4dCBjaGlsZCBvZiB0aGUgbm9kZeKAmXMgcGFyZW50LlxuICAgKiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIHRoZSBjdXJyZW50IG5vZGUgaXMgdGhlIGxhc3QgY2hpbGQuXG4gICAqXG4gICAqIEByZXR1cm4ge05vZGV8dW5kZWZpbmVkfSBOZXh0IG5vZGUuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlmIChjb21tZW50LnRleHQgPT09ICdkZWxldGUgbmV4dCcpIHtcbiAgICogICBjb25zdCBuZXh0ID0gY29tbWVudC5uZXh0KClcbiAgICogICBpZiAobmV4dCkge1xuICAgKiAgICAgbmV4dC5yZW1vdmUoKVxuICAgKiAgIH1cbiAgICogfVxuICAgKi9cbiAgbmV4dCAoKSB7XG4gICAgaWYgKCF0aGlzLnBhcmVudCkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGxldCBpbmRleCA9IHRoaXMucGFyZW50LmluZGV4KHRoaXMpXG4gICAgcmV0dXJuIHRoaXMucGFyZW50Lm5vZGVzW2luZGV4ICsgMV1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBwcmV2aW91cyBjaGlsZCBvZiB0aGUgbm9kZeKAmXMgcGFyZW50LlxuICAgKiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIHRoZSBjdXJyZW50IG5vZGUgaXMgdGhlIGZpcnN0IGNoaWxkLlxuICAgKlxuICAgKiBAcmV0dXJuIHtOb2RlfHVuZGVmaW5lZH0gUHJldmlvdXMgbm9kZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgYW5ub3RhdGlvbiA9IGRlY2wucHJldigpXG4gICAqIGlmIChhbm5vdGF0aW9uLnR5cGUgPT09ICdjb21tZW50Jykge1xuICAgKiAgIHJlYWRBbm5vdGF0aW9uKGFubm90YXRpb24udGV4dClcbiAgICogfVxuICAgKi9cbiAgcHJldiAoKSB7XG4gICAgaWYgKCF0aGlzLnBhcmVudCkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGxldCBpbmRleCA9IHRoaXMucGFyZW50LmluZGV4KHRoaXMpXG4gICAgcmV0dXJuIHRoaXMucGFyZW50Lm5vZGVzW2luZGV4IC0gMV1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnQgbmV3IG5vZGUgYmVmb3JlIGN1cnJlbnQgbm9kZSB0byBjdXJyZW50IG5vZGXigJlzIHBhcmVudC5cbiAgICpcbiAgICogSnVzdCBhbGlhcyBmb3IgYG5vZGUucGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBhZGQpYC5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfG9iamVjdHxzdHJpbmd8Tm9kZVtdfSBhZGQgTmV3IG5vZGUuXG4gICAqXG4gICAqIEByZXR1cm4ge05vZGV9IFRoaXMgbm9kZSBmb3IgbWV0aG9kcyBjaGFpbi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogZGVjbC5iZWZvcmUoJ2NvbnRlbnQ6IFwiXCInKVxuICAgKi9cbiAgYmVmb3JlIChhZGQpIHtcbiAgICB0aGlzLnBhcmVudC5pbnNlcnRCZWZvcmUodGhpcywgYWRkKVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0IG5ldyBub2RlIGFmdGVyIGN1cnJlbnQgbm9kZSB0byBjdXJyZW50IG5vZGXigJlzIHBhcmVudC5cbiAgICpcbiAgICogSnVzdCBhbGlhcyBmb3IgYG5vZGUucGFyZW50Lmluc2VydEFmdGVyKG5vZGUsIGFkZClgLlxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV8b2JqZWN0fHN0cmluZ3xOb2RlW119IGFkZCBOZXcgbm9kZS5cbiAgICpcbiAgICogQHJldHVybiB7Tm9kZX0gVGhpcyBub2RlIGZvciBtZXRob2RzIGNoYWluLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBkZWNsLmFmdGVyKCdjb2xvcjogYmxhY2snKVxuICAgKi9cbiAgYWZ0ZXIgKGFkZCkge1xuICAgIHRoaXMucGFyZW50Lmluc2VydEFmdGVyKHRoaXMsIGFkZClcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgdG9KU09OICgpIHtcbiAgICBsZXQgZml4ZWQgPSB7IH1cblxuICAgIGZvciAobGV0IG5hbWUgaW4gdGhpcykge1xuICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KG5hbWUpKSBjb250aW51ZVxuICAgICAgaWYgKG5hbWUgPT09ICdwYXJlbnQnKSBjb250aW51ZVxuICAgICAgbGV0IHZhbHVlID0gdGhpc1tuYW1lXVxuXG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBmaXhlZFtuYW1lXSA9IHZhbHVlLm1hcChpID0+IHtcbiAgICAgICAgICBpZiAodHlwZW9mIGkgPT09ICdvYmplY3QnICYmIGkudG9KU09OKSB7XG4gICAgICAgICAgICByZXR1cm4gaS50b0pTT04oKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS50b0pTT04pIHtcbiAgICAgICAgZml4ZWRbbmFtZV0gPSB2YWx1ZS50b0pTT04oKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZml4ZWRbbmFtZV0gPSB2YWx1ZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmaXhlZFxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB7QGxpbmsgTm9kZSNyYXdzfSB2YWx1ZS4gSWYgdGhlIG5vZGUgaXMgbWlzc2luZ1xuICAgKiB0aGUgY29kZSBzdHlsZSBwcm9wZXJ0eSAoYmVjYXVzZSB0aGUgbm9kZSB3YXMgbWFudWFsbHkgYnVpbHQgb3IgY2xvbmVkKSxcbiAgICogUG9zdENTUyB3aWxsIHRyeSB0byBhdXRvZGV0ZWN0IHRoZSBjb2RlIHN0eWxlIHByb3BlcnR5IGJ5IGxvb2tpbmdcbiAgICogYXQgb3RoZXIgbm9kZXMgaW4gdGhlIHRyZWUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wICAgICAgICAgIE5hbWUgb2YgY29kZSBzdHlsZSBwcm9wZXJ0eS5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtkZWZhdWx0VHlwZV0gTmFtZSBvZiBkZWZhdWx0IHZhbHVlLCBpdCBjYW4gYmUgbWlzc2VkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIHRoZSB2YWx1ZSBpcyB0aGUgc2FtZSBhcyBwcm9wLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZSgnYSB7IGJhY2tncm91bmQ6IHdoaXRlIH0nKVxuICAgKiByb290Lm5vZGVzWzBdLmFwcGVuZCh7IHByb3A6ICdjb2xvcicsIHZhbHVlOiAnYmxhY2snIH0pXG4gICAqIHJvb3Qubm9kZXNbMF0ubm9kZXNbMV0ucmF3cy5iZWZvcmUgICAvLz0+IHVuZGVmaW5lZFxuICAgKiByb290Lm5vZGVzWzBdLm5vZGVzWzFdLnJhdygnYmVmb3JlJykgLy89PiAnICdcbiAgICpcbiAgICogQHJldHVybiB7c3RyaW5nfSBDb2RlIHN0eWxlIHZhbHVlLlxuICAgKi9cbiAgcmF3IChwcm9wLCBkZWZhdWx0VHlwZSkge1xuICAgIGxldCBzdHIgPSBuZXcgU3RyaW5naWZpZXIoKVxuICAgIHJldHVybiBzdHIucmF3KHRoaXMsIHByb3AsIGRlZmF1bHRUeXBlKVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBSb290IGluc3RhbmNlIG9mIHRoZSBub2Rl4oCZcyB0cmVlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiByb290Lm5vZGVzWzBdLm5vZGVzWzBdLnJvb3QoKSA9PT0gcm9vdFxuICAgKlxuICAgKiBAcmV0dXJuIHtSb290fSBSb290IHBhcmVudC5cbiAgICovXG4gIHJvb3QgKCkge1xuICAgIGxldCByZXN1bHQgPSB0aGlzXG4gICAgd2hpbGUgKHJlc3VsdC5wYXJlbnQpIHJlc3VsdCA9IHJlc3VsdC5wYXJlbnRcbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgdGhlIGNvZGUgc3R5bGUgcHJvcGVydGllcyBmb3IgdGhlIG5vZGUgYW5kIGl0cyBjaGlsZHJlbi5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBba2VlcEJldHdlZW5dIEtlZXAgdGhlIHJhd3MuYmV0d2VlbiBzeW1ib2xzLlxuICAgKlxuICAgKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIG5vZGUucmF3cy5iZWZvcmUgIC8vPT4gJyAnXG4gICAqIG5vZGUuY2xlYW5SYXdzKClcbiAgICogbm9kZS5yYXdzLmJlZm9yZSAgLy89PiB1bmRlZmluZWRcbiAgICovXG4gIGNsZWFuUmF3cyAoa2VlcEJldHdlZW4pIHtcbiAgICBkZWxldGUgdGhpcy5yYXdzLmJlZm9yZVxuICAgIGRlbGV0ZSB0aGlzLnJhd3MuYWZ0ZXJcbiAgICBpZiAoIWtlZXBCZXR3ZWVuKSBkZWxldGUgdGhpcy5yYXdzLmJldHdlZW5cbiAgfVxuXG4gIHBvc2l0aW9uSW5zaWRlIChpbmRleCkge1xuICAgIGxldCBzdHJpbmcgPSB0aGlzLnRvU3RyaW5nKClcbiAgICBsZXQgY29sdW1uID0gdGhpcy5zb3VyY2Uuc3RhcnQuY29sdW1uXG4gICAgbGV0IGxpbmUgPSB0aGlzLnNvdXJjZS5zdGFydC5saW5lXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGluZGV4OyBpKyspIHtcbiAgICAgIGlmIChzdHJpbmdbaV0gPT09ICdcXG4nKSB7XG4gICAgICAgIGNvbHVtbiA9IDFcbiAgICAgICAgbGluZSArPSAxXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb2x1bW4gKz0gMVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGxpbmUsIGNvbHVtbiB9XG4gIH1cblxuICBwb3NpdGlvbkJ5IChvcHRzKSB7XG4gICAgbGV0IHBvcyA9IHRoaXMuc291cmNlLnN0YXJ0XG4gICAgaWYgKG9wdHMuaW5kZXgpIHtcbiAgICAgIHBvcyA9IHRoaXMucG9zaXRpb25JbnNpZGUob3B0cy5pbmRleClcbiAgICB9IGVsc2UgaWYgKG9wdHMud29yZCkge1xuICAgICAgbGV0IGluZGV4ID0gdGhpcy50b1N0cmluZygpLmluZGV4T2Yob3B0cy53b3JkKVxuICAgICAgaWYgKGluZGV4ICE9PSAtMSkgcG9zID0gdGhpcy5wb3NpdGlvbkluc2lkZShpbmRleClcbiAgICB9XG4gICAgcmV0dXJuIHBvc1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJvZiBOb2RlI1xuICAgKiBAbWVtYmVyIHtzdHJpbmd9IHR5cGUgU3RyaW5nIHJlcHJlc2VudGluZyB0aGUgbm9kZeKAmXMgdHlwZS5cbiAgICogICAgICAgICAgICAgICAgICAgICAgIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHJvb3RgLCBgYXRydWxlYCwgYHJ1bGVgLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgYGRlY2xgLCBvciBgY29tbWVudGAuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHBvc3Rjc3MuZGVjbCh7IHByb3A6ICdjb2xvcicsIHZhbHVlOiAnYmxhY2snIH0pLnR5cGUgLy89PiAnZGVjbCdcbiAgICovXG5cbiAgLyoqXG4gICAqIEBtZW1iZXJvZiBOb2RlI1xuICAgKiBAbWVtYmVyIHtDb250YWluZXJ9IHBhcmVudCBUaGUgbm9kZeKAmXMgcGFyZW50IG5vZGUuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHJvb3Qubm9kZXNbMF0ucGFyZW50ID09PSByb290XG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbWVtYmVyb2YgTm9kZSNcbiAgICogQG1lbWJlciB7c291cmNlfSBzb3VyY2UgVGhlIGlucHV0IHNvdXJjZSBvZiB0aGUgbm9kZS5cbiAgICpcbiAgICogVGhlIHByb3BlcnR5IGlzIHVzZWQgaW4gc291cmNlIG1hcCBnZW5lcmF0aW9uLlxuICAgKlxuICAgKiBJZiB5b3UgY3JlYXRlIGEgbm9kZSBtYW51YWxseSAoZS5nLiwgd2l0aCBgcG9zdGNzcy5kZWNsKClgKSxcbiAgICogdGhhdCBub2RlIHdpbGwgbm90IGhhdmUgYSBgc291cmNlYCBwcm9wZXJ0eSBhbmQgd2lsbCBiZSBhYnNlbnRcbiAgICogZnJvbSB0aGUgc291cmNlIG1hcC4gRm9yIHRoaXMgcmVhc29uLCB0aGUgcGx1Z2luIGRldmVsb3BlciBzaG91bGRcbiAgICogY29uc2lkZXIgY2xvbmluZyBub2RlcyB0byBjcmVhdGUgbmV3IG9uZXMgKGluIHdoaWNoIGNhc2UgdGhlIG5ldyBub2Rl4oCZc1xuICAgKiBzb3VyY2Ugd2lsbCByZWZlcmVuY2UgdGhlIG9yaWdpbmFsLCBjbG9uZWQgbm9kZSkgb3Igc2V0dGluZ1xuICAgKiB0aGUgYHNvdXJjZWAgcHJvcGVydHkgbWFudWFsbHkuXG4gICAqXG4gICAqIGBgYGpzXG4gICAqIC8vIEJhZFxuICAgKiBjb25zdCBwcmVmaXhlZCA9IHBvc3Rjc3MuZGVjbCh7XG4gICAqICAgcHJvcDogJy1tb3otJyArIGRlY2wucHJvcCxcbiAgICogICB2YWx1ZTogZGVjbC52YWx1ZVxuICAgKiB9KVxuICAgKlxuICAgKiAvLyBHb29kXG4gICAqIGNvbnN0IHByZWZpeGVkID0gZGVjbC5jbG9uZSh7IHByb3A6ICctbW96LScgKyBkZWNsLnByb3AgfSlcbiAgICogYGBgXG4gICAqXG4gICAqIGBgYGpzXG4gICAqIGlmIChhdHJ1bGUubmFtZSA9PT0gJ2FkZC1saW5rJykge1xuICAgKiAgIGNvbnN0IHJ1bGUgPSBwb3N0Y3NzLnJ1bGUoeyBzZWxlY3RvcjogJ2EnLCBzb3VyY2U6IGF0cnVsZS5zb3VyY2UgfSlcbiAgICogICBhdHJ1bGUucGFyZW50Lmluc2VydEJlZm9yZShhdHJ1bGUsIHJ1bGUpXG4gICAqIH1cbiAgICogYGBgXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGRlY2wuc291cmNlLmlucHV0LmZyb20gLy89PiAnL2hvbWUvYWkvYS5zYXNzJ1xuICAgKiBkZWNsLnNvdXJjZS5zdGFydCAgICAgIC8vPT4geyBsaW5lOiAxMCwgY29sdW1uOiAyIH1cbiAgICogZGVjbC5zb3VyY2UuZW5kICAgICAgICAvLz0+IHsgbGluZTogMTAsIGNvbHVtbjogMTIgfVxuICAgKi9cblxuICAvKipcbiAgICogQG1lbWJlcm9mIE5vZGUjXG4gICAqIEBtZW1iZXIge29iamVjdH0gcmF3cyBJbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBieXRlLXRvLWJ5dGUgZXF1YWxcbiAgICogICAgICAgICAgICAgICAgICAgICAgIG5vZGUgc3RyaW5nIGFzIGl0IHdhcyBpbiB0aGUgb3JpZ2luIGlucHV0LlxuICAgKlxuICAgKiBFdmVyeSBwYXJzZXIgc2F2ZXMgaXRzIG93biBwcm9wZXJ0aWVzLFxuICAgKiBidXQgdGhlIGRlZmF1bHQgQ1NTIHBhcnNlciB1c2VzOlxuICAgKlxuICAgKiAqIGBiZWZvcmVgOiB0aGUgc3BhY2Ugc3ltYm9scyBiZWZvcmUgdGhlIG5vZGUuIEl0IGFsc28gc3RvcmVzIGAqYFxuICAgKiAgIGFuZCBgX2Agc3ltYm9scyBiZWZvcmUgdGhlIGRlY2xhcmF0aW9uIChJRSBoYWNrKS5cbiAgICogKiBgYWZ0ZXJgOiB0aGUgc3BhY2Ugc3ltYm9scyBhZnRlciB0aGUgbGFzdCBjaGlsZCBvZiB0aGUgbm9kZVxuICAgKiAgIHRvIHRoZSBlbmQgb2YgdGhlIG5vZGUuXG4gICAqICogYGJldHdlZW5gOiB0aGUgc3ltYm9scyBiZXR3ZWVuIHRoZSBwcm9wZXJ0eSBhbmQgdmFsdWVcbiAgICogICBmb3IgZGVjbGFyYXRpb25zLCBzZWxlY3RvciBhbmQgYHtgIGZvciBydWxlcywgb3IgbGFzdCBwYXJhbWV0ZXJcbiAgICogICBhbmQgYHtgIGZvciBhdC1ydWxlcy5cbiAgICogKiBgc2VtaWNvbG9uYDogY29udGFpbnMgdHJ1ZSBpZiB0aGUgbGFzdCBjaGlsZCBoYXNcbiAgICogICBhbiAob3B0aW9uYWwpIHNlbWljb2xvbi5cbiAgICogKiBgYWZ0ZXJOYW1lYDogdGhlIHNwYWNlIGJldHdlZW4gdGhlIGF0LXJ1bGUgbmFtZSBhbmQgaXRzIHBhcmFtZXRlcnMuXG4gICAqICogYGxlZnRgOiB0aGUgc3BhY2Ugc3ltYm9scyBiZXR3ZWVuIGAvKmAgYW5kIHRoZSBjb21tZW504oCZcyB0ZXh0LlxuICAgKiAqIGByaWdodGA6IHRoZSBzcGFjZSBzeW1ib2xzIGJldHdlZW4gdGhlIGNvbW1lbnTigJlzIHRleHRcbiAgICogICBhbmQgPGNvZGU+KiYjNDc7PC9jb2RlPi5cbiAgICogKiBgaW1wb3J0YW50YDogdGhlIGNvbnRlbnQgb2YgdGhlIGltcG9ydGFudCBzdGF0ZW1lbnQsXG4gICAqICAgaWYgaXQgaXMgbm90IGp1c3QgYCFpbXBvcnRhbnRgLlxuICAgKlxuICAgKiBQb3N0Q1NTIGNsZWFucyBzZWxlY3RvcnMsIGRlY2xhcmF0aW9uIHZhbHVlcyBhbmQgYXQtcnVsZSBwYXJhbWV0ZXJzXG4gICAqIGZyb20gY29tbWVudHMgYW5kIGV4dHJhIHNwYWNlcywgYnV0IGl0IHN0b3JlcyBvcmlnaW4gY29udGVudCBpbiByYXdzXG4gICAqIHByb3BlcnRpZXMuIEFzIHN1Y2gsIGlmIHlvdSBkb27igJl0IGNoYW5nZSBhIGRlY2xhcmF0aW9u4oCZcyB2YWx1ZSxcbiAgICogUG9zdENTUyB3aWxsIHVzZSB0aGUgcmF3IHZhbHVlIHdpdGggY29tbWVudHMuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhIHtcXG4gIGNvbG9yOmJsYWNrXFxufScpXG4gICAqIHJvb3QuZmlyc3QuZmlyc3QucmF3cyAvLz0+IHsgYmVmb3JlOiAnXFxuICAnLCBiZXR3ZWVuOiAnOicgfVxuICAgKi9cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVxuXG4vKipcbiAqIEB0eXBlZGVmIHtvYmplY3R9IHBvc2l0aW9uXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGluZSAgIFNvdXJjZSBsaW5lIGluIGZpbGUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29sdW1uIFNvdXJjZSBjb2x1bW4gaW4gZmlsZS5cbiAqL1xuXG4vKipcbiAqIEB0eXBlZGVmIHtvYmplY3R9IHNvdXJjZVxuICogQHByb3BlcnR5IHtJbnB1dH0gaW5wdXQgICAge0BsaW5rIElucHV0fSB3aXRoIGlucHV0IGZpbGVcbiAqIEBwcm9wZXJ0eSB7cG9zaXRpb259IHN0YXJ0IFRoZSBzdGFydGluZyBwb3NpdGlvbiBvZiB0aGUgbm9kZeKAmXMgc291cmNlLlxuICogQHByb3BlcnR5IHtwb3NpdGlvbn0gZW5kICAgVGhlIGVuZGluZyBwb3NpdGlvbiBvZiB0aGUgbm9kZeKAmXMgc291cmNlLlxuICovXG4iXSwiZmlsZSI6Im5vZGUuanMifQ==
