"use strict";

exports.__esModule = true;
exports.default = void 0;

var _declaration = _interopRequireDefault(require("./declaration"));

var _comment = _interopRequireDefault(require("./comment"));

var _node = _interopRequireDefault(require("./node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function cleanSource(nodes) {
  return nodes.map(function (i) {
    if (i.nodes) i.nodes = cleanSource(i.nodes);
    delete i.source;
    return i;
  });
}
/**
 * The {@link Root}, {@link AtRule}, and {@link Rule} container nodes
 * inherit some common methods to help work with their children.
 *
 * Note that all containers can store any content. If you write a rule inside
 * a rule, PostCSS will parse it.
 *
 * @extends Node
 * @abstract
 */


var Container =
/*#__PURE__*/
function (_Node) {
  _inheritsLoose(Container, _Node);

  function Container() {
    return _Node.apply(this, arguments) || this;
  }

  var _proto = Container.prototype;

  _proto.push = function push(child) {
    child.parent = this;
    this.nodes.push(child);
    return this;
  };
  /**
   * Iterates through the container’s immediate children,
   * calling `callback` for each child.
   *
   * Returning `false` in the callback will break iteration.
   *
   * This method only iterates through the container’s immediate children.
   * If you need to recursively iterate through all the container’s descendant
   * nodes, use {@link Container#walk}.
   *
   * Unlike the for `{}`-cycle or `Array#forEach` this iterator is safe
   * if you are mutating the array of child nodes during iteration.
   * PostCSS will adjust the current index to match the mutations.
   *
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * const root = postcss.parse('a { color: black; z-index: 1 }')
   * const rule = root.first
   *
   * for (const decl of rule.nodes) {
   *   decl.cloneBefore({ prop: '-webkit-' + decl.prop })
   *   // Cycle will be infinite, because cloneBefore moves the current node
   *   // to the next index
   * }
   *
   * rule.each(decl => {
   *   decl.cloneBefore({ prop: '-webkit-' + decl.prop })
   *   // Will be executed only for color and z-index
   * })
   */


  _proto.each = function each(callback) {
    if (!this.lastEach) this.lastEach = 0;
    if (!this.indexes) this.indexes = {};
    this.lastEach += 1;
    var id = this.lastEach;
    this.indexes[id] = 0;
    if (!this.nodes) return undefined;
    var index, result;

    while (this.indexes[id] < this.nodes.length) {
      index = this.indexes[id];
      result = callback(this.nodes[index], index);
      if (result === false) break;
      this.indexes[id] += 1;
    }

    delete this.indexes[id];
    return result;
  };
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each node.
   *
   * Like container.each(), this method is safe to use
   * if you are mutating arrays during iteration.
   *
   * If you only need to iterate through the container’s immediate children,
   * use {@link Container#each}.
   *
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walk(node => {
   *   // Traverses all descendant nodes.
   * })
   */


  _proto.walk = function walk(callback) {
    return this.each(function (child, i) {
      var result;

      try {
        result = callback(child, i);
      } catch (e) {
        e.postcssNode = child;

        if (e.stack && child.source && /\n\s{4}at /.test(e.stack)) {
          var s = child.source;
          e.stack = e.stack.replace(/\n\s{4}at /, "$&" + s.input.from + ":" + s.start.line + ":" + s.start.column + "$&");
        }

        throw e;
      }

      if (result !== false && child.walk) {
        result = child.walk(callback);
      }

      return result;
    });
  };
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each declaration node.
   *
   * If you pass a filter, iteration will only happen over declarations
   * with matching properties.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {string|RegExp} [prop]   String or regular expression
   *                                 to filter declarations by property name.
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walkDecls(decl => {
   *   checkPropertySupport(decl.prop)
   * })
   *
   * root.walkDecls('border-radius', decl => {
   *   decl.remove()
   * })
   *
   * root.walkDecls(/^background/, decl => {
   *   decl.value = takeFirstColorFromGradient(decl.value)
   * })
   */


  _proto.walkDecls = function walkDecls(prop, callback) {
    if (!callback) {
      callback = prop;
      return this.walk(function (child, i) {
        if (child.type === 'decl') {
          return callback(child, i);
        }
      });
    }

    if (prop instanceof RegExp) {
      return this.walk(function (child, i) {
        if (child.type === 'decl' && prop.test(child.prop)) {
          return callback(child, i);
        }
      });
    }

    return this.walk(function (child, i) {
      if (child.type === 'decl' && child.prop === prop) {
        return callback(child, i);
      }
    });
  };
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each rule node.
   *
   * If you pass a filter, iteration will only happen over rules
   * with matching selectors.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {string|RegExp} [selector] String or regular expression
   *                                   to filter rules by selector.
   * @param {childIterator} callback   Iterator receives each node and index.
   *
   * @return {false|undefined} returns `false` if iteration was broke.
   *
   * @example
   * const selectors = []
   * root.walkRules(rule => {
   *   selectors.push(rule.selector)
   * })
   * console.log(`Your CSS uses ${ selectors.length } selectors`)
   */


  _proto.walkRules = function walkRules(selector, callback) {
    if (!callback) {
      callback = selector;
      return this.walk(function (child, i) {
        if (child.type === 'rule') {
          return callback(child, i);
        }
      });
    }

    if (selector instanceof RegExp) {
      return this.walk(function (child, i) {
        if (child.type === 'rule' && selector.test(child.selector)) {
          return callback(child, i);
        }
      });
    }

    return this.walk(function (child, i) {
      if (child.type === 'rule' && child.selector === selector) {
        return callback(child, i);
      }
    });
  };
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each at-rule node.
   *
   * If you pass a filter, iteration will only happen over at-rules
   * that have matching names.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {string|RegExp} [name]   String or regular expression
   *                                 to filter at-rules by name.
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walkAtRules(rule => {
   *   if (isOld(rule.name)) rule.remove()
   * })
   *
   * let first = false
   * root.walkAtRules('charset', rule => {
   *   if (!first) {
   *     first = true
   *   } else {
   *     rule.remove()
   *   }
   * })
   */


  _proto.walkAtRules = function walkAtRules(name, callback) {
    if (!callback) {
      callback = name;
      return this.walk(function (child, i) {
        if (child.type === 'atrule') {
          return callback(child, i);
        }
      });
    }

    if (name instanceof RegExp) {
      return this.walk(function (child, i) {
        if (child.type === 'atrule' && name.test(child.name)) {
          return callback(child, i);
        }
      });
    }

    return this.walk(function (child, i) {
      if (child.type === 'atrule' && child.name === name) {
        return callback(child, i);
      }
    });
  };
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each comment node.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walkComments(comment => {
   *   comment.remove()
   * })
   */


  _proto.walkComments = function walkComments(callback) {
    return this.walk(function (child, i) {
      if (child.type === 'comment') {
        return callback(child, i);
      }
    });
  };
  /**
   * Inserts new nodes to the end of the container.
   *
   * @param {...(Node|object|string|Node[])} children New nodes.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * const decl1 = postcss.decl({ prop: 'color', value: 'black' })
   * const decl2 = postcss.decl({ prop: 'background-color', value: 'white' })
   * rule.append(decl1, decl2)
   *
   * root.append({ name: 'charset', params: '"UTF-8"' })  // at-rule
   * root.append({ selector: 'a' })                       // rule
   * rule.append({ prop: 'color', value: 'black' })       // declaration
   * rule.append({ text: 'Comment' })                     // comment
   *
   * root.append('a {}')
   * root.first.append('color: black; z-index: 1')
   */


  _proto.append = function append() {
    for (var _len = arguments.length, children = new Array(_len), _key = 0; _key < _len; _key++) {
      children[_key] = arguments[_key];
    }

    for (var _i = 0; _i < children.length; _i++) {
      var child = children[_i];
      var nodes = this.normalize(child, this.last);

      for (var _iterator = nodes, _isArray = Array.isArray(_iterator), _i2 = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i2 >= _iterator.length) break;
          _ref = _iterator[_i2++];
        } else {
          _i2 = _iterator.next();
          if (_i2.done) break;
          _ref = _i2.value;
        }

        var node = _ref;
        this.nodes.push(node);
      }
    }

    return this;
  };
  /**
   * Inserts new nodes to the start of the container.
   *
   * @param {...(Node|object|string|Node[])} children New nodes.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * const decl1 = postcss.decl({ prop: 'color', value: 'black' })
   * const decl2 = postcss.decl({ prop: 'background-color', value: 'white' })
   * rule.prepend(decl1, decl2)
   *
   * root.append({ name: 'charset', params: '"UTF-8"' })  // at-rule
   * root.append({ selector: 'a' })                       // rule
   * rule.append({ prop: 'color', value: 'black' })       // declaration
   * rule.append({ text: 'Comment' })                     // comment
   *
   * root.append('a {}')
   * root.first.append('color: black; z-index: 1')
   */


  _proto.prepend = function prepend() {
    for (var _len2 = arguments.length, children = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      children[_key2] = arguments[_key2];
    }

    children = children.reverse();

    for (var _iterator2 = children, _isArray2 = Array.isArray(_iterator2), _i3 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray2) {
        if (_i3 >= _iterator2.length) break;
        _ref2 = _iterator2[_i3++];
      } else {
        _i3 = _iterator2.next();
        if (_i3.done) break;
        _ref2 = _i3.value;
      }

      var child = _ref2;
      var nodes = this.normalize(child, this.first, 'prepend').reverse();

      for (var _iterator3 = nodes, _isArray3 = Array.isArray(_iterator3), _i4 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray3) {
          if (_i4 >= _iterator3.length) break;
          _ref3 = _iterator3[_i4++];
        } else {
          _i4 = _iterator3.next();
          if (_i4.done) break;
          _ref3 = _i4.value;
        }

        var node = _ref3;
        this.nodes.unshift(node);
      }

      for (var id in this.indexes) {
        this.indexes[id] = this.indexes[id] + nodes.length;
      }
    }

    return this;
  };

  _proto.cleanRaws = function cleanRaws(keepBetween) {
    _Node.prototype.cleanRaws.call(this, keepBetween);

    if (this.nodes) {
      for (var _iterator4 = this.nodes, _isArray4 = Array.isArray(_iterator4), _i5 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray4) {
          if (_i5 >= _iterator4.length) break;
          _ref4 = _iterator4[_i5++];
        } else {
          _i5 = _iterator4.next();
          if (_i5.done) break;
          _ref4 = _i5.value;
        }

        var node = _ref4;
        node.cleanRaws(keepBetween);
      }
    }
  };
  /**
   * Insert new node before old node within the container.
   *
   * @param {Node|number} exist             Child or child’s index.
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * rule.insertBefore(decl, decl.clone({ prop: '-webkit-' + decl.prop }))
   */


  _proto.insertBefore = function insertBefore(exist, add) {
    exist = this.index(exist);
    var type = exist === 0 ? 'prepend' : false;
    var nodes = this.normalize(add, this.nodes[exist], type).reverse();

    for (var _iterator5 = nodes, _isArray5 = Array.isArray(_iterator5), _i6 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray5) {
        if (_i6 >= _iterator5.length) break;
        _ref5 = _iterator5[_i6++];
      } else {
        _i6 = _iterator5.next();
        if (_i6.done) break;
        _ref5 = _i6.value;
      }

      var node = _ref5;
      this.nodes.splice(exist, 0, node);
    }

    var index;

    for (var id in this.indexes) {
      index = this.indexes[id];

      if (exist <= index) {
        this.indexes[id] = index + nodes.length;
      }
    }

    return this;
  };
  /**
   * Insert new node after old node within the container.
   *
   * @param {Node|number} exist             Child or child’s index.
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   */


  _proto.insertAfter = function insertAfter(exist, add) {
    exist = this.index(exist);
    var nodes = this.normalize(add, this.nodes[exist]).reverse();

    for (var _iterator6 = nodes, _isArray6 = Array.isArray(_iterator6), _i7 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
      var _ref6;

      if (_isArray6) {
        if (_i7 >= _iterator6.length) break;
        _ref6 = _iterator6[_i7++];
      } else {
        _i7 = _iterator6.next();
        if (_i7.done) break;
        _ref6 = _i7.value;
      }

      var node = _ref6;
      this.nodes.splice(exist + 1, 0, node);
    }

    var index;

    for (var id in this.indexes) {
      index = this.indexes[id];

      if (exist < index) {
        this.indexes[id] = index + nodes.length;
      }
    }

    return this;
  };
  /**
   * Removes node from the container and cleans the parent properties
   * from the node and its children.
   *
   * @param {Node|number} child Child or child’s index.
   *
   * @return {Node} This node for methods chain
   *
   * @example
   * rule.nodes.length  //=> 5
   * rule.removeChild(decl)
   * rule.nodes.length  //=> 4
   * decl.parent        //=> undefined
   */


  _proto.removeChild = function removeChild(child) {
    child = this.index(child);
    this.nodes[child].parent = undefined;
    this.nodes.splice(child, 1);
    var index;

    for (var id in this.indexes) {
      index = this.indexes[id];

      if (index >= child) {
        this.indexes[id] = index - 1;
      }
    }

    return this;
  };
  /**
   * Removes all children from the container
   * and cleans their parent properties.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * rule.removeAll()
   * rule.nodes.length //=> 0
   */


  _proto.removeAll = function removeAll() {
    for (var _iterator7 = this.nodes, _isArray7 = Array.isArray(_iterator7), _i8 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray7) {
        if (_i8 >= _iterator7.length) break;
        _ref7 = _iterator7[_i8++];
      } else {
        _i8 = _iterator7.next();
        if (_i8.done) break;
        _ref7 = _i8.value;
      }

      var node = _ref7;
      node.parent = undefined;
    }

    this.nodes = [];
    return this;
  };
  /**
   * Passes all declaration values within the container that match pattern
   * through callback, replacing those values with the returned result
   * of callback.
   *
   * This method is useful if you are using a custom unit or function
   * and need to iterate through all values.
   *
   * @param {string|RegExp} pattern      Replace pattern.
   * @param {object} opts                Options to speed up the search.
   * @param {string|string[]} opts.props An array of property names.
   * @param {string} opts.fast           String that’s used to narrow down
   *                                     values and speed up the regexp search.
   * @param {function|string} callback   String to replace pattern or callback
   *                                     that returns a new value. The callback
   *                                     will receive the same arguments
   *                                     as those passed to a function parameter
   *                                     of `String#replace`.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * root.replaceValues(/\d+rem/, { fast: 'rem' }, string => {
   *   return 15 * parseInt(string) + 'px'
   * })
   */


  _proto.replaceValues = function replaceValues(pattern, opts, callback) {
    if (!callback) {
      callback = opts;
      opts = {};
    }

    this.walkDecls(function (decl) {
      if (opts.props && opts.props.indexOf(decl.prop) === -1) return;
      if (opts.fast && decl.value.indexOf(opts.fast) === -1) return;
      decl.value = decl.value.replace(pattern, callback);
    });
    return this;
  };
  /**
   * Returns `true` if callback returns `true`
   * for all of the container’s children.
   *
   * @param {childCondition} condition Iterator returns true or false.
   *
   * @return {boolean} Is every child pass condition.
   *
   * @example
   * const noPrefixes = rule.every(i => i.prop[0] !== '-')
   */


  _proto.every = function every(condition) {
    return this.nodes.every(condition);
  };
  /**
   * Returns `true` if callback returns `true` for (at least) one
   * of the container’s children.
   *
   * @param {childCondition} condition Iterator returns true or false.
   *
   * @return {boolean} Is some child pass condition.
   *
   * @example
   * const hasPrefix = rule.some(i => i.prop[0] === '-')
   */


  _proto.some = function some(condition) {
    return this.nodes.some(condition);
  };
  /**
   * Returns a `child`’s index within the {@link Container#nodes} array.
   *
   * @param {Node} child Child of the current container.
   *
   * @return {number} Child index.
   *
   * @example
   * rule.index( rule.nodes[2] ) //=> 2
   */


  _proto.index = function index(child) {
    if (typeof child === 'number') {
      return child;
    }

    return this.nodes.indexOf(child);
  };
  /**
   * The container’s first child.
   *
   * @type {Node}
   *
   * @example
   * rule.first === rules.nodes[0]
   */


  _proto.normalize = function normalize(nodes, sample) {
    var _this = this;

    if (typeof nodes === 'string') {
      var parse = require('./parse');

      nodes = cleanSource(parse(nodes).nodes);
    } else if (Array.isArray(nodes)) {
      nodes = nodes.slice(0);

      for (var _iterator8 = nodes, _isArray8 = Array.isArray(_iterator8), _i9 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
        var _ref8;

        if (_isArray8) {
          if (_i9 >= _iterator8.length) break;
          _ref8 = _iterator8[_i9++];
        } else {
          _i9 = _iterator8.next();
          if (_i9.done) break;
          _ref8 = _i9.value;
        }

        var i = _ref8;
        if (i.parent) i.parent.removeChild(i, 'ignore');
      }
    } else if (nodes.type === 'root') {
      nodes = nodes.nodes.slice(0);

      for (var _iterator9 = nodes, _isArray9 = Array.isArray(_iterator9), _i10 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
        var _ref9;

        if (_isArray9) {
          if (_i10 >= _iterator9.length) break;
          _ref9 = _iterator9[_i10++];
        } else {
          _i10 = _iterator9.next();
          if (_i10.done) break;
          _ref9 = _i10.value;
        }

        var _i11 = _ref9;
        if (_i11.parent) _i11.parent.removeChild(_i11, 'ignore');
      }
    } else if (nodes.type) {
      nodes = [nodes];
    } else if (nodes.prop) {
      if (typeof nodes.value === 'undefined') {
        throw new Error('Value field is missed in node creation');
      } else if (typeof nodes.value !== 'string') {
        nodes.value = String(nodes.value);
      }

      nodes = [new _declaration.default(nodes)];
    } else if (nodes.selector) {
      var Rule = require('./rule');

      nodes = [new Rule(nodes)];
    } else if (nodes.name) {
      var AtRule = require('./at-rule');

      nodes = [new AtRule(nodes)];
    } else if (nodes.text) {
      nodes = [new _comment.default(nodes)];
    } else {
      throw new Error('Unknown node type in node creation');
    }

    var processed = nodes.map(function (i) {
      if (i.parent) i.parent.removeChild(i);

      if (typeof i.raws.before === 'undefined') {
        if (sample && typeof sample.raws.before !== 'undefined') {
          i.raws.before = sample.raws.before.replace(/[^\s]/g, '');
        }
      }

      i.parent = _this;
      return i;
    });
    return processed;
  };
  /**
   * @memberof Container#
   * @member {Node[]} nodes An array containing the container’s children.
   *
   * @example
   * const root = postcss.parse('a { color: black }')
   * root.nodes.length           //=> 1
   * root.nodes[0].selector      //=> 'a'
   * root.nodes[0].nodes[0].prop //=> 'color'
   */


  _createClass(Container, [{
    key: "first",
    get: function get() {
      if (!this.nodes) return undefined;
      return this.nodes[0];
    }
    /**
     * The container’s last child.
     *
     * @type {Node}
     *
     * @example
     * rule.last === rule.nodes[rule.nodes.length - 1]
     */

  }, {
    key: "last",
    get: function get() {
      if (!this.nodes) return undefined;
      return this.nodes[this.nodes.length - 1];
    }
  }]);

  return Container;
}(_node.default);

