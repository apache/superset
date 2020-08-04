'use strict';

var latex = require('../../utils/latex');
var stringify = require('../../utils/string').stringify;
var escape = require('../../utils/string').escape;
var extend = require('../../utils/object').extend;
var hasOwnProperty = require('../../utils/object').hasOwnProperty;
var map = require('../../utils/array').map;
var join = require('../../utils/array').join;
var validateSafeMethod = require('../../utils/customs').validateSafeMethod;
var getUniqueArgumentName = require('./utils/getUniqueArgumentName');

function factory (type, config, load, typed, math) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));
  var SymbolNode = load(require('./SymbolNode'));

  /**
   * @constructor FunctionNode
   * @extends {./Node}
   * invoke a list with arguments on a node
   * @param {./Node | string} fn Node resolving with a function on which to invoke
   *                             the arguments, typically a SymboNode or AccessorNode
   * @param {./Node[]} args
   */
  function FunctionNode(fn, args) {
    if (!(this instanceof FunctionNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    if (typeof fn === 'string') {
      fn = new SymbolNode(fn);
    }

    // validate input
    if (!type.isNode(fn)) throw new TypeError('Node expected as parameter "fn"');
    if (!Array.isArray(args) || !args.every(type.isNode)) {
      throw new TypeError('Array containing Nodes expected for parameter "args"');
    }

    this.fn = fn;
    this.args = args || [];

    // readonly property name
    Object.defineProperty(this, 'name', {
      get: function () {
        return this.fn.name || '';
      }.bind(this),
      set: function () {
        throw new Error('Cannot assign a new name, name is read-only');
      }
    });

    // TODO: deprecated since v3, remove some day
    var deprecated = function () {
      throw new Error('Property `FunctionNode.object` is deprecated, use `FunctionNode.fn` instead');
    };
    Object.defineProperty(this, 'object', { get: deprecated, set: deprecated });
  }

  FunctionNode.prototype = new Node();

  FunctionNode.prototype.type = 'FunctionNode';

  FunctionNode.prototype.isFunctionNode = true;

  /**
   * Compile the node to javascript code
   * @param {FunctionNode} node The node to be compiled
   * @param {Object} defs     Object which can be used to define functions
   *                          or constants globally available for the compiled
   *                          expression
   * @param {Object} args     Object with local function arguments, the key is
   *                          the name of the argument, and the value is `true`.
   *                          The object may not be mutated, but must be
   *                          extended instead.
   * @return {string} js
   * @private
   */
  function compileFunctionNode(node, defs, args) {
    if (!(node instanceof FunctionNode)) {
      throw new TypeError('No valid FunctionNode')
    }

    // compile fn and arguments
    var jsFn = compile(node.fn, defs, args);
    var jsArgs = map(node.args, function (arg) {
      return compile(arg, defs, args);
    });
    var jsScope = compileScope(defs, args);
    var argsName;

    if (type.isSymbolNode(node.fn)) {
      // we can statically determine whether the function has an rawArgs property
      var name = node.fn.name;
      var fn = hasOwnProperty(defs.math, name) ? defs.math[name] : undefined;
      var isRaw = (typeof fn === 'function') && (fn.rawArgs == true);

      if (isRaw) {
        // pass unevaluated parameters (nodes) to the function
        argsName = getUniqueArgumentName(defs);
        defs[argsName] = node.args;

        return jsFn + '(' + argsName + ', math, ' + jsScope + ')'; // "raw" evaluation
      }
      else {
        return jsFn + '(' + join(jsArgs, ', ') + ')';              // "regular" evaluation
      }
    }
    else if (type.isAccessorNode(node.fn) &&
        type.isIndexNode(node.fn.index) && node.fn.index.isObjectProperty()) {
      // execute the function with the right context: the object of the AccessorNode
      argsName = getUniqueArgumentName(defs);
      defs[argsName] = node.args;
      defs.validateSafeMethod = validateSafeMethod

      var jsObject = compile(node.fn.object, defs, args);
      var jsProp = stringify(node.fn.index.getObjectProperty());

      return '(function () {' +
          'var object = ' + jsObject + ';' +
          'validateSafeMethod(object, ' + jsProp + ');' +
          'return (object[' + jsProp + '] && object[' + jsProp + '].rawArgs) ' +
          ' ? object[' + jsProp + '](' + argsName + ', math, ' + jsScope + ')' + // "raw" evaluation
          ' : object[' + jsProp + '](' + join(jsArgs, ', ') + ')' +              // "regular" evaluation
          '})()';
    }
    else { // node.fn.isAccessorNode && !node.fn.index.isObjectProperty()
      // we have to dynamically determine whether the function has a rawArgs property
      argsName = getUniqueArgumentName(defs);
      defs[argsName] = node.args;

      return '(function () {' +
          'var fn = ' + jsFn + ';' +
          'return (fn && fn.rawArgs) ' +
          ' ? fn(' + argsName + ', math, ' + jsScope + ')' +  // "raw" evaluation
          ' : fn(' + join(jsArgs, ', ') + ')' +               // "regular" evaluation
          '})()';
    }
  }

  // register the compile function
  register(FunctionNode.prototype.type, compileFunctionNode);

  /**
   * Merge function arguments into scope before passing to the actual function.
   * This is needed when the function has `rawArgs=true`. In that case we have
   * to pass the `scope` as third argument, including any variables of
   * enclosing functions.
   * @param {Object} defs     Object which can be used to define functions
   *                          or constants globally available for the compiled
   *                          expression
   * @param {Object} args     Object with local function arguments, the key is
   *                          the name of the argument, and the value is `true`.
   *                          The object may not be mutated, but must be
   *                          extended instead.
   * @return {string} js
   * @private
   */
  function compileScope (defs, args) {
    var names = Object.keys(args)
        // .map(function (arg) {
        //   return args[arg];
        // });
    if (names.length === 0) {
      return 'scope';
    }
    else {
      // merge arguments into scope
      defs.extend = extend;

      var jsArgs = map(names, function (name) {
        return stringify(name) + ': ' + args[name];
      });

      return 'extend(extend({}, scope), {' + join(jsArgs, ', ') + '})';
    }
  }

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  FunctionNode.prototype.forEach = function (callback) {
    for (var i = 0; i < this.args.length; i++) {
      callback(this.args[i], 'args[' + i + ']', this);
    }
  };

  /**
   * Create a new FunctionNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {FunctionNode} Returns a transformed copy of the node
   */
  FunctionNode.prototype.map = function (callback) {
    var fn = this.fn.map(callback);
    var args = [];
    for (var i = 0; i < this.args.length; i++) {
      args[i] = this._ifNode(callback(this.args[i], 'args[' + i + ']', this));
    }
    return new FunctionNode(fn, args);
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {FunctionNode}
   */
  FunctionNode.prototype.clone = function () {
    return new FunctionNode(this.fn, this.args.slice(0));
  };

  //backup Node's toString function
  //@private
  var nodeToString = FunctionNode.prototype.toString;

  /**
   * Get string representation. (wrapper function)
   * This overrides parts of Node's toString function.
   * If callback is an object containing callbacks, it
   * calls the correct callback for the current node,
   * otherwise it falls back to calling Node's toString
   * function.
   *
   * @param {Object} options
   * @return {string} str
   * @override
   */
  FunctionNode.prototype.toString = function (options) {
    var customString;
    var name = this.fn.toString(options);
    if (options && (typeof options.handler === 'object') && hasOwnProperty(options.handler, name)) {
      //callback is a map of callback functions
      customString = options.handler[name](this, options);
    }

    if (typeof customString !== 'undefined') {
      return customString;
    }

    //fall back to Node's toString
    return nodeToString.call(this, options);
  };

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   */
  FunctionNode.prototype._toString = function (options) {
    var args = this.args.map(function (arg) {
      return arg.toString(options);
    });

    var fn = type.isFunctionAssignmentNode(this.fn)
        ? ('(' + this.fn.toString(options) + ')')
        : this.fn.toString(options)

    // format the arguments like "add(2, 4.2)"
    return fn + '(' + args.join(', ') + ')';
  };
  
  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   */
  FunctionNode.prototype.toHTML = function (options) {
    var args = this.args.map(function (arg) {
      return arg.toHTML(options);
    });

    // format the arguments like "add(2, 4.2)"
    return '<span class="math-function">' + escape(this.fn) + '</span><span class="math-paranthesis math-round-parenthesis">(</span>' + args.join('<span class="math-separator">,</span>') + '<span class="math-paranthesis math-round-parenthesis">)</span>';
  };

  /*
   * Expand a LaTeX template
   *
   * @param {string} template
   * @param {Node} node
   * @param {Object} options
   * @private
   **/
  function expandTemplate(template, node, options) {
    var latex = '';

    // Match everything of the form ${identifier} or ${identifier[2]} or $$
    // while submatching identifier and 2 (in the second case)
    var regex = new RegExp('\\$(?:\\{([a-z_][a-z_0-9]*)(?:\\[([0-9]+)\\])?\\}|\\$)', 'ig');

    var inputPos = 0;   //position in the input string
    var match;
    while ((match = regex.exec(template)) !== null) {   //go through all matches
      // add everything in front of the match to the LaTeX string
      latex += template.substring(inputPos, match.index);
      inputPos = match.index;

      if (match[0] === '$$') { // escaped dollar sign
        latex += '$';
        inputPos++;
      }
      else { // template parameter
        inputPos += match[0].length;
        var property = node[match[1]];
        if (!property) {
          throw new ReferenceError('Template: Property ' + match[1] + ' does not exist.');
        }
        if (match[2] === undefined) { //no square brackets
          switch (typeof property) {
            case 'string':
              latex += property;
              break;
            case 'object':
              if (type.isNode(property)) {
                latex += property.toTex(options);
              }
              else if (Array.isArray(property)) {
                //make array of Nodes into comma separated list
                latex += property.map(function (arg, index) {
                  if (type.isNode(arg)) {
                    return arg.toTex(options);
                  }
                  throw new TypeError('Template: ' + match[1] + '[' + index + '] is not a Node.');
                }).join(',');
              }
              else {
                throw new TypeError('Template: ' + match[1] + ' has to be a Node, String or array of Nodes');
              }
              break;
            default:
              throw new TypeError('Template: ' + match[1] + ' has to be a Node, String or array of Nodes');
          }
        }
        else { //with square brackets
          if (type.isNode(property[match[2]] && property[match[2]])) {
            latex += property[match[2]].toTex(options);
          }
          else {
            throw new TypeError('Template: ' + match[1] + '[' + match[2] + '] is not a Node.');
          }
        }
      }
    }
    latex += template.slice(inputPos);  //append rest of the template

    return latex;
  }

  //backup Node's toTex function
  //@private
  var nodeToTex = FunctionNode.prototype.toTex;

  /**
   * Get LaTeX representation. (wrapper function)
   * This overrides parts of Node's toTex function.
   * If callback is an object containing callbacks, it
   * calls the correct callback for the current node,
   * otherwise it falls back to calling Node's toTex
   * function.
   *
   * @param {Object} options
   * @return {string}
   */
  FunctionNode.prototype.toTex = function (options) {
    var customTex;
    if (options && (typeof options.handler === 'object') && hasOwnProperty(options.handler, this.name)) {
      //callback is a map of callback functions
      customTex = options.handler[this.name](this, options);
    }

    if (typeof customTex !== 'undefined') {
      return customTex;
    }

    //fall back to Node's toTex
    return nodeToTex.call(this, options);
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   */
  FunctionNode.prototype._toTex = function (options) {
    var args = this.args.map(function (arg) { //get LaTeX of the arguments
      return arg.toTex(options);
    });

    var latexConverter;

    if (math[this.name] && ((typeof math[this.name].toTex === 'function') || (typeof math[this.name].toTex === 'object') || (typeof math[this.name].toTex === 'string'))) {
      //.toTex is a callback function
      latexConverter = math[this.name].toTex;
    }

    var customToTex;
    switch (typeof latexConverter) {
      case 'function': //a callback function
        customToTex = latexConverter(this, options);
        break;
      case 'string': //a template string
        customToTex = expandTemplate(latexConverter, this, options);
        break;
      case 'object': //an object with different "converters" for different numbers of arguments
        switch (typeof latexConverter[args.length]) {
          case 'function':
            customToTex = latexConverter[args.length](this, options);
            break;
          case 'string':
            customToTex = expandTemplate(latexConverter[args.length], this, options);
            break;
        }
    }

    if (typeof customToTex !== 'undefined') {
      return customToTex;
    }

    return expandTemplate(latex.defaultTemplate, this, options);
  };

  /**
   * Get identifier.
   * @return {string}
   */
  FunctionNode.prototype.getIdentifier = function () {
    return this.type + ':' + this.name;
  };

  return FunctionNode;
}

exports.name = 'FunctionNode';
exports.path = 'expression.node';
exports.math = true; // request access to the math namespace as 5th argument of the factory function
exports.factory = factory;
