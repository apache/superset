/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */
'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // OldNode. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like OldNode.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.typed = factory();
  }
}(this, function () {
  // factory function to create a new instance of typed-function
  // TODO: allow passing configuration, types, tests via the factory function
  function create() {
    /**
     * Get a type test function for a specific data type
     * @param {string} name                   Name of a data type like 'number' or 'string'
     * @returns {Function(obj: *) : boolean}  Returns a type testing function.
     *                                        Throws an error for an unknown type.
     */
    function getTypeTest(name) {
      var test;
      for (var i = 0; i < typed.types.length; i++) {
        var entry = typed.types[i];
        if (entry.name === name) {
          test = entry.test;
          break;
        }
      }

      if (!test) {
        var hint;
        for (i = 0; i < typed.types.length; i++) {
          entry = typed.types[i];
          if (entry.name.toLowerCase() == name.toLowerCase()) {
            hint = entry.name;
            break;
          }
        }

        throw new Error('Unknown type "' + name + '"' +
            (hint ? ('. Did you mean "' + hint + '"?') : ''));
      }
      return test;
    }

    /**
     * Retrieve the function name from a set of functions, and check
     * whether the name of all functions match (if given)
     * @param {Array.<function>} fns
     */
    function getName (fns) {
      var name = '';

      for (var i = 0; i < fns.length; i++) {
        var fn = fns[i];

        // merge function name when this is a typed function
        if (fn.signatures && fn.name != '') {
          if (name == '') {
            name = fn.name;
          }
          else if (name != fn.name) {
            var err = new Error('Function names do not match (expected: ' + name + ', actual: ' + fn.name + ')');
            err.data = {
              actual: fn.name,
              expected: name
            };
            throw err;
          }
        }
      }

      return name;
    }

    /**
     * Create an ArgumentsError. Creates messages like:
     *
     *   Unexpected type of argument (expected: ..., actual: ..., index: ...)
     *   Too few arguments (expected: ..., index: ...)
     *   Too many arguments (expected: ..., actual: ...)
     *
     * @param {String} fn         Function name
     * @param {number} argCount   Number of arguments
     * @param {Number} index      Current argument index
     * @param {*} actual          Current argument
     * @param {string} [expected] An optional, comma separated string with
     *                            expected types on given index
     * @extends Error
     */
    function createError(fn, argCount, index, actual, expected) {
      var actualType = getTypeOf(actual);
      var _expected = expected ? expected.split(',') : null;
      var _fn = (fn || 'unnamed');
      var anyType = _expected && contains(_expected, 'any');
      var message;
      var data = {
        fn: fn,
        index: index,
        actual: actualType,
        expected: _expected
      };

      if (_expected) {
        if (argCount > index && !anyType) {
          // unexpected type
          message = 'Unexpected type of argument in function ' + _fn +
              ' (expected: ' + _expected.join(' or ') + ', actual: ' + actualType + ', index: ' + index + ')';
        }
        else {
          // too few arguments
          message = 'Too few arguments in function ' + _fn +
              ' (expected: ' + _expected.join(' or ') + ', index: ' + index + ')';
        }
      }
      else {
        // too many arguments
        message = 'Too many arguments in function ' + _fn +
            ' (expected: ' + index + ', actual: ' + argCount + ')'
      }

      var err = new TypeError(message);
      err.data = data;
      return err;
    }

    /**
     * Collection with function references (local shortcuts to functions)
     * @constructor
     * @param {string} [name='refs']  Optional name for the refs, used to generate
     *                                JavaScript code
     */
    function Refs(name) {
      this.name = name || 'refs';
      this.categories = {};
    }

    /**
     * Add a function reference.
     * @param {Function} fn
     * @param {string} [category='fn']    A function category, like 'fn' or 'signature'
     * @returns {string} Returns the function name, for example 'fn0' or 'signature2'
     */
    Refs.prototype.add = function (fn, category) {
      var cat = category || 'fn';
      if (!this.categories[cat]) this.categories[cat] = [];

      var index = this.categories[cat].indexOf(fn);
      if (index == -1) {
        index = this.categories[cat].length;
        this.categories[cat].push(fn);
      }

      return cat + index;
    };

    /**
     * Create code lines for all function references
     * @returns {string} Returns the code containing all function references
     */
    Refs.prototype.toCode = function () {
      var code = [];
      var path = this.name + '.categories';
      var categories = this.categories;

      for (var cat in categories) {
        if (categories.hasOwnProperty(cat)) {
          var category = categories[cat];

          for (var i = 0; i < category.length; i++) {
            code.push('var ' + cat + i + ' = ' + path + '[\'' + cat + '\'][' + i + '];');
          }
        }
      }

      return code.join('\n');
    };

    /**
     * A function parameter
     * @param {string | string[] | Param} types    A parameter type like 'string',
     *                                             'number | boolean'
     * @param {boolean} [varArgs=false]            Variable arguments if true
     * @constructor
     */
    function Param(types, varArgs) {
      // parse the types, can be a string with types separated by pipe characters |
      if (typeof types === 'string') {
        // parse variable arguments operator (ellipses '...number')
        var _types = types.trim();
        var _varArgs = _types.substr(0, 3) === '...';
        if (_varArgs) {
          _types = _types.substr(3);
        }
        if (_types === '') {
          this.types = ['any'];
        }
        else {
          this.types = _types.split('|');
          for (var i = 0; i < this.types.length; i++) {
            this.types[i] = this.types[i].trim();
          }
        }
      }
      else if (Array.isArray(types)) {
        this.types = types;
      }
      else if (types instanceof Param) {
        return types.clone();
      }
      else {
        throw new Error('String or Array expected');
      }

      // can hold a type to which to convert when handling this parameter
      this.conversions = [];
      // TODO: implement better API for conversions, be able to add conversions via constructor (support a new type Object?)

      // variable arguments
      this.varArgs = _varArgs || varArgs || false;

      // check for any type arguments
      this.anyType = this.types.indexOf('any') !== -1;
    }

    /**
     * Order Params
     * any type ('any') will be ordered last, and object as second last (as other
     * types may be an object as well, like Array).
     *
     * @param {Param} a
     * @param {Param} b
     * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
     */
    Param.compare = function (a, b) {
      // TODO: simplify parameter comparison, it's a mess
      if (a.anyType) return 1;
      if (b.anyType) return -1;

      if (contains(a.types, 'Object')) return 1;
      if (contains(b.types, 'Object')) return -1;

      if (a.hasConversions()) {
        if (b.hasConversions()) {
          var i, ac, bc;

          for (i = 0; i < a.conversions.length; i++) {
            if (a.conversions[i] !== undefined) {
              ac = a.conversions[i];
              break;
            }
          }

          for (i = 0; i < b.conversions.length; i++) {
            if (b.conversions[i] !== undefined) {
              bc = b.conversions[i];
              break;
            }
          }

          return typed.conversions.indexOf(ac) - typed.conversions.indexOf(bc);
        }
        else {
          return 1;
        }
      }
      else {
        if (b.hasConversions()) {
          return -1;
        }
        else {
          // both params have no conversions
          var ai, bi;

          for (i = 0; i < typed.types.length; i++) {
            if (typed.types[i].name === a.types[0]) {
              ai = i;
              break;
            }
          }

          for (i = 0; i < typed.types.length; i++) {
            if (typed.types[i].name === b.types[0]) {
              bi = i;
              break;
            }
          }

          return ai - bi;
        }
      }
    };

    /**
     * Test whether this parameters types overlap an other parameters types.
     * Will not match ['any'] with ['number']
     * @param {Param} other
     * @return {boolean} Returns true when there are overlapping types
     */
    Param.prototype.overlapping = function (other) {
      for (var i = 0; i < this.types.length; i++) {
        if (contains(other.types, this.types[i])) {
          return true;
        }
      }
      return false;
    };

    /**
     * Test whether this parameters types matches an other parameters types.
     * When any of the two parameters contains `any`, true is returned
     * @param {Param} other
     * @return {boolean} Returns true when there are matching types
     */
    Param.prototype.matches = function (other) {
      return this.anyType || other.anyType || this.overlapping(other);
    };

    /**
     * Create a clone of this param
     * @returns {Param} Returns a cloned version of this param
     */
    Param.prototype.clone = function () {
      var param = new Param(this.types.slice(), this.varArgs);
      param.conversions = this.conversions.slice();
      return param;
    };

    /**
     * Test whether this parameter contains conversions
     * @returns {boolean} Returns true if the parameter contains one or
     *                    multiple conversions.
     */
    Param.prototype.hasConversions = function () {
      return this.conversions.length > 0;
    };

    /**
     * Tests whether this parameters contains any of the provided types
     * @param {Object} types  A Map with types, like {'number': true}
     * @returns {boolean}     Returns true when the parameter contains any
     *                        of the provided types
     */
    Param.prototype.contains = function (types) {
      for (var i = 0; i < this.types.length; i++) {
        if (types[this.types[i]]) {
          return true;
        }
      }
      return false;
    };

    /**
     * Return a string representation of this params types, like 'string' or
     * 'number | boolean' or '...number'
     * @param {boolean} [toConversion]   If true, the returned types string
     *                                   contains the types where the parameter
     *                                   will convert to. If false (default)
     *                                   the "from" types are returned
     * @returns {string}
     */
    Param.prototype.toString = function (toConversion) {
      var types = [];
      var keys = {};

      for (var i = 0; i < this.types.length; i++) {
        var conversion = this.conversions[i];
        var type = toConversion && conversion ? conversion.to : this.types[i];
        if (!(type in keys)) {
          keys[type] = true;
          types.push(type);
        }
      }

      return (this.varArgs ? '...' : '') + types.join('|');
    };

    /**
     * A function signature
     * @param {string | string[] | Param[]} params
     *                         Array with the type(s) of each parameter,
     *                         or a comma separated string with types
     * @param {Function} fn    The actual function
     * @constructor
     */
    function Signature(params, fn) {
      var _params;
      if (typeof params === 'string') {
        _params = (params !== '') ? params.split(',') : [];
      }
      else if (Array.isArray(params)) {
        _params = params;
      }
      else {
        throw new Error('string or Array expected');
      }

      this.params = new Array(_params.length);
      this.anyType = false;
      this.varArgs = false;
      for (var i = 0; i < _params.length; i++) {
        var param = new Param(_params[i]);
        this.params[i] = param;
        if (param.anyType) {
          this.anyType = true;
        }
        if (i === _params.length - 1) {
          // the last argument
          this.varArgs = param.varArgs;
        }
        else {
          // non-last argument
          if (param.varArgs) {
            throw new SyntaxError('Unexpected variable arguments operator "..."');
          }
        }
      }

      this.fn = fn;
    }

    /**
     * Create a clone of this signature
     * @returns {Signature} Returns a cloned version of this signature
     */
    Signature.prototype.clone = function () {
      return new Signature(this.params.slice(), this.fn);
    };

    /**
     * Expand a signature: split params with union types in separate signatures
     * For example split a Signature "string | number" into two signatures.
     * @return {Signature[]} Returns an array with signatures (at least one)
     */
    Signature.prototype.expand = function () {
      var signatures = [];

      function recurse(signature, path) {
        if (path.length < signature.params.length) {
          var i, newParam, conversion;

          var param = signature.params[path.length];
          if (param.varArgs) {
            // a variable argument. do not split the types in the parameter
            newParam = param.clone();

            // add conversions to the parameter
            // recurse for all conversions
            for (i = 0; i < typed.conversions.length; i++) {
              conversion = typed.conversions[i];
              if (!contains(param.types, conversion.from) && contains(param.types, conversion.to)) {
                var j = newParam.types.length;
                newParam.types[j] = conversion.from;
                newParam.conversions[j] = conversion;
              }
            }

            recurse(signature, path.concat(newParam));
          }
          else {
            // split each type in the parameter
            for (i = 0; i < param.types.length; i++) {
              recurse(signature, path.concat(new Param(param.types[i])));
            }

            // recurse for all conversions
            for (i = 0; i < typed.conversions.length; i++) {
              conversion = typed.conversions[i];
              if (!contains(param.types, conversion.from) && contains(param.types, conversion.to)) {
                newParam = new Param(conversion.from);
                newParam.conversions[0] = conversion;
                recurse(signature, path.concat(newParam));
              }
            }
          }
        }
        else {
          signatures.push(new Signature(path, signature.fn));
        }
      }

      recurse(this, []);

      return signatures;
    };

    /**
     * Compare two signatures.
     *
     * When two params are equal and contain conversions, they will be sorted
     * by lowest index of the first conversions.
     *
     * @param {Signature} a
     * @param {Signature} b
     * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
     */
    Signature.compare = function (a, b) {
      if (a.params.length > b.params.length) return 1;
      if (a.params.length < b.params.length) return -1;

      // count the number of conversions
      var i;
      var len = a.params.length; // a and b have equal amount of params
      var ac = 0;
      var bc = 0;
      for (i = 0; i < len; i++) {
        if (a.params[i].hasConversions()) ac++;
        if (b.params[i].hasConversions()) bc++;
      }

      if (ac > bc) return 1;
      if (ac < bc) return -1;

      // compare the order per parameter
      for (i = 0; i < a.params.length; i++) {
        var cmp = Param.compare(a.params[i], b.params[i]);
        if (cmp !== 0) {
          return cmp;
        }
      }

      return 0;
    };

    /**
     * Test whether any of the signatures parameters has conversions
     * @return {boolean} Returns true when any of the parameters contains
     *                   conversions.
     */
    Signature.prototype.hasConversions = function () {
      for (var i = 0; i < this.params.length; i++) {
        if (this.params[i].hasConversions()) {
          return true;
        }
      }
      return false;
    };

    /**
     * Test whether this signature should be ignored.
     * Checks whether any of the parameters contains a type listed in
     * typed.ignore
     * @return {boolean} Returns true when the signature should be ignored
     */
    Signature.prototype.ignore = function () {
      // create a map with ignored types
      var types = {};
      for (var i = 0; i < typed.ignore.length; i++) {
        types[typed.ignore[i]] = true;
      }

      // test whether any of the parameters contains this type
      for (i = 0; i < this.params.length; i++) {
        if (this.params[i].contains(types)) {
          return true;
        }
      }

      return false;
    };

    /**
     * Test whether the path of this signature matches a given path.
     * @param {Param[]} params
     */
    Signature.prototype.paramsStartWith = function (params) {
      if (params.length === 0) {
        return true;
      }

      var aLast = last(this.params);
      var bLast = last(params);

      for (var i = 0; i < params.length; i++) {
        var a = this.params[i] || (aLast.varArgs ? aLast: null);
        var b = params[i]      || (bLast.varArgs ? bLast: null);

        if (!a ||  !b || !a.matches(b)) {
          return false;
        }
      }

      return true;
    };

    /**
     * Generate the code to invoke this signature
     * @param {Refs} refs
     * @param {string} prefix
     * @returns {string} Returns code
     */
    Signature.prototype.toCode = function (refs, prefix) {
      var code = [];

      var args = new Array(this.params.length);
      for (var i = 0; i < this.params.length; i++) {
        var param = this.params[i];
        var conversion = param.conversions[0];
        if (param.varArgs) {
          args[i] = 'varArgs';
        }
        else if (conversion) {
          args[i] = refs.add(conversion.convert, 'convert') + '(arg' + i + ')';
        }
        else {
          args[i] = 'arg' + i;
        }
      }

      var ref = this.fn ? refs.add(this.fn, 'signature') : undefined;
      if (ref) {
        return prefix + 'return ' + ref + '(' + args.join(', ') + '); // signature: ' + this.params.join(', ');
      }

      return code.join('\n');
    };

    /**
     * Return a string representation of the signature
     * @returns {string}
     */
    Signature.prototype.toString = function () {
      return this.params.join(', ');
    };

    /**
     * A group of signatures with the same parameter on given index
     * @param {Param[]} path
     * @param {Signature} [signature]
     * @param {Node[]} childs
     * @param {boolean} [fallThrough=false]
     * @constructor
     */
    function Node(path, signature, childs, fallThrough) {
      this.path = path || [];
      this.param = path[path.length - 1] || null;
      this.signature = signature || null;
      this.childs = childs || [];
      this.fallThrough = fallThrough || false;
    }

    /**
     * Generate code for this group of signatures
     * @param {Refs} refs
     * @param {string} prefix
     * @returns {string} Returns the code as string
     */
    Node.prototype.toCode = function (refs, prefix) {
      // TODO: split this function in multiple functions, it's too large
      var code = [];

      if (this.param) {
        var index = this.path.length - 1;
        var conversion = this.param.conversions[0];
        var comment = '// type: ' + (conversion ?
                (conversion.from + ' (convert to ' + conversion.to + ')') :
                this.param);

        // non-root node (path is non-empty)
        if (this.param.varArgs) {
          if (this.param.anyType) {
            // variable arguments with any type
            code.push(prefix + 'if (arguments.length > ' + index + ') {');
            code.push(prefix + '  var varArgs = [];');
            code.push(prefix + '  for (var i = ' + index + '; i < arguments.length; i++) {');
            code.push(prefix + '    varArgs.push(arguments[i]);');
            code.push(prefix + '  }');
            code.push(this.signature.toCode(refs, prefix + '  '));
            code.push(prefix + '}');
          }
          else {
            // variable arguments with a fixed type
            var getTests = function (types, arg) {
              var tests = [];
              for (var i = 0; i < types.length; i++) {
                tests[i] = refs.add(getTypeTest(types[i]), 'test') + '(' + arg + ')';
              }
              return tests.join(' || ');
            }.bind(this);

            var allTypes = this.param.types;
            var exactTypes = [];
            for (var i = 0; i < allTypes.length; i++) {
              if (this.param.conversions[i] === undefined) {
                exactTypes.push(allTypes[i]);
              }
            }

            code.push(prefix + 'if (' + getTests(allTypes, 'arg' + index) + ') { ' + comment);
            code.push(prefix + '  var varArgs = [arg' + index + '];');
            code.push(prefix + '  for (var i = ' + (index + 1) + '; i < arguments.length; i++) {');
            code.push(prefix + '    if (' + getTests(exactTypes, 'arguments[i]') + ') {');
            code.push(prefix + '      varArgs.push(arguments[i]);');

            for (var i = 0; i < allTypes.length; i++) {
              var conversion_i = this.param.conversions[i];
              if (conversion_i) {
                var test = refs.add(getTypeTest(allTypes[i]), 'test');
                var convert = refs.add(conversion_i.convert, 'convert');
                code.push(prefix + '    }');
                code.push(prefix + '    else if (' + test + '(arguments[i])) {');
                code.push(prefix + '      varArgs.push(' + convert + '(arguments[i]));');
              }
            }
            code.push(prefix + '    } else {');
            code.push(prefix + '      throw createError(name, arguments.length, i, arguments[i], \'' + exactTypes.join(',') + '\');');
            code.push(prefix + '    }');
            code.push(prefix + '  }');
            code.push(this.signature.toCode(refs, prefix + '  '));
            code.push(prefix + '}');
          }
        }
        else {
          if (this.param.anyType) {
            // any type
            code.push(prefix + '// type: any');
            code.push(this._innerCode(refs, prefix));
          }
          else {
            // regular type
            var type = this.param.types[0];
            var test = type !== 'any' ? refs.add(getTypeTest(type), 'test') : null;

            code.push(prefix + 'if (' + test + '(arg' + index + ')) { ' + comment);
            code.push(this._innerCode(refs, prefix + '  '));
            code.push(prefix + '}');
          }
        }
      }
      else {
        // root node (path is empty)
        code.push(this._innerCode(refs, prefix));
      }

      return code.join('\n');
    };

    /**
     * Generate inner code for this group of signatures.
     * This is a helper function of Node.prototype.toCode
     * @param {Refs} refs
     * @param {string} prefix
     * @returns {string} Returns the inner code as string
     * @private
     */
    Node.prototype._innerCode = function (refs, prefix) {
      var code = [];
      var i;

      if (this.signature) {
        code.push(prefix + 'if (arguments.length === ' + this.path.length + ') {');
        code.push(this.signature.toCode(refs, prefix + '  '));
        code.push(prefix + '}');
      }

      for (i = 0; i < this.childs.length; i++) {
        code.push(this.childs[i].toCode(refs, prefix));
      }

      // TODO: shouldn't the this.param.anyType check be redundant
      if (!this.fallThrough || (this.param && this.param.anyType)) {
        var exceptions = this._exceptions(refs, prefix);
        if (exceptions) {
          code.push(exceptions);
        }
      }

      return code.join('\n');
    };


    /**
     * Generate code to throw exceptions
     * @param {Refs} refs
     * @param {string} prefix
     * @returns {string} Returns the inner code as string
     * @private
     */
    Node.prototype._exceptions = function (refs, prefix) {
      var index = this.path.length;

      if (this.childs.length === 0) {
        // TODO: can this condition be simplified? (we have a fall-through here)
        return [
          prefix + 'if (arguments.length > ' + index + ') {',
          prefix + '  throw createError(name, arguments.length, ' + index + ', arguments[' + index + ']);',
          prefix + '}'
        ].join('\n');
      }
      else {
        var keys = {};
        var types = [];

        for (var i = 0; i < this.childs.length; i++) {
          var node = this.childs[i];
          if (node.param) {
            for (var j = 0; j < node.param.types.length; j++) {
              var type = node.param.types[j];
              if (!(type in keys) && !node.param.conversions[j]) {
                keys[type] = true;
                types.push(type);
              }
            }
          }
        }

        return prefix + 'throw createError(name, arguments.length, ' + index + ', arguments[' + index + '], \'' + types.join(',') + '\');';
      }
    };

    /**
     * Split all raw signatures into an array with expanded Signatures
     * @param {Object.<string, Function>} rawSignatures
     * @return {Signature[]} Returns an array with expanded signatures
     */
    function parseSignatures(rawSignatures) {
      // FIXME: need to have deterministic ordering of signatures, do not create via object
      var signature;
      var keys = {};
      var signatures = [];
      var i;

      for (var types in rawSignatures) {
        if (rawSignatures.hasOwnProperty(types)) {
          var fn = rawSignatures[types];
          signature = new Signature(types, fn);

          if (signature.ignore()) {
            continue;
          }

          var expanded = signature.expand();

          for (i = 0; i < expanded.length; i++) {
            var signature_i = expanded[i];
            var key = signature_i.toString();
            var existing = keys[key];
            if (!existing) {
              keys[key] = signature_i;
            }
            else {
              var cmp = Signature.compare(signature_i, existing);
              if (cmp < 0) {
                // override if sorted first
                keys[key] = signature_i;
              }
              else if (cmp === 0) {
                throw new Error('Signature "' + key + '" is defined twice');
              }
              // else: just ignore
            }
          }
        }
      }

      // convert from map to array
      for (key in keys) {
        if (keys.hasOwnProperty(key)) {
          signatures.push(keys[key]);
        }
      }

      // order the signatures
      signatures.sort(function (a, b) {
        return Signature.compare(a, b);
      });

      // filter redundant conversions from signatures with varArgs
      // TODO: simplify this loop or move it to a separate function
      for (i = 0; i < signatures.length; i++) {
        signature = signatures[i];

        if (signature.varArgs) {
          var index = signature.params.length - 1;
          var param = signature.params[index];

          var t = 0;
          while (t < param.types.length) {
            if (param.conversions[t]) {
              var type = param.types[t];

              for (var j = 0; j < signatures.length; j++) {
                var other = signatures[j];
                var p = other.params[index];

                if (other !== signature &&
                    p &&
                    contains(p.types, type) && !p.conversions[index]) {
                  // this (conversion) type already exists, remove it
                  param.types.splice(t, 1);
                  param.conversions.splice(t, 1);
                  t--;
                  break;
                }
              }
            }
            t++;
          }
        }
      }

      return signatures;
    }

    /**
     * Filter all any type signatures
     * @param {Signature[]} signatures
     * @return {Signature[]} Returns only any type signatures
     */
    function filterAnyTypeSignatures (signatures) {
      var filtered = [];

      for (var i = 0; i < signatures.length; i++) {
        if (signatures[i].anyType) {
          filtered.push(signatures[i]);
        }
      }

      return filtered;
    }

    /**
     * create a map with normalized signatures as key and the function as value
     * @param {Signature[]} signatures   An array with split signatures
     * @return {Object.<string, Function>} Returns a map with normalized
     *                                     signatures as key, and the function
     *                                     as value.
     */
    function mapSignatures(signatures) {
      var normalized = {};

      for (var i = 0; i < signatures.length; i++) {
        var signature = signatures[i];
        if (signature.fn && !signature.hasConversions()) {
          var params = signature.params.join(',');
          normalized[params] = signature.fn;
        }
      }

      return normalized;
    }

    /**
     * Parse signatures recursively in a node tree.
     * @param {Signature[]} signatures  Array with expanded signatures
     * @param {Param[]} path            Traversed path of parameter types
     * @param {Signature[]} anys
     * @return {Node}                   Returns a node tree
     */
    function parseTree(signatures, path, anys) {
      var i, signature;
      var index = path.length;
      var nodeSignature;

      var filtered = [];
      for (i = 0; i < signatures.length; i++) {
        signature = signatures[i];

        // filter the first signature with the correct number of params
        if (signature.params.length === index && !nodeSignature) {
          nodeSignature = signature;
        }

        if (signature.params[index] != undefined) {
          filtered.push(signature);
        }
      }

      // sort the filtered signatures by param
      filtered.sort(function (a, b) {
        return Param.compare(a.params[index], b.params[index]);
      });

      // recurse over the signatures
      var entries = [];
      for (i = 0; i < filtered.length; i++) {
        signature = filtered[i];
        // group signatures with the same param at current index
        var param = signature.params[index];

        // TODO: replace the next filter loop
        var existing = entries.filter(function (entry) {
          return entry.param.overlapping(param);
        })[0];

        //var existing;
        //for (var j = 0; j < entries.length; j++) {
        //  if (entries[j].param.overlapping(param)) {
        //    existing = entries[j];
        //    break;
        //  }
        //}

        if (existing) {
          if (existing.param.varArgs) {
            throw new Error('Conflicting types "' + existing.param + '" and "' + param + '"');
          }
          existing.signatures.push(signature);
        }
        else {
          entries.push({
            param: param,
            signatures: [signature]
          });
        }
      }

      // find all any type signature that can still match our current path
      var matchingAnys = [];
      for (i = 0; i < anys.length; i++) {
        if (anys[i].paramsStartWith(path)) {
          matchingAnys.push(anys[i]);
        }
      }

      // see if there are any type signatures that don't match any of the
      // signatures that we have in our tree, i.e. we have alternative
      // matching signature(s) outside of our current tree and we should
      // fall through to them instead of throwing an exception
      var fallThrough = false;
      for (i = 0; i < matchingAnys.length; i++) {
        if (!contains(signatures, matchingAnys[i])) {
          fallThrough = true;
          break;
        }
      }

      // parse the childs
      var childs = new Array(entries.length);
      for (i = 0; i < entries.length; i++) {
        var entry = entries[i];
        childs[i] = parseTree(entry.signatures, path.concat(entry.param), matchingAnys)
      }

      return new Node(path, nodeSignature, childs, fallThrough);
    }

    /**
     * Generate an array like ['arg0', 'arg1', 'arg2']
     * @param {number} count Number of arguments to generate
     * @returns {Array} Returns an array with argument names
     */
    function getArgs(count) {
      // create an array with all argument names
      var args = [];
      for (var i = 0; i < count; i++) {
        args[i] = 'arg' + i;
      }

      return args;
    }

    /**
     * Compose a function from sub-functions each handling a single type signature.
     * Signatures:
     *   typed(signature: string, fn: function)
     *   typed(name: string, signature: string, fn: function)
     *   typed(signatures: Object.<string, function>)
     *   typed(name: string, signatures: Object.<string, function>)
     *
     * @param {string | null} name
     * @param {Object.<string, Function>} signatures
     * @return {Function} Returns the typed function
     * @private
     */
    function _typed(name, signatures) {
      var refs = new Refs();

      // parse signatures, expand them
      var _signatures = parseSignatures(signatures);
      if (_signatures.length == 0) {
        throw new Error('No signatures provided');
      }

      // filter all any type signatures
      var anys = filterAnyTypeSignatures(_signatures);

      // parse signatures into a node tree
      var node = parseTree(_signatures, [], anys);

      //var util = require('util');
      //console.log('ROOT');
      //console.log(util.inspect(node, { depth: null }));

      // generate code for the typed function
      // safeName is a conservative replacement of characters 
      // to prevend being able to inject JS code at the place of the function name 
      // the name is useful for stack trackes therefore we want have it there
      var code = [];
      var safeName = (name || '').replace(/[^a-zA-Z0-9_$]/g, '_')
      var args = getArgs(maxParams(_signatures));
      code.push('function ' + safeName + '(' + args.join(', ') + ') {');
      code.push('  "use strict";');
      code.push('  var name = ' + JSON.stringify(name || '') + ';');
      code.push(node.toCode(refs, '  ', false));
      code.push('}');

      // generate body for the factory function
      var body = [
        refs.toCode(),
        'return ' + code.join('\n')
      ].join('\n');

      // evaluate the JavaScript code and attach function references
      var factory = (new Function(refs.name, 'createError', body));
      var fn = factory(refs, createError);

      //console.log('FN\n' + fn.toString()); // TODO: cleanup

      // attach the signatures with sub-functions to the constructed function
      fn.signatures = mapSignatures(_signatures);

      return fn;
    }

    /**
     * Calculate the maximum number of parameters in givens signatures
     * @param {Signature[]} signatures
     * @returns {number} The maximum number of parameters
     */
    function maxParams(signatures) {
      var max = 0;

      for (var i = 0; i < signatures.length; i++) {
        var len = signatures[i].params.length;
        if (len > max) {
          max = len;
        }
      }

      return max;
    }

    /**
     * Get the type of a value
     * @param {*} x
     * @returns {string} Returns a string with the type of value
     */
    function getTypeOf(x) {
      var obj;

      for (var i = 0; i < typed.types.length; i++) {
        var entry = typed.types[i];

        if (entry.name === 'Object') {
          // Array and Date are also Object, so test for Object afterwards
          obj = entry;
        }
        else {
          if (entry.test(x)) return entry.name;
        }
      }

      // at last, test whether an object
      if (obj && obj.test(x)) return obj.name;

      return 'unknown';
    }

    /**
     * Test whether an array contains some item
     * @param {Array} array
     * @param {*} item
     * @return {boolean} Returns true if array contains item, false if not.
     */
    function contains(array, item) {
      return array.indexOf(item) !== -1;
    }

    /**
     * Returns the last item in the array
     * @param {Array} array
     * @return {*} item
     */
    function last (array) {
      return array[array.length - 1];
    }

    // data type tests
    var types = [
      { name: 'number',    test: function (x) { return typeof x === 'number' } },
      { name: 'string',    test: function (x) { return typeof x === 'string' } },
      { name: 'boolean',   test: function (x) { return typeof x === 'boolean' } },
      { name: 'Function',  test: function (x) { return typeof x === 'function'} },
      { name: 'Array',     test: Array.isArray },
      { name: 'Date',      test: function (x) { return x instanceof Date } },
      { name: 'RegExp',    test: function (x) { return x instanceof RegExp } },
      { name: 'Object',    test: function (x) { return typeof x === 'object' } },
      { name: 'null',      test: function (x) { return x === null } },
      { name: 'undefined', test: function (x) { return x === undefined } }
    ];

    // configuration
    var config = {};

    // type conversions. Order is important
    var conversions = [];

    // types to be ignored
    var ignore = [];

    // temporary object for holding types and conversions, for constructing
    // the `typed` function itself
    // TODO: find a more elegant solution for this
    var typed = {
      config: config,
      types: types,
      conversions: conversions,
      ignore: ignore
    };

    /**
     * Construct the typed function itself with various signatures
     *
     * Signatures:
     *
     *   typed(signatures: Object.<string, function>)
     *   typed(name: string, signatures: Object.<string, function>)
     */
    typed = _typed('typed', {
      'Object': function (signatures) {
        var fns = [];
        for (var signature in signatures) {
          if (signatures.hasOwnProperty(signature)) {
            fns.push(signatures[signature]);
          }
        }
        var name = getName(fns);

        return _typed(name, signatures);
      },
      'string, Object': _typed,
      // TODO: add a signature 'Array.<function>'
      '...Function': function (fns) {
        var err;
        var name = getName(fns);
        var signatures = {};

        for (var i = 0; i < fns.length; i++) {
          var fn = fns[i];

          // test whether this is a typed-function
          if (!(typeof fn.signatures === 'object')) {
            err = new TypeError('Function is no typed-function (index: ' + i + ')');
            err.data = {index: i};
            throw err;
          }

          // merge the signatures
          for (var signature in fn.signatures) {
            if (fn.signatures.hasOwnProperty(signature)) {
              if (signatures.hasOwnProperty(signature)) {
                if (fn.signatures[signature] !== signatures[signature]) {
                  err = new Error('Signature "' + signature + '" is defined twice');
                  err.data = {signature: signature};
                  throw err;
                }
                // else: both signatures point to the same function, that's fine
              }
              else {
                signatures[signature] = fn.signatures[signature];
              }
            }
          }
        }

        return _typed(name, signatures);
      }
    });

    /**
     * Find a specific signature from a (composed) typed function, for
     * example:
     *
     *   typed.find(fn, ['number', 'string'])
     *   typed.find(fn, 'number, string')
     *
     * Function find only only works for exact matches.
     *
     * @param {Function} fn                   A typed-function
     * @param {string | string[]} signature   Signature to be found, can be
     *                                        an array or a comma separated string.
     * @return {Function}                     Returns the matching signature, or
     *                                        throws an errror when no signature
     *                                        is found.
     */
    function find (fn, signature) {
      if (!fn.signatures) {
        throw new TypeError('Function is no typed-function');
      }

      // normalize input
      var arr;
      if (typeof signature === 'string') {
        arr = signature.split(',');
        for (var i = 0; i < arr.length; i++) {
          arr[i] = arr[i].trim();
        }
      }
      else if (Array.isArray(signature)) {
        arr = signature;
      }
      else {
        throw new TypeError('String array or a comma separated string expected');
      }

      var str = arr.join(',');

      // find an exact match
      var match = fn.signatures[str];
      if (match) {
        return match;
      }

      // TODO: extend find to match non-exact signatures

      throw new TypeError('Signature not found (signature: ' + (fn.name || 'unnamed') + '(' + arr.join(', ') + '))');
    }

    /**
     * Convert a given value to another data type.
     * @param {*} value
     * @param {string} type
     */
    function convert (value, type) {
      var from = getTypeOf(value);

      // check conversion is needed
      if (type === from) {
        return value;
      }

      for (var i = 0; i < typed.conversions.length; i++) {
        var conversion = typed.conversions[i];
        if (conversion.from === from && conversion.to === type) {
          return conversion.convert(value);
        }
      }

      throw new Error('Cannot convert from ' + from + ' to ' + type);
    }

    // attach types and conversions to the final `typed` function
    typed.config = config;
    typed.types = types;
    typed.conversions = conversions;
    typed.ignore = ignore;
    typed.create = create;
    typed.find = find;
    typed.convert = convert;

    // add a type
    typed.addType = function (type) {
      if (!type || typeof type.name !== 'string' || typeof type.test !== 'function') {
        throw new TypeError('Object with properties {name: string, test: function} expected');
      }

      typed.types.push(type);
    };

    // add a conversion
    typed.addConversion = function (conversion) {
      if (!conversion
          || typeof conversion.from !== 'string'
          || typeof conversion.to !== 'string'
          || typeof conversion.convert !== 'function') {
        throw new TypeError('Object with properties {from: string, to: string, convert: function} expected');
      }

      typed.conversions.push(conversion);
    };

    return typed;
  }

  return create();
}));
