/*!
 * URI.js - Mutating URLs
 * URI Template Support - http://tools.ietf.org/html/rfc6570
 *
 * Version: 1.19.1
 *
 * Author: Rodney Rehm
 * Web: http://medialize.github.io/URI.js/
 *
 * Licensed under
 *   MIT License http://www.opensource.org/licenses/mit-license
 *
 */
(function (root, factory) {
  'use strict';
  // https://github.com/umdjs/umd/blob/master/returnExports.js
  if (typeof module === 'object' && module.exports) {
    // Node
    module.exports = factory(require('./URI'));
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['./URI'], factory);
  } else {
    // Browser globals (root is window)
    root.URITemplate = factory(root.URI, root);
  }
}(this, function (URI, root) {
  'use strict';
  // FIXME: v2.0.0 renamce non-camelCase properties to uppercase
  /*jshint camelcase: false */

  // save current URITemplate variable, if any
  var _URITemplate = root && root.URITemplate;

  var hasOwn = Object.prototype.hasOwnProperty;
  function URITemplate(expression) {
    // serve from cache where possible
    if (URITemplate._cache[expression]) {
      return URITemplate._cache[expression];
    }

    // Allow instantiation without the 'new' keyword
    if (!(this instanceof URITemplate)) {
      return new URITemplate(expression);
    }

    this.expression = expression;
    URITemplate._cache[expression] = this;
    return this;
  }

  function Data(data) {
    this.data = data;
    this.cache = {};
  }

  var p = URITemplate.prototype;
  // list of operators and their defined options
  var operators = {
    // Simple string expansion
    '' : {
      prefix: '',
      separator: ',',
      named: false,
      empty_name_separator: false,
      encode : 'encode'
    },
    // Reserved character strings
    '+' : {
      prefix: '',
      separator: ',',
      named: false,
      empty_name_separator: false,
      encode : 'encodeReserved'
    },
    // Fragment identifiers prefixed by '#'
    '#' : {
      prefix: '#',
      separator: ',',
      named: false,
      empty_name_separator: false,
      encode : 'encodeReserved'
    },
    // Name labels or extensions prefixed by '.'
    '.' : {
      prefix: '.',
      separator: '.',
      named: false,
      empty_name_separator: false,
      encode : 'encode'
    },
    // Path segments prefixed by '/'
    '/' : {
      prefix: '/',
      separator: '/',
      named: false,
      empty_name_separator: false,
      encode : 'encode'
    },
    // Path parameter name or name=value pairs prefixed by ';'
    ';' : {
      prefix: ';',
      separator: ';',
      named: true,
      empty_name_separator: false,
      encode : 'encode'
    },
    // Query component beginning with '?' and consisting
    // of name=value pairs separated by '&'; an
    '?' : {
      prefix: '?',
      separator: '&',
      named: true,
      empty_name_separator: true,
      encode : 'encode'
    },
    // Continuation of query-style &name=value pairs
    // within a literal query component.
    '&' : {
      prefix: '&',
      separator: '&',
      named: true,
      empty_name_separator: true,
      encode : 'encode'
    }

    // The operator characters equals ("="), comma (","), exclamation ("!"),
    // at sign ("@"), and pipe ("|") are reserved for future extensions.
  };

  // storage for already parsed templates
  URITemplate._cache = {};
  // pattern to identify expressions [operator, variable-list] in template
  URITemplate.EXPRESSION_PATTERN = /\{([^a-zA-Z0-9%_]?)([^\}]+)(\}|$)/g;
  // pattern to identify variables [name, explode, maxlength] in variable-list
  URITemplate.VARIABLE_PATTERN = /^([^*:.](?:\.?[^*:.])*)((\*)|:(\d+))?$/;
  // pattern to verify variable name integrity
  URITemplate.VARIABLE_NAME_PATTERN = /[^a-zA-Z0-9%_.]/;
  // pattern to verify literal integrity
  URITemplate.LITERAL_PATTERN = /[<>{}"`^| \\]/;

  // expand parsed expression (expression, not template!)
  URITemplate.expand = function(expression, data, opts) {
    // container for defined options for the given operator
    var options = operators[expression.operator];
    // expansion type (include keys or not)
    var type = options.named ? 'Named' : 'Unnamed';
    // list of variables within the expression
    var variables = expression.variables;
    // result buffer for evaluating the expression
    var buffer = [];
    var d, variable, i;

    for (i = 0; (variable = variables[i]); i++) {
      // fetch simplified data source
      d = data.get(variable.name);
      if (d.type === 0 && opts && opts.strict) {
          throw new Error('Missing expansion value for variable "' + variable.name + '"');
      }
      if (!d.val.length) {
        if (d.type) {
          // empty variables (empty string)
          // still lead to a separator being appended!
          buffer.push('');
        }
        // no data, no action
        continue;
      }

      if (d.type > 1 && variable.maxlength) {
        // composite variable cannot specify maxlength
        throw new Error('Invalid expression: Prefix modifier not applicable to variable "' + variable.name + '"');
      }

      // expand the given variable
      buffer.push(URITemplate['expand' + type](
        d,
        options,
        variable.explode,
        variable.explode && options.separator || ',',
        variable.maxlength,
        variable.name
      ));
    }

    if (buffer.length) {
      return options.prefix + buffer.join(options.separator);
    } else {
      // prefix is not prepended for empty expressions
      return '';
    }
  };
  // expand a named variable
  URITemplate.expandNamed = function(d, options, explode, separator, length, name) {
    // variable result buffer
    var result = '';
    // peformance crap
    var encode = options.encode;
    var empty_name_separator = options.empty_name_separator;
    // flag noting if values are already encoded
    var _encode = !d[encode].length;
    // key for named expansion
    var _name = d.type === 2 ? '': URI[encode](name);
    var _value, i, l;

    // for each found value
    for (i = 0, l = d.val.length; i < l; i++) {
      if (length) {
        // maxlength must be determined before encoding can happen
        _value = URI[encode](d.val[i][1].substring(0, length));
        if (d.type === 2) {
          // apply maxlength to keys of objects as well
          _name = URI[encode](d.val[i][0].substring(0, length));
        }
      } else if (_encode) {
        // encode value
        _value = URI[encode](d.val[i][1]);
        if (d.type === 2) {
          // encode name and cache encoded value
          _name = URI[encode](d.val[i][0]);
          d[encode].push([_name, _value]);
        } else {
          // cache encoded value
          d[encode].push([undefined, _value]);
        }
      } else {
        // values are already encoded and can be pulled from cache
        _value = d[encode][i][1];
        if (d.type === 2) {
          _name = d[encode][i][0];
        }
      }

      if (result) {
        // unless we're the first value, prepend the separator
        result += separator;
      }

      if (!explode) {
        if (!i) {
          // first element, so prepend variable name
          result += URI[encode](name) + (empty_name_separator || _value ? '=' : '');
        }

        if (d.type === 2) {
          // without explode-modifier, keys of objects are returned comma-separated
          result += _name + ',';
        }

        result += _value;
      } else {
        // only add the = if it is either default (?&) or there actually is a value (;)
        result += _name + (empty_name_separator || _value ? '=' : '') + _value;
      }
    }

    return result;
  };
  // expand an unnamed variable
  URITemplate.expandUnnamed = function(d, options, explode, separator, length) {
    // variable result buffer
    var result = '';
    // performance crap
    var encode = options.encode;
    var empty_name_separator = options.empty_name_separator;
    // flag noting if values are already encoded
    var _encode = !d[encode].length;
    var _name, _value, i, l;

    // for each found value
    for (i = 0, l = d.val.length; i < l; i++) {
      if (length) {
        // maxlength must be determined before encoding can happen
        _value = URI[encode](d.val[i][1].substring(0, length));
      } else if (_encode) {
        // encode and cache value
        _value = URI[encode](d.val[i][1]);
        d[encode].push([
          d.type === 2 ? URI[encode](d.val[i][0]) : undefined,
          _value
        ]);
      } else {
        // value already encoded, pull from cache
        _value = d[encode][i][1];
      }

      if (result) {
        // unless we're the first value, prepend the separator
        result += separator;
      }

      if (d.type === 2) {
        if (length) {
          // maxlength also applies to keys of objects
          _name = URI[encode](d.val[i][0].substring(0, length));
        } else {
          // at this point the name must already be encoded
          _name = d[encode][i][0];
        }

        result += _name;
        if (explode) {
          // explode-modifier separates name and value by "="
          result += (empty_name_separator || _value ? '=' : '');
        } else {
          // no explode-modifier separates name and value by ","
          result += ',';
        }
      }

      result += _value;
    }

    return result;
  };

  URITemplate.noConflict = function() {
    if (root.URITemplate === URITemplate) {
      root.URITemplate = _URITemplate;
    }

    return URITemplate;
  };

  // expand template through given data map
  p.expand = function(data, opts) {
    var result = '';

    if (!this.parts || !this.parts.length) {
      // lazilyy parse the template
      this.parse();
    }

    if (!(data instanceof Data)) {
      // make given data available through the
      // optimized data handling thingie
      data = new Data(data);
    }

    for (var i = 0, l = this.parts.length; i < l; i++) {
      /*jshint laxbreak: true */
      result += typeof this.parts[i] === 'string'
        // literal string
        ? this.parts[i]
        // expression
        : URITemplate.expand(this.parts[i], data, opts);
      /*jshint laxbreak: false */
    }

    return result;
  };
  // parse template into action tokens
  p.parse = function() {
    // performance crap
    var expression = this.expression;
    var ePattern = URITemplate.EXPRESSION_PATTERN;
    var vPattern = URITemplate.VARIABLE_PATTERN;
    var nPattern = URITemplate.VARIABLE_NAME_PATTERN;
    var lPattern = URITemplate.LITERAL_PATTERN;
    // token result buffer
    var parts = [];
      // position within source template
    var pos = 0;
    var variables, eMatch, vMatch;

    var checkLiteral = function(literal) {
      if (literal.match(lPattern)) {
        throw new Error('Invalid Literal "' + literal + '"');
      }
      return literal;
    };

    // RegExp is shared accross all templates,
    // which requires a manual reset
    ePattern.lastIndex = 0;
    // I don't like while(foo = bar()) loops,
    // to make things simpler I go while(true) and break when required
    while (true) {
      eMatch = ePattern.exec(expression);
      if (eMatch === null) {
        // push trailing literal
        parts.push(checkLiteral(expression.substring(pos)));
        break;
      } else {
        // push leading literal
        parts.push(checkLiteral(expression.substring(pos, eMatch.index)));
        pos = eMatch.index + eMatch[0].length;
      }

      if (!operators[eMatch[1]]) {
        throw new Error('Unknown Operator "' + eMatch[1]  + '" in "' + eMatch[0] + '"');
      } else if (!eMatch[3]) {
        throw new Error('Unclosed Expression "' + eMatch[0]  + '"');
      }

      // parse variable-list
      variables = eMatch[2].split(',');
      for (var i = 0, l = variables.length; i < l; i++) {
        vMatch = variables[i].match(vPattern);
        if (vMatch === null) {
          throw new Error('Invalid Variable "' + variables[i] + '" in "' + eMatch[0] + '"');
        } else if (vMatch[1].match(nPattern)) {
          throw new Error('Invalid Variable Name "' + vMatch[1] + '" in "' + eMatch[0] + '"');
        }

        variables[i] = {
          name: vMatch[1],
          explode: !!vMatch[3],
          maxlength: vMatch[4] && parseInt(vMatch[4], 10)
        };
      }

      if (!variables.length) {
        throw new Error('Expression Missing Variable(s) "' + eMatch[0] + '"');
      }

      parts.push({
        expression: eMatch[0],
        operator: eMatch[1],
        variables: variables
      });
    }

    if (!parts.length) {
      // template doesn't contain any expressions
      // so it is a simple literal string
      // this probably should fire a warning or something?
      parts.push(checkLiteral(expression));
    }

    this.parts = parts;
    return this;
  };

  // simplify data structures
  Data.prototype.get = function(key) {
    // performance crap
    var data = this.data;
    // cache for processed data-point
    var d = {
      // type of data 0: undefined/null, 1: string, 2: object, 3: array
      type: 0,
      // original values (except undefined/null)
      val: [],
      // cache for encoded values (only for non-maxlength expansion)
      encode: [],
      encodeReserved: []
    };
    var i, l, value;

    if (this.cache[key] !== undefined) {
      // we've already processed this key
      return this.cache[key];
    }

    this.cache[key] = d;

    if (String(Object.prototype.toString.call(data)) === '[object Function]') {
      // data itself is a callback (global callback)
      value = data(key);
    } else if (String(Object.prototype.toString.call(data[key])) === '[object Function]') {
      // data is a map of callbacks (local callback)
      value = data[key](key);
    } else {
      // data is a map of data
      value = data[key];
    }

    // generalize input into [ [name1, value1], [name2, value2], … ]
    // so expansion has to deal with a single data structure only
    if (value === undefined || value === null) {
      // undefined and null values are to be ignored completely
      return d;
    } else if (String(Object.prototype.toString.call(value)) === '[object Array]') {
      for (i = 0, l = value.length; i < l; i++) {
        if (value[i] !== undefined && value[i] !== null) {
          // arrays don't have names
          d.val.push([undefined, String(value[i])]);
        }
      }

      if (d.val.length) {
        // only treat non-empty arrays as arrays
        d.type = 3; // array
      }
    } else if (String(Object.prototype.toString.call(value)) === '[object Object]') {
      for (i in value) {
        if (hasOwn.call(value, i) && value[i] !== undefined && value[i] !== null) {
          // objects have keys, remember them for named expansion
          d.val.push([i, String(value[i])]);
        }
      }

      if (d.val.length) {
        // only treat non-empty objects as objects
        d.type = 2; // object
      }
    } else {
      d.type = 1; // primitive string (could've been string, number, boolean and objects with a toString())
      // arrays don't have names
      d.val.push([undefined, String(value)]);
    }

    return d;
  };

  // hook into URI for fluid access
  URI.expand = function(expression, data) {
    var template = new URITemplate(expression);
    var expansion = template.expand(data);

    return new URI(expansion);
  };

  return URITemplate;
}));