var _default = Container;
/**
 * @callback childCondition
 * @param {Node} node    Container child.
 * @param {number} index Child index.
 * @param {Node[]} nodes All container children.
 * @return {boolean}
 */

/**
 * @callback childIterator
 * @param {Node} node    Container child.
 * @param {number} index Child index.
 * @return {false|undefined} Returning `false` will break iteration.
 */

exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbnRhaW5lci5lczYiXSwibmFtZXMiOlsiY2xlYW5Tb3VyY2UiLCJub2RlcyIsIm1hcCIsImkiLCJzb3VyY2UiLCJDb250YWluZXIiLCJwdXNoIiwiY2hpbGQiLCJwYXJlbnQiLCJlYWNoIiwiY2FsbGJhY2siLCJsYXN0RWFjaCIsImluZGV4ZXMiLCJpZCIsInVuZGVmaW5lZCIsImluZGV4IiwicmVzdWx0IiwibGVuZ3RoIiwid2FsayIsImUiLCJwb3N0Y3NzTm9kZSIsInN0YWNrIiwidGVzdCIsInMiLCJyZXBsYWNlIiwiaW5wdXQiLCJmcm9tIiwic3RhcnQiLCJsaW5lIiwiY29sdW1uIiwid2Fsa0RlY2xzIiwicHJvcCIsInR5cGUiLCJSZWdFeHAiLCJ3YWxrUnVsZXMiLCJzZWxlY3RvciIsIndhbGtBdFJ1bGVzIiwibmFtZSIsIndhbGtDb21tZW50cyIsImFwcGVuZCIsImNoaWxkcmVuIiwibm9ybWFsaXplIiwibGFzdCIsIm5vZGUiLCJwcmVwZW5kIiwicmV2ZXJzZSIsImZpcnN0IiwidW5zaGlmdCIsImNsZWFuUmF3cyIsImtlZXBCZXR3ZWVuIiwiaW5zZXJ0QmVmb3JlIiwiZXhpc3QiLCJhZGQiLCJzcGxpY2UiLCJpbnNlcnRBZnRlciIsInJlbW92ZUNoaWxkIiwicmVtb3ZlQWxsIiwicmVwbGFjZVZhbHVlcyIsInBhdHRlcm4iLCJvcHRzIiwiZGVjbCIsInByb3BzIiwiaW5kZXhPZiIsImZhc3QiLCJ2YWx1ZSIsImV2ZXJ5IiwiY29uZGl0aW9uIiwic29tZSIsInNhbXBsZSIsInBhcnNlIiwicmVxdWlyZSIsIkFycmF5IiwiaXNBcnJheSIsInNsaWNlIiwiRXJyb3IiLCJTdHJpbmciLCJEZWNsYXJhdGlvbiIsIlJ1bGUiLCJBdFJ1bGUiLCJ0ZXh0IiwiQ29tbWVudCIsInByb2Nlc3NlZCIsInJhd3MiLCJiZWZvcmUiLCJOb2RlIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBOztBQUNBOztBQUNBOzs7Ozs7Ozs7O0FBRUEsU0FBU0EsV0FBVCxDQUFz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QUwsQ0FBV2dCLE1BQVgsR0FBb0IsQ0FBL0IsQ0FBUDtBQUNEOzs7O0VBaGpCcUJtRSxhOztlQSttQlQvRSxTO0FBRWY7Ozs7Ozs7O0FBUUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgRGVjbGFyYXRpb24gZnJvbSAnLi9kZWNsYXJhdGlvbidcbmltcG9ydCBDb21tZW50IGZyb20gJy4vY29tbWVudCdcbmltcG9ydCBOb2RlIGZyb20gJy4vbm9kZSdcblxuZnVuY3Rpb24gY2xlYW5Tb3VyY2UgKG5vZGVzKSB7XG4gIHJldHVybiBub2Rlcy5tYXAoaSA9PiB7XG4gICAgaWYgKGkubm9kZXMpIGkubm9kZXMgPSBjbGVhblNvdXJjZShpLm5vZGVzKVxuICAgIGRlbGV0ZSBpLnNvdXJjZVxuICAgIHJldHVybiBpXG4gIH0pXG59XG5cbi8qKlxuICogVGhlIHtAbGluayBSb290fSwge0BsaW5rIEF0UnVsZX0sIGFuZCB7QGxpbmsgUnVsZX0gY29udGFpbmVyIG5vZGVzXG4gKiBpbmhlcml0IHNvbWUgY29tbW9uIG1ldGhvZHMgdG8gaGVscCB3b3JrIHdpdGggdGhlaXIgY2hpbGRyZW4uXG4gKlxuICogTm90ZSB0aGF0IGFsbCBjb250YWluZXJzIGNhbiBzdG9yZSBhbnkgY29udGVudC4gSWYgeW91IHdyaXRlIGEgcnVsZSBpbnNpZGVcbiAqIGEgcnVsZSwgUG9zdENTUyB3aWxsIHBhcnNlIGl0LlxuICpcbiAqIEBleHRlbmRzIE5vZGVcbiAqIEBhYnN0cmFjdFxuICovXG5jbGFzcyBDb250YWluZXIgZXh0ZW5kcyBOb2RlIHtcbiAgcHVzaCAoY2hpbGQpIHtcbiAgICBjaGlsZC5wYXJlbnQgPSB0aGlzXG4gICAgdGhpcy5ub2Rlcy5wdXNoKGNoaWxkKVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogSXRlcmF0ZXMgdGhyb3VnaCB0aGUgY29udGFpbmVy4oCZcyBpbW1lZGlhdGUgY2hpbGRyZW4sXG4gICAqIGNhbGxpbmcgYGNhbGxiYWNrYCBmb3IgZWFjaCBjaGlsZC5cbiAgICpcbiAgICogUmV0dXJuaW5nIGBmYWxzZWAgaW4gdGhlIGNhbGxiYWNrIHdpbGwgYnJlYWsgaXRlcmF0aW9uLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBvbmx5IGl0ZXJhdGVzIHRocm91Z2ggdGhlIGNvbnRhaW5lcuKAmXMgaW1tZWRpYXRlIGNoaWxkcmVuLlxuICAgKiBJZiB5b3UgbmVlZCB0byByZWN1cnNpdmVseSBpdGVyYXRlIHRocm91Z2ggYWxsIHRoZSBjb250YWluZXLigJlzIGRlc2NlbmRhbnRcbiAgICogbm9kZXMsIHVzZSB7QGxpbmsgQ29udGFpbmVyI3dhbGt9LlxuICAgKlxuICAgKiBVbmxpa2UgdGhlIGZvciBge31gLWN5Y2xlIG9yIGBBcnJheSNmb3JFYWNoYCB0aGlzIGl0ZXJhdG9yIGlzIHNhZmVcbiAgICogaWYgeW91IGFyZSBtdXRhdGluZyB0aGUgYXJyYXkgb2YgY2hpbGQgbm9kZXMgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICogUG9zdENTUyB3aWxsIGFkanVzdCB0aGUgY3VycmVudCBpbmRleCB0byBtYXRjaCB0aGUgbXV0YXRpb25zLlxuICAgKlxuICAgKiBAcGFyYW0ge2NoaWxkSXRlcmF0b3J9IGNhbGxiYWNrIEl0ZXJhdG9yIHJlY2VpdmVzIGVhY2ggbm9kZSBhbmQgaW5kZXguXG4gICAqXG4gICAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gUmV0dXJucyBgZmFsc2VgIGlmIGl0ZXJhdGlvbiB3YXMgYnJva2UuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhIHsgY29sb3I6IGJsYWNrOyB6LWluZGV4OiAxIH0nKVxuICAgKiBjb25zdCBydWxlID0gcm9vdC5maXJzdFxuICAgKlxuICAgKiBmb3IgKGNvbnN0IGRlY2wgb2YgcnVsZS5ub2Rlcykge1xuICAgKiAgIGRlY2wuY2xvbmVCZWZvcmUoeyBwcm9wOiAnLXdlYmtpdC0nICsgZGVjbC5wcm9wIH0pXG4gICAqICAgLy8gQ3ljbGUgd2lsbCBiZSBpbmZpbml0ZSwgYmVjYXVzZSBjbG9uZUJlZm9yZSBtb3ZlcyB0aGUgY3VycmVudCBub2RlXG4gICAqICAgLy8gdG8gdGhlIG5leHQgaW5kZXhcbiAgICogfVxuICAgKlxuICAgKiBydWxlLmVhY2goZGVjbCA9PiB7XG4gICAqICAgZGVjbC5jbG9uZUJlZm9yZSh7IHByb3A6ICctd2Via2l0LScgKyBkZWNsLnByb3AgfSlcbiAgICogICAvLyBXaWxsIGJlIGV4ZWN1dGVkIG9ubHkgZm9yIGNvbG9yIGFuZCB6LWluZGV4XG4gICAqIH0pXG4gICAqL1xuICBlYWNoIChjYWxsYmFjaykge1xuICAgIGlmICghdGhpcy5sYXN0RWFjaCkgdGhpcy5sYXN0RWFjaCA9IDBcbiAgICBpZiAoIXRoaXMuaW5kZXhlcykgdGhpcy5pbmRleGVzID0geyB9XG5cbiAgICB0aGlzLmxhc3RFYWNoICs9IDFcbiAgICBsZXQgaWQgPSB0aGlzLmxhc3RFYWNoXG4gICAgdGhpcy5pbmRleGVzW2lkXSA9IDBcblxuICAgIGlmICghdGhpcy5ub2RlcykgcmV0dXJuIHVuZGVmaW5lZFxuXG4gICAgbGV0IGluZGV4LCByZXN1bHRcbiAgICB3aGlsZSAodGhpcy5pbmRleGVzW2lkXSA8IHRoaXMubm9kZXMubGVuZ3RoKSB7XG4gICAgICBpbmRleCA9IHRoaXMuaW5kZXhlc1tpZF1cbiAgICAgIHJlc3VsdCA9IGNhbGxiYWNrKHRoaXMubm9kZXNbaW5kZXhdLCBpbmRleClcbiAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSBicmVha1xuXG4gICAgICB0aGlzLmluZGV4ZXNbaWRdICs9IDFcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5pbmRleGVzW2lkXVxuXG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgLyoqXG4gICAqIFRyYXZlcnNlcyB0aGUgY29udGFpbmVy4oCZcyBkZXNjZW5kYW50IG5vZGVzLCBjYWxsaW5nIGNhbGxiYWNrXG4gICAqIGZvciBlYWNoIG5vZGUuXG4gICAqXG4gICAqIExpa2UgY29udGFpbmVyLmVhY2goKSwgdGhpcyBtZXRob2QgaXMgc2FmZSB0byB1c2VcbiAgICogaWYgeW91IGFyZSBtdXRhdGluZyBhcnJheXMgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICpcbiAgICogSWYgeW91IG9ubHkgbmVlZCB0byBpdGVyYXRlIHRocm91Z2ggdGhlIGNvbnRhaW5lcuKAmXMgaW1tZWRpYXRlIGNoaWxkcmVuLFxuICAgKiB1c2Uge0BsaW5rIENvbnRhaW5lciNlYWNofS5cbiAgICpcbiAgICogQHBhcmFtIHtjaGlsZEl0ZXJhdG9yfSBjYWxsYmFjayBJdGVyYXRvciByZWNlaXZlcyBlYWNoIG5vZGUgYW5kIGluZGV4LlxuICAgKlxuICAgKiBAcmV0dXJuIHtmYWxzZXx1bmRlZmluZWR9IFJldHVybnMgYGZhbHNlYCBpZiBpdGVyYXRpb24gd2FzIGJyb2tlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiByb290LndhbGsobm9kZSA9PiB7XG4gICAqICAgLy8gVHJhdmVyc2VzIGFsbCBkZXNjZW5kYW50IG5vZGVzLlxuICAgKiB9KVxuICAgKi9cbiAgd2FsayAoY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5lYWNoKChjaGlsZCwgaSkgPT4ge1xuICAgICAgbGV0IHJlc3VsdFxuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2soY2hpbGQsIGkpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGUucG9zdGNzc05vZGUgPSBjaGlsZFxuICAgICAgICBpZiAoZS5zdGFjayAmJiBjaGlsZC5zb3VyY2UgJiYgL1xcblxcc3s0fWF0IC8udGVzdChlLnN0YWNrKSkge1xuICAgICAgICAgIGxldCBzID0gY2hpbGQuc291cmNlXG4gICAgICAgICAgZS5zdGFjayA9IGUuc3RhY2sucmVwbGFjZSgvXFxuXFxzezR9YXQgLyxcbiAgICAgICAgICAgIGAkJiR7IHMuaW5wdXQuZnJvbSB9OiR7IHMuc3RhcnQubGluZSB9OiR7IHMuc3RhcnQuY29sdW1uIH0kJmApXG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCAhPT0gZmFsc2UgJiYgY2hpbGQud2Fsaykge1xuICAgICAgICByZXN1bHQgPSBjaGlsZC53YWxrKGNhbGxiYWNrKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogVHJhdmVyc2VzIHRoZSBjb250YWluZXLigJlzIGRlc2NlbmRhbnQgbm9kZXMsIGNhbGxpbmcgY2FsbGJhY2tcbiAgICogZm9yIGVhY2ggZGVjbGFyYXRpb24gbm9kZS5cbiAgICpcbiAgICogSWYgeW91IHBhc3MgYSBmaWx0ZXIsIGl0ZXJhdGlvbiB3aWxsIG9ubHkgaGFwcGVuIG92ZXIgZGVjbGFyYXRpb25zXG4gICAqIHdpdGggbWF0Y2hpbmcgcHJvcGVydGllcy5cbiAgICpcbiAgICogTGlrZSB7QGxpbmsgQ29udGFpbmVyI2VhY2h9LCB0aGlzIG1ldGhvZCBpcyBzYWZlXG4gICAqIHRvIHVzZSBpZiB5b3UgYXJlIG11dGF0aW5nIGFycmF5cyBkdXJpbmcgaXRlcmF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ3xSZWdFeHB9IFtwcm9wXSAgIFN0cmluZyBvciByZWd1bGFyIGV4cHJlc3Npb25cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0byBmaWx0ZXIgZGVjbGFyYXRpb25zIGJ5IHByb3BlcnR5IG5hbWUuXG4gICAqIEBwYXJhbSB7Y2hpbGRJdGVyYXRvcn0gY2FsbGJhY2sgSXRlcmF0b3IgcmVjZWl2ZXMgZWFjaCBub2RlIGFuZCBpbmRleC5cbiAgICpcbiAgICogQHJldHVybiB7ZmFsc2V8dW5kZWZpbmVkfSBSZXR1cm5zIGBmYWxzZWAgaWYgaXRlcmF0aW9uIHdhcyBicm9rZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcm9vdC53YWxrRGVjbHMoZGVjbCA9PiB7XG4gICAqICAgY2hlY2tQcm9wZXJ0eVN1cHBvcnQoZGVjbC5wcm9wKVxuICAgKiB9KVxuICAgKlxuICAgKiByb290LndhbGtEZWNscygnYm9yZGVyLXJhZGl1cycsIGRlY2wgPT4ge1xuICAgKiAgIGRlY2wucmVtb3ZlKClcbiAgICogfSlcbiAgICpcbiAgICogcm9vdC53YWxrRGVjbHMoL15iYWNrZ3JvdW5kLywgZGVjbCA9PiB7XG4gICAqICAgZGVjbC52YWx1ZSA9IHRha2VGaXJzdENvbG9yRnJvbUdyYWRpZW50KGRlY2wudmFsdWUpXG4gICAqIH0pXG4gICAqL1xuICB3YWxrRGVjbHMgKHByb3AsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2sgPSBwcm9wXG4gICAgICByZXR1cm4gdGhpcy53YWxrKChjaGlsZCwgaSkgPT4ge1xuICAgICAgICBpZiAoY2hpbGQudHlwZSA9PT0gJ2RlY2wnKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICBpZiAocHJvcCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuIHRoaXMud2FsaygoY2hpbGQsIGkpID0+IHtcbiAgICAgICAgaWYgKGNoaWxkLnR5cGUgPT09ICdkZWNsJyAmJiBwcm9wLnRlc3QoY2hpbGQucHJvcCkpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY2hpbGQsIGkpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiB0aGlzLndhbGsoKGNoaWxkLCBpKSA9PiB7XG4gICAgICBpZiAoY2hpbGQudHlwZSA9PT0gJ2RlY2wnICYmIGNoaWxkLnByb3AgPT09IHByb3ApIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogVHJhdmVyc2VzIHRoZSBjb250YWluZXLigJlzIGRlc2NlbmRhbnQgbm9kZXMsIGNhbGxpbmcgY2FsbGJhY2tcbiAgICogZm9yIGVhY2ggcnVsZSBub2RlLlxuICAgKlxuICAgKiBJZiB5b3UgcGFzcyBhIGZpbHRlciwgaXRlcmF0aW9uIHdpbGwgb25seSBoYXBwZW4gb3ZlciBydWxlc1xuICAgKiB3aXRoIG1hdGNoaW5nIHNlbGVjdG9ycy5cbiAgICpcbiAgICogTGlrZSB7QGxpbmsgQ29udGFpbmVyI2VhY2h9LCB0aGlzIG1ldGhvZCBpcyBzYWZlXG4gICAqIHRvIHVzZSBpZiB5b3UgYXJlIG11dGF0aW5nIGFycmF5cyBkdXJpbmcgaXRlcmF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ3xSZWdFeHB9IFtzZWxlY3Rvcl0gU3RyaW5nIG9yIHJlZ3VsYXIgZXhwcmVzc2lvblxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gZmlsdGVyIHJ1bGVzIGJ5IHNlbGVjdG9yLlxuICAgKiBAcGFyYW0ge2NoaWxkSXRlcmF0b3J9IGNhbGxiYWNrICAgSXRlcmF0b3IgcmVjZWl2ZXMgZWFjaCBub2RlIGFuZCBpbmRleC5cbiAgICpcbiAgICogQHJldHVybiB7ZmFsc2V8dW5kZWZpbmVkfSByZXR1cm5zIGBmYWxzZWAgaWYgaXRlcmF0aW9uIHdhcyBicm9rZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3Qgc2VsZWN0b3JzID0gW11cbiAgICogcm9vdC53YWxrUnVsZXMocnVsZSA9PiB7XG4gICAqICAgc2VsZWN0b3JzLnB1c2gocnVsZS5zZWxlY3RvcilcbiAgICogfSlcbiAgICogY29uc29sZS5sb2coYFlvdXIgQ1NTIHVzZXMgJHsgc2VsZWN0b3JzLmxlbmd0aCB9IHNlbGVjdG9yc2ApXG4gICAqL1xuICB3YWxrUnVsZXMgKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrID0gc2VsZWN0b3JcblxuICAgICAgcmV0dXJuIHRoaXMud2FsaygoY2hpbGQsIGkpID0+IHtcbiAgICAgICAgaWYgKGNoaWxkLnR5cGUgPT09ICdydWxlJykge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjaGlsZCwgaSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gICAgaWYgKHNlbGVjdG9yIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICByZXR1cm4gdGhpcy53YWxrKChjaGlsZCwgaSkgPT4ge1xuICAgICAgICBpZiAoY2hpbGQudHlwZSA9PT0gJ3J1bGUnICYmIHNlbGVjdG9yLnRlc3QoY2hpbGQuc2VsZWN0b3IpKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy53YWxrKChjaGlsZCwgaSkgPT4ge1xuICAgICAgaWYgKGNoaWxkLnR5cGUgPT09ICdydWxlJyAmJiBjaGlsZC5zZWxlY3RvciA9PT0gc2VsZWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogVHJhdmVyc2VzIHRoZSBjb250YWluZXLigJlzIGRlc2NlbmRhbnQgbm9kZXMsIGNhbGxpbmcgY2FsbGJhY2tcbiAgICogZm9yIGVhY2ggYXQtcnVsZSBub2RlLlxuICAgKlxuICAgKiBJZiB5b3UgcGFzcyBhIGZpbHRlciwgaXRlcmF0aW9uIHdpbGwgb25seSBoYXBwZW4gb3ZlciBhdC1ydWxlc1xuICAgKiB0aGF0IGhhdmUgbWF0Y2hpbmcgbmFtZXMuXG4gICAqXG4gICAqIExpa2Uge0BsaW5rIENvbnRhaW5lciNlYWNofSwgdGhpcyBtZXRob2QgaXMgc2FmZVxuICAgKiB0byB1c2UgaWYgeW91IGFyZSBtdXRhdGluZyBhcnJheXMgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd8UmVnRXhwfSBbbmFtZV0gICBTdHJpbmcgb3IgcmVndWxhciBleHByZXNzaW9uXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gZmlsdGVyIGF0LXJ1bGVzIGJ5IG5hbWUuXG4gICAqIEBwYXJhbSB7Y2hpbGRJdGVyYXRvcn0gY2FsbGJhY2sgSXRlcmF0b3IgcmVjZWl2ZXMgZWFjaCBub2RlIGFuZCBpbmRleC5cbiAgICpcbiAgICogQHJldHVybiB7ZmFsc2V8dW5kZWZpbmVkfSBSZXR1cm5zIGBmYWxzZWAgaWYgaXRlcmF0aW9uIHdhcyBicm9rZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcm9vdC53YWxrQXRSdWxlcyhydWxlID0+IHtcbiAgICogICBpZiAoaXNPbGQocnVsZS5uYW1lKSkgcnVsZS5yZW1vdmUoKVxuICAgKiB9KVxuICAgKlxuICAgKiBsZXQgZmlyc3QgPSBmYWxzZVxuICAgKiByb290LndhbGtBdFJ1bGVzKCdjaGFyc2V0JywgcnVsZSA9PiB7XG4gICAqICAgaWYgKCFmaXJzdCkge1xuICAgKiAgICAgZmlyc3QgPSB0cnVlXG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIHJ1bGUucmVtb3ZlKClcbiAgICogICB9XG4gICAqIH0pXG4gICAqL1xuICB3YWxrQXRSdWxlcyAobmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayA9IG5hbWVcbiAgICAgIHJldHVybiB0aGlzLndhbGsoKGNoaWxkLCBpKSA9PiB7XG4gICAgICAgIGlmIChjaGlsZC50eXBlID09PSAnYXRydWxlJykge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjaGlsZCwgaSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gICAgaWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHJldHVybiB0aGlzLndhbGsoKGNoaWxkLCBpKSA9PiB7XG4gICAgICAgIGlmIChjaGlsZC50eXBlID09PSAnYXRydWxlJyAmJiBuYW1lLnRlc3QoY2hpbGQubmFtZSkpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY2hpbGQsIGkpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiB0aGlzLndhbGsoKGNoaWxkLCBpKSA9PiB7XG4gICAgICBpZiAoY2hpbGQudHlwZSA9PT0gJ2F0cnVsZScgJiYgY2hpbGQubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soY2hpbGQsIGkpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmF2ZXJzZXMgdGhlIGNvbnRhaW5lcuKAmXMgZGVzY2VuZGFudCBub2RlcywgY2FsbGluZyBjYWxsYmFja1xuICAgKiBmb3IgZWFjaCBjb21tZW50IG5vZGUuXG4gICAqXG4gICAqIExpa2Uge0BsaW5rIENvbnRhaW5lciNlYWNofSwgdGhpcyBtZXRob2QgaXMgc2FmZVxuICAgKiB0byB1c2UgaWYgeW91IGFyZSBtdXRhdGluZyBhcnJheXMgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtjaGlsZEl0ZXJhdG9yfSBjYWxsYmFjayBJdGVyYXRvciByZWNlaXZlcyBlYWNoIG5vZGUgYW5kIGluZGV4LlxuICAgKlxuICAgKiBAcmV0dXJuIHtmYWxzZXx1bmRlZmluZWR9IFJldHVybnMgYGZhbHNlYCBpZiBpdGVyYXRpb24gd2FzIGJyb2tlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiByb290LndhbGtDb21tZW50cyhjb21tZW50ID0+IHtcbiAgICogICBjb21tZW50LnJlbW92ZSgpXG4gICAqIH0pXG4gICAqL1xuICB3YWxrQ29tbWVudHMgKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMud2FsaygoY2hpbGQsIGkpID0+IHtcbiAgICAgIGlmIChjaGlsZC50eXBlID09PSAnY29tbWVudCcpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0cyBuZXcgbm9kZXMgdG8gdGhlIGVuZCBvZiB0aGUgY29udGFpbmVyLlxuICAgKlxuICAgKiBAcGFyYW0gey4uLihOb2RlfG9iamVjdHxzdHJpbmd8Tm9kZVtdKX0gY2hpbGRyZW4gTmV3IG5vZGVzLlxuICAgKlxuICAgKiBAcmV0dXJuIHtOb2RlfSBUaGlzIG5vZGUgZm9yIG1ldGhvZHMgY2hhaW4uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGRlY2wxID0gcG9zdGNzcy5kZWNsKHsgcHJvcDogJ2NvbG9yJywgdmFsdWU6ICdibGFjaycgfSlcbiAgICogY29uc3QgZGVjbDIgPSBwb3N0Y3NzLmRlY2woeyBwcm9wOiAnYmFja2dyb3VuZC1jb2xvcicsIHZhbHVlOiAnd2hpdGUnIH0pXG4gICAqIHJ1bGUuYXBwZW5kKGRlY2wxLCBkZWNsMilcbiAgICpcbiAgICogcm9vdC5hcHBlbmQoeyBuYW1lOiAnY2hhcnNldCcsIHBhcmFtczogJ1wiVVRGLThcIicgfSkgIC8vIGF0LXJ1bGVcbiAgICogcm9vdC5hcHBlbmQoeyBzZWxlY3RvcjogJ2EnIH0pICAgICAgICAgICAgICAgICAgICAgICAvLyBydWxlXG4gICAqIHJ1bGUuYXBwZW5kKHsgcHJvcDogJ2NvbG9yJywgdmFsdWU6ICdibGFjaycgfSkgICAgICAgLy8gZGVjbGFyYXRpb25cbiAgICogcnVsZS5hcHBlbmQoeyB0ZXh0OiAnQ29tbWVudCcgfSkgICAgICAgICAgICAgICAgICAgICAvLyBjb21tZW50XG4gICAqXG4gICAqIHJvb3QuYXBwZW5kKCdhIHt9JylcbiAgICogcm9vdC5maXJzdC5hcHBlbmQoJ2NvbG9yOiBibGFjazsgei1pbmRleDogMScpXG4gICAqL1xuICBhcHBlbmQgKC4uLmNoaWxkcmVuKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICAgIGxldCBub2RlcyA9IHRoaXMubm9ybWFsaXplKGNoaWxkLCB0aGlzLmxhc3QpXG4gICAgICBmb3IgKGxldCBub2RlIG9mIG5vZGVzKSB0aGlzLm5vZGVzLnB1c2gobm9kZSlcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnRzIG5ldyBub2RlcyB0byB0aGUgc3RhcnQgb2YgdGhlIGNvbnRhaW5lci5cbiAgICpcbiAgICogQHBhcmFtIHsuLi4oTm9kZXxvYmplY3R8c3RyaW5nfE5vZGVbXSl9IGNoaWxkcmVuIE5ldyBub2Rlcy5cbiAgICpcbiAgICogQHJldHVybiB7Tm9kZX0gVGhpcyBub2RlIGZvciBtZXRob2RzIGNoYWluLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBkZWNsMSA9IHBvc3Rjc3MuZGVjbCh7IHByb3A6ICdjb2xvcicsIHZhbHVlOiAnYmxhY2snIH0pXG4gICAqIGNvbnN0IGRlY2wyID0gcG9zdGNzcy5kZWNsKHsgcHJvcDogJ2JhY2tncm91bmQtY29sb3InLCB2YWx1ZTogJ3doaXRlJyB9KVxuICAgKiBydWxlLnByZXBlbmQoZGVjbDEsIGRlY2wyKVxuICAgKlxuICAgKiByb290LmFwcGVuZCh7IG5hbWU6ICdjaGFyc2V0JywgcGFyYW1zOiAnXCJVVEYtOFwiJyB9KSAgLy8gYXQtcnVsZVxuICAgKiByb290LmFwcGVuZCh7IHNlbGVjdG9yOiAnYScgfSkgICAgICAgICAgICAgICAgICAgICAgIC8vIHJ1bGVcbiAgICogcnVsZS5hcHBlbmQoeyBwcm9wOiAnY29sb3InLCB2YWx1ZTogJ2JsYWNrJyB9KSAgICAgICAvLyBkZWNsYXJhdGlvblxuICAgKiBydWxlLmFwcGVuZCh7IHRleHQ6ICdDb21tZW50JyB9KSAgICAgICAgICAgICAgICAgICAgIC8vIGNvbW1lbnRcbiAgICpcbiAgICogcm9vdC5hcHBlbmQoJ2Ege30nKVxuICAgKiByb290LmZpcnN0LmFwcGVuZCgnY29sb3I6IGJsYWNrOyB6LWluZGV4OiAxJylcbiAgICovXG4gIHByZXBlbmQgKC4uLmNoaWxkcmVuKSB7XG4gICAgY2hpbGRyZW4gPSBjaGlsZHJlbi5yZXZlcnNlKClcbiAgICBmb3IgKGxldCBjaGlsZCBvZiBjaGlsZHJlbikge1xuICAgICAgbGV0IG5vZGVzID0gdGhpcy5ub3JtYWxpemUoY2hpbGQsIHRoaXMuZmlyc3QsICdwcmVwZW5kJykucmV2ZXJzZSgpXG4gICAgICBmb3IgKGxldCBub2RlIG9mIG5vZGVzKSB0aGlzLm5vZGVzLnVuc2hpZnQobm9kZSlcbiAgICAgIGZvciAobGV0IGlkIGluIHRoaXMuaW5kZXhlcykge1xuICAgICAgICB0aGlzLmluZGV4ZXNbaWRdID0gdGhpcy5pbmRleGVzW2lkXSArIG5vZGVzLmxlbmd0aFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgY2xlYW5SYXdzIChrZWVwQmV0d2Vlbikge1xuICAgIHN1cGVyLmNsZWFuUmF3cyhrZWVwQmV0d2VlbilcbiAgICBpZiAodGhpcy5ub2Rlcykge1xuICAgICAgZm9yIChsZXQgbm9kZSBvZiB0aGlzLm5vZGVzKSBub2RlLmNsZWFuUmF3cyhrZWVwQmV0d2VlbilcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0IG5ldyBub2RlIGJlZm9yZSBvbGQgbm9kZSB3aXRoaW4gdGhlIGNvbnRhaW5lci5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfG51bWJlcn0gZXhpc3QgICAgICAgICAgICAgQ2hpbGQgb3IgY2hpbGTigJlzIGluZGV4LlxuICAgKiBAcGFyYW0ge05vZGV8b2JqZWN0fHN0cmluZ3xOb2RlW119IGFkZCBOZXcgbm9kZS5cbiAgICpcbiAgICogQHJldHVybiB7Tm9kZX0gVGhpcyBub2RlIGZvciBtZXRob2RzIGNoYWluLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBydWxlLmluc2VydEJlZm9yZShkZWNsLCBkZWNsLmNsb25lKHsgcHJvcDogJy13ZWJraXQtJyArIGRlY2wucHJvcCB9KSlcbiAgICovXG4gIGluc2VydEJlZm9yZSAoZXhpc3QsIGFkZCkge1xuICAgIGV4aXN0ID0gdGhpcy5pbmRleChleGlzdClcblxuICAgIGxldCB0eXBlID0gZXhpc3QgPT09IDAgPyAncHJlcGVuZCcgOiBmYWxzZVxuICAgIGxldCBub2RlcyA9IHRoaXMubm9ybWFsaXplKGFkZCwgdGhpcy5ub2Rlc1tleGlzdF0sIHR5cGUpLnJldmVyc2UoKVxuICAgIGZvciAobGV0IG5vZGUgb2Ygbm9kZXMpIHRoaXMubm9kZXMuc3BsaWNlKGV4aXN0LCAwLCBub2RlKVxuXG4gICAgbGV0IGluZGV4XG4gICAgZm9yIChsZXQgaWQgaW4gdGhpcy5pbmRleGVzKSB7XG4gICAgICBpbmRleCA9IHRoaXMuaW5kZXhlc1tpZF1cbiAgICAgIGlmIChleGlzdCA8PSBpbmRleCkge1xuICAgICAgICB0aGlzLmluZGV4ZXNbaWRdID0gaW5kZXggKyBub2Rlcy5sZW5ndGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydCBuZXcgbm9kZSBhZnRlciBvbGQgbm9kZSB3aXRoaW4gdGhlIGNvbnRhaW5lci5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfG51bWJlcn0gZXhpc3QgICAgICAgICAgICAgQ2hpbGQgb3IgY2hpbGTigJlzIGluZGV4LlxuICAgKiBAcGFyYW0ge05vZGV8b2JqZWN0fHN0cmluZ3xOb2RlW119IGFkZCBOZXcgbm9kZS5cbiAgICpcbiAgICogQHJldHVybiB7Tm9kZX0gVGhpcyBub2RlIGZvciBtZXRob2RzIGNoYWluLlxuICAgKi9cbiAgaW5zZXJ0QWZ0ZXIgKGV4aXN0LCBhZGQpIHtcbiAgICBleGlzdCA9IHRoaXMuaW5kZXgoZXhpc3QpXG5cbiAgICBsZXQgbm9kZXMgPSB0aGlzLm5vcm1hbGl6ZShhZGQsIHRoaXMubm9kZXNbZXhpc3RdKS5yZXZlcnNlKClcbiAgICBmb3IgKGxldCBub2RlIG9mIG5vZGVzKSB0aGlzLm5vZGVzLnNwbGljZShleGlzdCArIDEsIDAsIG5vZGUpXG5cbiAgICBsZXQgaW5kZXhcbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmluZGV4ZXMpIHtcbiAgICAgIGluZGV4ID0gdGhpcy5pbmRleGVzW2lkXVxuICAgICAgaWYgKGV4aXN0IDwgaW5kZXgpIHtcbiAgICAgICAgdGhpcy5pbmRleGVzW2lkXSA9IGluZGV4ICsgbm9kZXMubGVuZ3RoXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIG5vZGUgZnJvbSB0aGUgY29udGFpbmVyIGFuZCBjbGVhbnMgdGhlIHBhcmVudCBwcm9wZXJ0aWVzXG4gICAqIGZyb20gdGhlIG5vZGUgYW5kIGl0cyBjaGlsZHJlbi5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfG51bWJlcn0gY2hpbGQgQ2hpbGQgb3IgY2hpbGTigJlzIGluZGV4LlxuICAgKlxuICAgKiBAcmV0dXJuIHtOb2RlfSBUaGlzIG5vZGUgZm9yIG1ldGhvZHMgY2hhaW5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcnVsZS5ub2Rlcy5sZW5ndGggIC8vPT4gNVxuICAgKiBydWxlLnJlbW92ZUNoaWxkKGRlY2wpXG4gICAqIHJ1bGUubm9kZXMubGVuZ3RoICAvLz0+IDRcbiAgICogZGVjbC5wYXJlbnQgICAgICAgIC8vPT4gdW5kZWZpbmVkXG4gICAqL1xuICByZW1vdmVDaGlsZCAoY2hpbGQpIHtcbiAgICBjaGlsZCA9IHRoaXMuaW5kZXgoY2hpbGQpXG4gICAgdGhpcy5ub2Rlc1tjaGlsZF0ucGFyZW50ID0gdW5kZWZpbmVkXG4gICAgdGhpcy5ub2Rlcy5zcGxpY2UoY2hpbGQsIDEpXG5cbiAgICBsZXQgaW5kZXhcbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmluZGV4ZXMpIHtcbiAgICAgIGluZGV4ID0gdGhpcy5pbmRleGVzW2lkXVxuICAgICAgaWYgKGluZGV4ID49IGNoaWxkKSB7XG4gICAgICAgIHRoaXMuaW5kZXhlc1tpZF0gPSBpbmRleCAtIDFcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYWxsIGNoaWxkcmVuIGZyb20gdGhlIGNvbnRhaW5lclxuICAgKiBhbmQgY2xlYW5zIHRoZWlyIHBhcmVudCBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBAcmV0dXJuIHtOb2RlfSBUaGlzIG5vZGUgZm9yIG1ldGhvZHMgY2hhaW4uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHJ1bGUucmVtb3ZlQWxsKClcbiAgICogcnVsZS5ub2Rlcy5sZW5ndGggLy89PiAwXG4gICAqL1xuICByZW1vdmVBbGwgKCkge1xuICAgIGZvciAobGV0IG5vZGUgb2YgdGhpcy5ub2Rlcykgbm9kZS5wYXJlbnQgPSB1bmRlZmluZWRcbiAgICB0aGlzLm5vZGVzID0gW11cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFBhc3NlcyBhbGwgZGVjbGFyYXRpb24gdmFsdWVzIHdpdGhpbiB0aGUgY29udGFpbmVyIHRoYXQgbWF0Y2ggcGF0dGVyblxuICAgKiB0aHJvdWdoIGNhbGxiYWNrLCByZXBsYWNpbmcgdGhvc2UgdmFsdWVzIHdpdGggdGhlIHJldHVybmVkIHJlc3VsdFxuICAgKiBvZiBjYWxsYmFjay5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaXMgdXNlZnVsIGlmIHlvdSBhcmUgdXNpbmcgYSBjdXN0b20gdW5pdCBvciBmdW5jdGlvblxuICAgKiBhbmQgbmVlZCB0byBpdGVyYXRlIHRocm91Z2ggYWxsIHZhbHVlcy5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd8UmVnRXhwfSBwYXR0ZXJuICAgICAgUmVwbGFjZSBwYXR0ZXJuLlxuICAgKiBAcGFyYW0ge29iamVjdH0gb3B0cyAgICAgICAgICAgICAgICBPcHRpb25zIHRvIHNwZWVkIHVwIHRoZSBzZWFyY2guXG4gICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBvcHRzLnByb3BzIEFuIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0cy5mYXN0ICAgICAgICAgICBTdHJpbmcgdGhhdOKAmXMgdXNlZCB0byBuYXJyb3cgZG93blxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMgYW5kIHNwZWVkIHVwIHRoZSByZWdleHAgc2VhcmNoLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufHN0cmluZ30gY2FsbGJhY2sgICBTdHJpbmcgdG8gcmVwbGFjZSBwYXR0ZXJuIG9yIGNhbGxiYWNrXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQgcmV0dXJucyBhIG5ldyB2YWx1ZS4gVGhlIGNhbGxiYWNrXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgcmVjZWl2ZSB0aGUgc2FtZSBhcmd1bWVudHNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXMgdGhvc2UgcGFzc2VkIHRvIGEgZnVuY3Rpb24gcGFyYW1ldGVyXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mIGBTdHJpbmcjcmVwbGFjZWAuXG4gICAqXG4gICAqIEByZXR1cm4ge05vZGV9IFRoaXMgbm9kZSBmb3IgbWV0aG9kcyBjaGFpbi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcm9vdC5yZXBsYWNlVmFsdWVzKC9cXGQrcmVtLywgeyBmYXN0OiAncmVtJyB9LCBzdHJpbmcgPT4ge1xuICAgKiAgIHJldHVybiAxNSAqIHBhcnNlSW50KHN0cmluZykgKyAncHgnXG4gICAqIH0pXG4gICAqL1xuICByZXBsYWNlVmFsdWVzIChwYXR0ZXJuLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0c1xuICAgICAgb3B0cyA9IHsgfVxuICAgIH1cblxuICAgIHRoaXMud2Fsa0RlY2xzKGRlY2wgPT4ge1xuICAgICAgaWYgKG9wdHMucHJvcHMgJiYgb3B0cy5wcm9wcy5pbmRleE9mKGRlY2wucHJvcCkgPT09IC0xKSByZXR1cm5cbiAgICAgIGlmIChvcHRzLmZhc3QgJiYgZGVjbC52YWx1ZS5pbmRleE9mKG9wdHMuZmFzdCkgPT09IC0xKSByZXR1cm5cblxuICAgICAgZGVjbC52YWx1ZSA9IGRlY2wudmFsdWUucmVwbGFjZShwYXR0ZXJuLCBjYWxsYmFjaylcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiBjYWxsYmFjayByZXR1cm5zIGB0cnVlYFxuICAgKiBmb3IgYWxsIG9mIHRoZSBjb250YWluZXLigJlzIGNoaWxkcmVuLlxuICAgKlxuICAgKiBAcGFyYW0ge2NoaWxkQ29uZGl0aW9ufSBjb25kaXRpb24gSXRlcmF0b3IgcmV0dXJucyB0cnVlIG9yIGZhbHNlLlxuICAgKlxuICAgKiBAcmV0dXJuIHtib29sZWFufSBJcyBldmVyeSBjaGlsZCBwYXNzIGNvbmRpdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3Qgbm9QcmVmaXhlcyA9IHJ1bGUuZXZlcnkoaSA9PiBpLnByb3BbMF0gIT09ICctJylcbiAgICovXG4gIGV2ZXJ5IChjb25kaXRpb24pIHtcbiAgICByZXR1cm4gdGhpcy5ub2Rlcy5ldmVyeShjb25kaXRpb24pXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBgdHJ1ZWAgaWYgY2FsbGJhY2sgcmV0dXJucyBgdHJ1ZWAgZm9yIChhdCBsZWFzdCkgb25lXG4gICAqIG9mIHRoZSBjb250YWluZXLigJlzIGNoaWxkcmVuLlxuICAgKlxuICAgKiBAcGFyYW0ge2NoaWxkQ29uZGl0aW9ufSBjb25kaXRpb24gSXRlcmF0b3IgcmV0dXJucyB0cnVlIG9yIGZhbHNlLlxuICAgKlxuICAgKiBAcmV0dXJuIHtib29sZWFufSBJcyBzb21lIGNoaWxkIHBhc3MgY29uZGl0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBoYXNQcmVmaXggPSBydWxlLnNvbWUoaSA9PiBpLnByb3BbMF0gPT09ICctJylcbiAgICovXG4gIHNvbWUgKGNvbmRpdGlvbikge1xuICAgIHJldHVybiB0aGlzLm5vZGVzLnNvbWUoY29uZGl0aW9uKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBgY2hpbGRg4oCZcyBpbmRleCB3aXRoaW4gdGhlIHtAbGluayBDb250YWluZXIjbm9kZXN9IGFycmF5LlxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9IGNoaWxkIENoaWxkIG9mIHRoZSBjdXJyZW50IGNvbnRhaW5lci5cbiAgICpcbiAgICogQHJldHVybiB7bnVtYmVyfSBDaGlsZCBpbmRleC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcnVsZS5pbmRleCggcnVsZS5ub2Rlc1syXSApIC8vPT4gMlxuICAgKi9cbiAgaW5kZXggKGNoaWxkKSB7XG4gICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiBjaGlsZFxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5ub2Rlcy5pbmRleE9mKGNoaWxkKVxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBjb250YWluZXLigJlzIGZpcnN0IGNoaWxkLlxuICAgKlxuICAgKiBAdHlwZSB7Tm9kZX1cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcnVsZS5maXJzdCA9PT0gcnVsZXMubm9kZXNbMF1cbiAgICovXG4gIGdldCBmaXJzdCAoKSB7XG4gICAgaWYgKCF0aGlzLm5vZGVzKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgcmV0dXJuIHRoaXMubm9kZXNbMF1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgY29udGFpbmVy4oCZcyBsYXN0IGNoaWxkLlxuICAgKlxuICAgKiBAdHlwZSB7Tm9kZX1cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogcnVsZS5sYXN0ID09PSBydWxlLm5vZGVzW3J1bGUubm9kZXMubGVuZ3RoIC0gMV1cbiAgICovXG4gIGdldCBsYXN0ICgpIHtcbiAgICBpZiAoIXRoaXMubm9kZXMpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXR1cm4gdGhpcy5ub2Rlc1t0aGlzLm5vZGVzLmxlbmd0aCAtIDFdXG4gIH1cblxuICBub3JtYWxpemUgKG5vZGVzLCBzYW1wbGUpIHtcbiAgICBpZiAodHlwZW9mIG5vZGVzID09PSAnc3RyaW5nJykge1xuICAgICAgbGV0IHBhcnNlID0gcmVxdWlyZSgnLi9wYXJzZScpXG4gICAgICBub2RlcyA9IGNsZWFuU291cmNlKHBhcnNlKG5vZGVzKS5ub2RlcylcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkobm9kZXMpKSB7XG4gICAgICBub2RlcyA9IG5vZGVzLnNsaWNlKDApXG4gICAgICBmb3IgKGxldCBpIG9mIG5vZGVzKSB7XG4gICAgICAgIGlmIChpLnBhcmVudCkgaS5wYXJlbnQucmVtb3ZlQ2hpbGQoaSwgJ2lnbm9yZScpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChub2Rlcy50eXBlID09PSAncm9vdCcpIHtcbiAgICAgIG5vZGVzID0gbm9kZXMubm9kZXMuc2xpY2UoMClcbiAgICAgIGZvciAobGV0IGkgb2Ygbm9kZXMpIHtcbiAgICAgICAgaWYgKGkucGFyZW50KSBpLnBhcmVudC5yZW1vdmVDaGlsZChpLCAnaWdub3JlJylcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5vZGVzLnR5cGUpIHtcbiAgICAgIG5vZGVzID0gW25vZGVzXVxuICAgIH0gZWxzZSBpZiAobm9kZXMucHJvcCkge1xuICAgICAgaWYgKHR5cGVvZiBub2Rlcy52YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWYWx1ZSBmaWVsZCBpcyBtaXNzZWQgaW4gbm9kZSBjcmVhdGlvbicpXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBub2Rlcy52YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgbm9kZXMudmFsdWUgPSBTdHJpbmcobm9kZXMudmFsdWUpXG4gICAgICB9XG4gICAgICBub2RlcyA9IFtuZXcgRGVjbGFyYXRpb24obm9kZXMpXVxuICAgIH0gZWxzZSBpZiAobm9kZXMuc2VsZWN0b3IpIHtcbiAgICAgIGxldCBSdWxlID0gcmVxdWlyZSgnLi9ydWxlJylcbiAgICAgIG5vZGVzID0gW25ldyBSdWxlKG5vZGVzKV1cbiAgICB9IGVsc2UgaWYgKG5vZGVzLm5hbWUpIHtcbiAgICAgIGxldCBBdFJ1bGUgPSByZXF1aXJlKCcuL2F0LXJ1bGUnKVxuICAgICAgbm9kZXMgPSBbbmV3IEF0UnVsZShub2RlcyldXG4gICAgfSBlbHNlIGlmIChub2Rlcy50ZXh0KSB7XG4gICAgICBub2RlcyA9IFtuZXcgQ29tbWVudChub2RlcyldXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBub2RlIHR5cGUgaW4gbm9kZSBjcmVhdGlvbicpXG4gICAgfVxuXG4gICAgbGV0IHByb2Nlc3NlZCA9IG5vZGVzLm1hcChpID0+IHtcbiAgICAgIGlmIChpLnBhcmVudCkgaS5wYXJlbnQucmVtb3ZlQ2hpbGQoaSlcbiAgICAgIGlmICh0eXBlb2YgaS5yYXdzLmJlZm9yZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHNhbXBsZSAmJiB0eXBlb2Ygc2FtcGxlLnJhd3MuYmVmb3JlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGkucmF3cy5iZWZvcmUgPSBzYW1wbGUucmF3cy5iZWZvcmUucmVwbGFjZSgvW15cXHNdL2csICcnKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpLnBhcmVudCA9IHRoaXNcbiAgICAgIHJldHVybiBpXG4gICAgfSlcblxuICAgIHJldHVybiBwcm9jZXNzZWRcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyb2YgQ29udGFpbmVyI1xuICAgKiBAbWVtYmVyIHtOb2RlW119IG5vZGVzIEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGNvbnRhaW5lcuKAmXMgY2hpbGRyZW4uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhIHsgY29sb3I6IGJsYWNrIH0nKVxuICAgKiByb290Lm5vZGVzLmxlbmd0aCAgICAgICAgICAgLy89PiAxXG4gICAqIHJvb3Qubm9kZXNbMF0uc2VsZWN0b3IgICAgICAvLz0+ICdhJ1xuICAgKiByb290Lm5vZGVzWzBdLm5vZGVzWzBdLnByb3AgLy89PiAnY29sb3InXG4gICAqL1xufVxuXG5leHBvcnQgZGVmYXVsdCBDb250YWluZXJcblxuLyoqXG4gKiBAY2FsbGJhY2sgY2hpbGRDb25kaXRpb25cbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZSAgICBDb250YWluZXIgY2hpbGQuXG4gKiBAcGFyYW0ge251bWJlcn0gaW5kZXggQ2hpbGQgaW5kZXguXG4gKiBAcGFyYW0ge05vZGVbXX0gbm9kZXMgQWxsIGNvbnRhaW5lciBjaGlsZHJlbi5cbiAqIEByZXR1cm4ge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiBAY2FsbGJhY2sgY2hpbGRJdGVyYXRvclxuICogQHBhcmFtIHtOb2RlfSBub2RlICAgIENvbnRhaW5lciBjaGlsZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCBDaGlsZCBpbmRleC5cbiAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gUmV0dXJuaW5nIGBmYWxzZWAgd2lsbCBicmVhayBpdGVyYXRpb24uXG4gKi9cbiJdLCJmaWxlIjoiY29udGFpbmVyLmpzIn0=
