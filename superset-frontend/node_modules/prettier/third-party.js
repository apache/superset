'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var os = _interopDefault(require('os'));
var path = _interopDefault(require('path'));
var module$1 = _interopDefault(require('module'));
var fs = _interopDefault(require('fs'));
var util = _interopDefault(require('util'));
var stream = _interopDefault(require('stream'));

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

function getCjsExportFromNamespace (n) {
	return n && n['default'] || n;
}

const resolveFrom = (fromDir, moduleId, silent) => {
  if (typeof fromDir !== 'string') {
    throw new TypeError(`Expected \`fromDir\` to be of type \`string\`, got \`${typeof fromDir}\``);
  }

  if (typeof moduleId !== 'string') {
    throw new TypeError(`Expected \`moduleId\` to be of type \`string\`, got \`${typeof moduleId}\``);
  }

  try {
    fromDir = fs.realpathSync(fromDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      fromDir = path.resolve(fromDir);
    } else if (silent) {
      return null;
    } else {
      throw err;
    }
  }

  const fromFile = path.join(fromDir, 'noop.js');

  const resolveFileName = () => module$1._resolveFilename(moduleId, {
    id: fromFile,
    filename: fromFile,
    paths: module$1._nodeModulePaths(fromDir)
  });

  if (silent) {
    try {
      return resolveFileName();
    } catch (err) {
      return null;
    }
  }

  return resolveFileName();
};

var resolveFrom_1 = (fromDir, moduleId) => resolveFrom(fromDir, moduleId);

var silent = (fromDir, moduleId) => resolveFrom(fromDir, moduleId, true);
resolveFrom_1.silent = silent;

var importFresh = moduleId => {
  if (typeof moduleId !== 'string') {
    throw new TypeError('Expected a string');
  }

  const parentPath = __filename;
  const filePath = resolveFrom_1(path.dirname(parentPath), moduleId);
  const oldModule = eval('require').cache[filePath]; // Delete itself from module parent

  if (oldModule && oldModule.parent) {
    let i = oldModule.parent.children.length;

    while (i--) {
      if (oldModule.parent.children[i].id === filePath) {
        oldModule.parent.children.splice(i, 1);
      }
    }
  }

  delete eval('require').cache[filePath]; // Delete module from cache

  const parent = eval('require').cache[parentPath]; // If `filePath` and `parentPath` are the same, cache will already be deleted so we won't get a memory leak in next step

  return parent === undefined ? eval('require')(filePath) : parent.require(filePath); // In case cache doesn't have parent, fall back to normal require
};

var isArrayish = function isArrayish(obj) {
  if (!obj) {
    return false;
  }

  return obj instanceof Array || Array.isArray(obj) || obj.length >= 0 && obj.splice instanceof Function;
};

var errorEx = function errorEx(name, properties) {
  if (!name || name.constructor !== String) {
    properties = name || {};
    name = Error.name;
  }

  var errorExError = function ErrorEXError(message) {
    if (!this) {
      return new ErrorEXError(message);
    }

    message = message instanceof Error ? message.message : message || this.message;
    Error.call(this, message);
    Error.captureStackTrace(this, errorExError);
    this.name = name;
    Object.defineProperty(this, 'message', {
      configurable: true,
      enumerable: false,
      get: function () {
        var newMessage = message.split(/\r?\n/g);

        for (var key in properties) {
          if (!properties.hasOwnProperty(key)) {
            continue;
          }

          var modifier = properties[key];

          if ('message' in modifier) {
            newMessage = modifier.message(this[key], newMessage) || newMessage;

            if (!isArrayish(newMessage)) {
              newMessage = [newMessage];
            }
          }
        }

        return newMessage.join('\n');
      },
      set: function (v) {
        message = v;
      }
    });
    var overwrittenStack = null;
    var stackDescriptor = Object.getOwnPropertyDescriptor(this, 'stack');
    var stackGetter = stackDescriptor.get;
    var stackValue = stackDescriptor.value;
    delete stackDescriptor.value;
    delete stackDescriptor.writable;

    stackDescriptor.set = function (newstack) {
      overwrittenStack = newstack;
    };

    stackDescriptor.get = function () {
      var stack = (overwrittenStack || (stackGetter ? stackGetter.call(this) : stackValue)).split(/\r?\n+/g); // starting in Node 7, the stack builder caches the message.
      // just replace it.

      if (!overwrittenStack) {
        stack[0] = this.name + ': ' + this.message;
      }

      var lineCount = 1;

      for (var key in properties) {
        if (!properties.hasOwnProperty(key)) {
          continue;
        }

        var modifier = properties[key];

        if ('line' in modifier) {
          var line = modifier.line(this[key]);

          if (line) {
            stack.splice(lineCount++, 0, '    ' + line);
          }
        }

        if ('stack' in modifier) {
          modifier.stack(this[key], stack);
        }
      }

      return stack.join('\n');
    };

    Object.defineProperty(this, 'stack', stackDescriptor);
  };

  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(errorExError.prototype, Error.prototype);
    Object.setPrototypeOf(errorExError, Error);
  } else {
    util.inherits(errorExError, Error);
  }

  return errorExError;
};

errorEx.append = function (str, def) {
  return {
    message: function (v, message) {
      v = v || def;

      if (v) {
        message[0] += ' ' + str.replace('%s', v.toString());
      }

      return message;
    }
  };
};

errorEx.line = function (str, def) {
  return {
    line: function (v) {
      v = v || def;

      if (v) {
        return str.replace('%s', v.toString());
      }

      return null;
    }
  };
};

var errorEx_1 = errorEx;

var jsonParseBetterErrors = parseJson;

function parseJson(txt, reviver, context) {
  context = context || 20;

  try {
    return JSON.parse(txt, reviver);
  } catch (e) {
    if (typeof txt !== 'string') {
      const isEmptyArray = Array.isArray(txt) && txt.length === 0;
      const errorMessage = 'Cannot parse ' + (isEmptyArray ? 'an empty array' : String(txt));
      throw new TypeError(errorMessage);
    }

    const syntaxErr = e.message.match(/^Unexpected token.*position\s+(\d+)/i);
    const errIdx = syntaxErr ? +syntaxErr[1] : e.message.match(/^Unexpected end of JSON.*/i) ? txt.length - 1 : null;

    if (errIdx != null) {
      const start = errIdx <= context ? 0 : errIdx - context;
      const end = errIdx + context >= txt.length ? txt.length : errIdx + context;
      e.message += ` while parsing near '${start === 0 ? '' : '...'}${txt.slice(start, end)}${end === txt.length ? '' : '...'}'`;
    } else {
      e.message += ` while parsing '${txt.slice(0, context * 2)}'`;
    }

    throw e;
  }
}

var LF = '\n';
var CR = '\r';

var LinesAndColumns = function () {
  function LinesAndColumns(string) {
    this.string = string;
    var offsets = [0];

    for (var offset = 0; offset < string.length;) {
      switch (string[offset]) {
        case LF:
          offset += LF.length;
          offsets.push(offset);
          break;

        case CR:
          offset += CR.length;

          if (string[offset] === LF) {
            offset += LF.length;
          }

          offsets.push(offset);
          break;

        default:
          offset++;
          break;
      }
    }

    this.offsets = offsets;
  }

  LinesAndColumns.prototype.locationForIndex = function (index) {
    if (index < 0 || index > this.string.length) {
      return null;
    }

    var line = 0;
    var offsets = this.offsets;

    while (offsets[line + 1] <= index) {
      line++;
    }

    var column = index - offsets[line];
    return {
      line: line,
      column: column
    };
  };

  LinesAndColumns.prototype.indexForLocation = function (location) {
    var line = location.line,
        column = location.column;

    if (line < 0 || line >= this.offsets.length) {
      return null;
    }

    if (column < 0 || column > this.lengthOfLine(line)) {
      return null;
    }

    return this.offsets[line] + column;
  };

  LinesAndColumns.prototype.lengthOfLine = function (line) {
    var offset = this.offsets[line];
    var nextOffset = line === this.offsets.length - 1 ? this.string.length : this.offsets[line + 1];
    return nextOffset - offset;
  };

  return LinesAndColumns;
}();

var dist = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': LinesAndColumns
});

var jsTokens = createCommonjsModule(function (module, exports) {
  // Copyright 2014, 2015, 2016, 2017, 2018 Simon Lydell
  // License: MIT. (See LICENSE.)
  Object.defineProperty(exports, "__esModule", {
    value: true
  }); // This regex comes from regex.coffee, and is inserted here by generate-index.js
  // (run `npm run build`).

  exports.default = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyus]{1,6}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|(0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-\/%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2})=?|[?~.,:;[\](){}])|(\s+)|(^$|[\s\S])/g;

  exports.matchToToken = function (match) {
    var token = {
      type: "invalid",
      value: match[0],
      closed: undefined
    };
    if (match[1]) token.type = "string", token.closed = !!(match[3] || match[4]);else if (match[5]) token.type = "comment";else if (match[6]) token.type = "comment", token.closed = !!match[7];else if (match[8]) token.type = "regex";else if (match[9]) token.type = "number";else if (match[10]) token.type = "name";else if (match[11]) token.type = "punctuator";else if (match[12]) token.type = "whitespace";
    return token;
  };
});
unwrapExports(jsTokens);
var jsTokens_1 = jsTokens.matchToToken;

var ast = createCommonjsModule(function (module) {
  /*
    Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
  
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
  
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
    ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
    DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
    (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
    ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
    THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
  (function () {

    function isExpression(node) {
      if (node == null) {
        return false;
      }

      switch (node.type) {
        case 'ArrayExpression':
        case 'AssignmentExpression':
        case 'BinaryExpression':
        case 'CallExpression':
        case 'ConditionalExpression':
        case 'FunctionExpression':
        case 'Identifier':
        case 'Literal':
        case 'LogicalExpression':
        case 'MemberExpression':
        case 'NewExpression':
        case 'ObjectExpression':
        case 'SequenceExpression':
        case 'ThisExpression':
        case 'UnaryExpression':
        case 'UpdateExpression':
          return true;
      }

      return false;
    }

    function isIterationStatement(node) {
      if (node == null) {
        return false;
      }

      switch (node.type) {
        case 'DoWhileStatement':
        case 'ForInStatement':
        case 'ForStatement':
        case 'WhileStatement':
          return true;
      }

      return false;
    }

    function isStatement(node) {
      if (node == null) {
        return false;
      }

      switch (node.type) {
        case 'BlockStatement':
        case 'BreakStatement':
        case 'ContinueStatement':
        case 'DebuggerStatement':
        case 'DoWhileStatement':
        case 'EmptyStatement':
        case 'ExpressionStatement':
        case 'ForInStatement':
        case 'ForStatement':
        case 'IfStatement':
        case 'LabeledStatement':
        case 'ReturnStatement':
        case 'SwitchStatement':
        case 'ThrowStatement':
        case 'TryStatement':
        case 'VariableDeclaration':
        case 'WhileStatement':
        case 'WithStatement':
          return true;
      }

      return false;
    }

    function isSourceElement(node) {
      return isStatement(node) || node != null && node.type === 'FunctionDeclaration';
    }

    function trailingStatement(node) {
      switch (node.type) {
        case 'IfStatement':
          if (node.alternate != null) {
            return node.alternate;
          }

          return node.consequent;

        case 'LabeledStatement':
        case 'ForStatement':
        case 'ForInStatement':
        case 'WhileStatement':
        case 'WithStatement':
          return node.body;
      }

      return null;
    }

    function isProblematicIfStatement(node) {
      var current;

      if (node.type !== 'IfStatement') {
        return false;
      }

      if (node.alternate == null) {
        return false;
      }

      current = node.consequent;

      do {
        if (current.type === 'IfStatement') {
          if (current.alternate == null) {
            return true;
          }
        }

        current = trailingStatement(current);
      } while (current);

      return false;
    }

    module.exports = {
      isExpression: isExpression,
      isStatement: isStatement,
      isIterationStatement: isIterationStatement,
      isSourceElement: isSourceElement,
      isProblematicIfStatement: isProblematicIfStatement,
      trailingStatement: trailingStatement
    };
  })();
  /* vim: set sw=4 ts=4 et tw=80 : */

});
var ast_1 = ast.isExpression;
var ast_2 = ast.isStatement;
var ast_3 = ast.isIterationStatement;
var ast_4 = ast.isSourceElement;
var ast_5 = ast.isProblematicIfStatement;
var ast_6 = ast.trailingStatement;

var code = createCommonjsModule(function (module) {
  /*
    Copyright (C) 2013-2014 Yusuke Suzuki <utatane.tea@gmail.com>
    Copyright (C) 2014 Ivan Nikulin <ifaaan@gmail.com>
  
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
  
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
    ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
    DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
    (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
    ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
    THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
  (function () {

    var ES6Regex, ES5Regex, NON_ASCII_WHITESPACES, IDENTIFIER_START, IDENTIFIER_PART, ch; // See `tools/generate-identifier-regex.js`.

    ES5Regex = {
      // ECMAScript 5.1/Unicode v9.0.0 NonAsciiIdentifierStart:
      NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
      // ECMAScript 5.1/Unicode v9.0.0 NonAsciiIdentifierPart:
      NonAsciiIdentifierPart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/
    };
    ES6Regex = {
      // ECMAScript 6/Unicode v9.0.0 NonAsciiIdentifierStart:
      NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]/,
      // ECMAScript 6/Unicode v9.0.0 NonAsciiIdentifierPart:
      NonAsciiIdentifierPart: /[\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/
    };

    function isDecimalDigit(ch) {
      return 0x30 <= ch && ch <= 0x39; // 0..9
    }

    function isHexDigit(ch) {
      return 0x30 <= ch && ch <= 0x39 || // 0..9
      0x61 <= ch && ch <= 0x66 || // a..f
      0x41 <= ch && ch <= 0x46; // A..F
    }

    function isOctalDigit(ch) {
      return ch >= 0x30 && ch <= 0x37; // 0..7
    } // 7.2 White Space


    NON_ASCII_WHITESPACES = [0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF];

    function isWhiteSpace(ch) {
      return ch === 0x20 || ch === 0x09 || ch === 0x0B || ch === 0x0C || ch === 0xA0 || ch >= 0x1680 && NON_ASCII_WHITESPACES.indexOf(ch) >= 0;
    } // 7.3 Line Terminators


    function isLineTerminator(ch) {
      return ch === 0x0A || ch === 0x0D || ch === 0x2028 || ch === 0x2029;
    } // 7.6 Identifier Names and Identifiers


    function fromCodePoint(cp) {
      if (cp <= 0xFFFF) {
        return String.fromCharCode(cp);
      }

      var cu1 = String.fromCharCode(Math.floor((cp - 0x10000) / 0x400) + 0xD800);
      var cu2 = String.fromCharCode((cp - 0x10000) % 0x400 + 0xDC00);
      return cu1 + cu2;
    }

    IDENTIFIER_START = new Array(0x80);

    for (ch = 0; ch < 0x80; ++ch) {
      IDENTIFIER_START[ch] = ch >= 0x61 && ch <= 0x7A || // a..z
      ch >= 0x41 && ch <= 0x5A || // A..Z
      ch === 0x24 || ch === 0x5F; // $ (dollar) and _ (underscore)
    }

    IDENTIFIER_PART = new Array(0x80);

    for (ch = 0; ch < 0x80; ++ch) {
      IDENTIFIER_PART[ch] = ch >= 0x61 && ch <= 0x7A || // a..z
      ch >= 0x41 && ch <= 0x5A || // A..Z
      ch >= 0x30 && ch <= 0x39 || // 0..9
      ch === 0x24 || ch === 0x5F; // $ (dollar) and _ (underscore)
    }

    function isIdentifierStartES5(ch) {
      return ch < 0x80 ? IDENTIFIER_START[ch] : ES5Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch));
    }

    function isIdentifierPartES5(ch) {
      return ch < 0x80 ? IDENTIFIER_PART[ch] : ES5Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch));
    }

    function isIdentifierStartES6(ch) {
      return ch < 0x80 ? IDENTIFIER_START[ch] : ES6Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch));
    }

    function isIdentifierPartES6(ch) {
      return ch < 0x80 ? IDENTIFIER_PART[ch] : ES6Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch));
    }

    module.exports = {
      isDecimalDigit: isDecimalDigit,
      isHexDigit: isHexDigit,
      isOctalDigit: isOctalDigit,
      isWhiteSpace: isWhiteSpace,
      isLineTerminator: isLineTerminator,
      isIdentifierStartES5: isIdentifierStartES5,
      isIdentifierPartES5: isIdentifierPartES5,
      isIdentifierStartES6: isIdentifierStartES6,
      isIdentifierPartES6: isIdentifierPartES6
    };
  })();
  /* vim: set sw=4 ts=4 et tw=80 : */

});
var code_1 = code.isDecimalDigit;
var code_2 = code.isHexDigit;
var code_3 = code.isOctalDigit;
var code_4 = code.isWhiteSpace;
var code_5 = code.isLineTerminator;
var code_6 = code.isIdentifierStartES5;
var code_7 = code.isIdentifierPartES5;
var code_8 = code.isIdentifierStartES6;
var code_9 = code.isIdentifierPartES6;

var keyword = createCommonjsModule(function (module) {
  /*
    Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
  
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
  
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
    ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
    DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
    (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
    ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
    THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
  (function () {

    var code$1 = code;

    function isStrictModeReservedWordES6(id) {
      switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'let':
          return true;

        default:
          return false;
      }
    }

    function isKeywordES5(id, strict) {
      // yield should not be treated as keyword under non-strict mode.
      if (!strict && id === 'yield') {
        return false;
      }

      return isKeywordES6(id, strict);
    }

    function isKeywordES6(id, strict) {
      if (strict && isStrictModeReservedWordES6(id)) {
        return true;
      }

      switch (id.length) {
        case 2:
          return id === 'if' || id === 'in' || id === 'do';

        case 3:
          return id === 'var' || id === 'for' || id === 'new' || id === 'try';

        case 4:
          return id === 'this' || id === 'else' || id === 'case' || id === 'void' || id === 'with' || id === 'enum';

        case 5:
          return id === 'while' || id === 'break' || id === 'catch' || id === 'throw' || id === 'const' || id === 'yield' || id === 'class' || id === 'super';

        case 6:
          return id === 'return' || id === 'typeof' || id === 'delete' || id === 'switch' || id === 'export' || id === 'import';

        case 7:
          return id === 'default' || id === 'finally' || id === 'extends';

        case 8:
          return id === 'function' || id === 'continue' || id === 'debugger';

        case 10:
          return id === 'instanceof';

        default:
          return false;
      }
    }

    function isReservedWordES5(id, strict) {
      return id === 'null' || id === 'true' || id === 'false' || isKeywordES5(id, strict);
    }

    function isReservedWordES6(id, strict) {
      return id === 'null' || id === 'true' || id === 'false' || isKeywordES6(id, strict);
    }

    function isRestrictedWord(id) {
      return id === 'eval' || id === 'arguments';
    }

    function isIdentifierNameES5(id) {
      var i, iz, ch;

      if (id.length === 0) {
        return false;
      }

      ch = id.charCodeAt(0);

      if (!code$1.isIdentifierStartES5(ch)) {
        return false;
      }

      for (i = 1, iz = id.length; i < iz; ++i) {
        ch = id.charCodeAt(i);

        if (!code$1.isIdentifierPartES5(ch)) {
          return false;
        }
      }

      return true;
    }

    function decodeUtf16(lead, trail) {
      return (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;
    }

    function isIdentifierNameES6(id) {
      var i, iz, ch, lowCh, check;

      if (id.length === 0) {
        return false;
      }

      check = code$1.isIdentifierStartES6;

      for (i = 0, iz = id.length; i < iz; ++i) {
        ch = id.charCodeAt(i);

        if (0xD800 <= ch && ch <= 0xDBFF) {
          ++i;

          if (i >= iz) {
            return false;
          }

          lowCh = id.charCodeAt(i);

          if (!(0xDC00 <= lowCh && lowCh <= 0xDFFF)) {
            return false;
          }

          ch = decodeUtf16(ch, lowCh);
        }

        if (!check(ch)) {
          return false;
        }

        check = code$1.isIdentifierPartES6;
      }

      return true;
    }

    function isIdentifierES5(id, strict) {
      return isIdentifierNameES5(id) && !isReservedWordES5(id, strict);
    }

    function isIdentifierES6(id, strict) {
      return isIdentifierNameES6(id) && !isReservedWordES6(id, strict);
    }

    module.exports = {
      isKeywordES5: isKeywordES5,
      isKeywordES6: isKeywordES6,
      isReservedWordES5: isReservedWordES5,
      isReservedWordES6: isReservedWordES6,
      isRestrictedWord: isRestrictedWord,
      isIdentifierNameES5: isIdentifierNameES5,
      isIdentifierNameES6: isIdentifierNameES6,
      isIdentifierES5: isIdentifierES5,
      isIdentifierES6: isIdentifierES6
    };
  })();
  /* vim: set sw=4 ts=4 et tw=80 : */

});
var keyword_1 = keyword.isKeywordES5;
var keyword_2 = keyword.isKeywordES6;
var keyword_3 = keyword.isReservedWordES5;
var keyword_4 = keyword.isReservedWordES6;
var keyword_5 = keyword.isRestrictedWord;
var keyword_6 = keyword.isIdentifierNameES5;
var keyword_7 = keyword.isIdentifierNameES6;
var keyword_8 = keyword.isIdentifierES5;
var keyword_9 = keyword.isIdentifierES6;

var utils = createCommonjsModule(function (module, exports) {
  /*
    Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
  
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
  
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
    ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
    DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
    (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
    ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
    THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
  (function () {

    exports.ast = ast;
    exports.code = code;
    exports.keyword = keyword;
  })();
  /* vim: set sw=4 ts=4 et tw=80 : */

});
var utils_1 = utils.ast;
var utils_2 = utils.code;
var utils_3 = utils.keyword;

var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

var escapeStringRegexp = function (str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  return str.replace(matchOperatorsRe, '\\$&');
};

var colorName = {
  "aliceblue": [240, 248, 255],
  "antiquewhite": [250, 235, 215],
  "aqua": [0, 255, 255],
  "aquamarine": [127, 255, 212],
  "azure": [240, 255, 255],
  "beige": [245, 245, 220],
  "bisque": [255, 228, 196],
  "black": [0, 0, 0],
  "blanchedalmond": [255, 235, 205],
  "blue": [0, 0, 255],
  "blueviolet": [138, 43, 226],
  "brown": [165, 42, 42],
  "burlywood": [222, 184, 135],
  "cadetblue": [95, 158, 160],
  "chartreuse": [127, 255, 0],
  "chocolate": [210, 105, 30],
  "coral": [255, 127, 80],
  "cornflowerblue": [100, 149, 237],
  "cornsilk": [255, 248, 220],
  "crimson": [220, 20, 60],
  "cyan": [0, 255, 255],
  "darkblue": [0, 0, 139],
  "darkcyan": [0, 139, 139],
  "darkgoldenrod": [184, 134, 11],
  "darkgray": [169, 169, 169],
  "darkgreen": [0, 100, 0],
  "darkgrey": [169, 169, 169],
  "darkkhaki": [189, 183, 107],
  "darkmagenta": [139, 0, 139],
  "darkolivegreen": [85, 107, 47],
  "darkorange": [255, 140, 0],
  "darkorchid": [153, 50, 204],
  "darkred": [139, 0, 0],
  "darksalmon": [233, 150, 122],
  "darkseagreen": [143, 188, 143],
  "darkslateblue": [72, 61, 139],
  "darkslategray": [47, 79, 79],
  "darkslategrey": [47, 79, 79],
  "darkturquoise": [0, 206, 209],
  "darkviolet": [148, 0, 211],
  "deeppink": [255, 20, 147],
  "deepskyblue": [0, 191, 255],
  "dimgray": [105, 105, 105],
  "dimgrey": [105, 105, 105],
  "dodgerblue": [30, 144, 255],
  "firebrick": [178, 34, 34],
  "floralwhite": [255, 250, 240],
  "forestgreen": [34, 139, 34],
  "fuchsia": [255, 0, 255],
  "gainsboro": [220, 220, 220],
  "ghostwhite": [248, 248, 255],
  "gold": [255, 215, 0],
  "goldenrod": [218, 165, 32],
  "gray": [128, 128, 128],
  "green": [0, 128, 0],
  "greenyellow": [173, 255, 47],
  "grey": [128, 128, 128],
  "honeydew": [240, 255, 240],
  "hotpink": [255, 105, 180],
  "indianred": [205, 92, 92],
  "indigo": [75, 0, 130],
  "ivory": [255, 255, 240],
  "khaki": [240, 230, 140],
  "lavender": [230, 230, 250],
  "lavenderblush": [255, 240, 245],
  "lawngreen": [124, 252, 0],
  "lemonchiffon": [255, 250, 205],
  "lightblue": [173, 216, 230],
  "lightcoral": [240, 128, 128],
  "lightcyan": [224, 255, 255],
  "lightgoldenrodyellow": [250, 250, 210],
  "lightgray": [211, 211, 211],
  "lightgreen": [144, 238, 144],
  "lightgrey": [211, 211, 211],
  "lightpink": [255, 182, 193],
  "lightsalmon": [255, 160, 122],
  "lightseagreen": [32, 178, 170],
  "lightskyblue": [135, 206, 250],
  "lightslategray": [119, 136, 153],
  "lightslategrey": [119, 136, 153],
  "lightsteelblue": [176, 196, 222],
  "lightyellow": [255, 255, 224],
  "lime": [0, 255, 0],
  "limegreen": [50, 205, 50],
  "linen": [250, 240, 230],
  "magenta": [255, 0, 255],
  "maroon": [128, 0, 0],
  "mediumaquamarine": [102, 205, 170],
  "mediumblue": [0, 0, 205],
  "mediumorchid": [186, 85, 211],
  "mediumpurple": [147, 112, 219],
  "mediumseagreen": [60, 179, 113],
  "mediumslateblue": [123, 104, 238],
  "mediumspringgreen": [0, 250, 154],
  "mediumturquoise": [72, 209, 204],
  "mediumvioletred": [199, 21, 133],
  "midnightblue": [25, 25, 112],
  "mintcream": [245, 255, 250],
  "mistyrose": [255, 228, 225],
  "moccasin": [255, 228, 181],
  "navajowhite": [255, 222, 173],
  "navy": [0, 0, 128],
  "oldlace": [253, 245, 230],
  "olive": [128, 128, 0],
  "olivedrab": [107, 142, 35],
  "orange": [255, 165, 0],
  "orangered": [255, 69, 0],
  "orchid": [218, 112, 214],
  "palegoldenrod": [238, 232, 170],
  "palegreen": [152, 251, 152],
  "paleturquoise": [175, 238, 238],
  "palevioletred": [219, 112, 147],
  "papayawhip": [255, 239, 213],
  "peachpuff": [255, 218, 185],
  "peru": [205, 133, 63],
  "pink": [255, 192, 203],
  "plum": [221, 160, 221],
  "powderblue": [176, 224, 230],
  "purple": [128, 0, 128],
  "rebeccapurple": [102, 51, 153],
  "red": [255, 0, 0],
  "rosybrown": [188, 143, 143],
  "royalblue": [65, 105, 225],
  "saddlebrown": [139, 69, 19],
  "salmon": [250, 128, 114],
  "sandybrown": [244, 164, 96],
  "seagreen": [46, 139, 87],
  "seashell": [255, 245, 238],
  "sienna": [160, 82, 45],
  "silver": [192, 192, 192],
  "skyblue": [135, 206, 235],
  "slateblue": [106, 90, 205],
  "slategray": [112, 128, 144],
  "slategrey": [112, 128, 144],
  "snow": [255, 250, 250],
  "springgreen": [0, 255, 127],
  "steelblue": [70, 130, 180],
  "tan": [210, 180, 140],
  "teal": [0, 128, 128],
  "thistle": [216, 191, 216],
  "tomato": [255, 99, 71],
  "turquoise": [64, 224, 208],
  "violet": [238, 130, 238],
  "wheat": [245, 222, 179],
  "white": [255, 255, 255],
  "whitesmoke": [245, 245, 245],
  "yellow": [255, 255, 0],
  "yellowgreen": [154, 205, 50]
};

var conversions = createCommonjsModule(function (module) {
  /* MIT license */
  // NOTE: conversions should only return primitive values (i.e. arrays, or
  //       values that give correct `typeof` results).
  //       do not use box values types (i.e. Number(), String(), etc.)
  var reverseKeywords = {};

  for (var key in colorName) {
    if (colorName.hasOwnProperty(key)) {
      reverseKeywords[colorName[key]] = key;
    }
  }

  var convert = module.exports = {
    rgb: {
      channels: 3,
      labels: 'rgb'
    },
    hsl: {
      channels: 3,
      labels: 'hsl'
    },
    hsv: {
      channels: 3,
      labels: 'hsv'
    },
    hwb: {
      channels: 3,
      labels: 'hwb'
    },
    cmyk: {
      channels: 4,
      labels: 'cmyk'
    },
    xyz: {
      channels: 3,
      labels: 'xyz'
    },
    lab: {
      channels: 3,
      labels: 'lab'
    },
    lch: {
      channels: 3,
      labels: 'lch'
    },
    hex: {
      channels: 1,
      labels: ['hex']
    },
    keyword: {
      channels: 1,
      labels: ['keyword']
    },
    ansi16: {
      channels: 1,
      labels: ['ansi16']
    },
    ansi256: {
      channels: 1,
      labels: ['ansi256']
    },
    hcg: {
      channels: 3,
      labels: ['h', 'c', 'g']
    },
    apple: {
      channels: 3,
      labels: ['r16', 'g16', 'b16']
    },
    gray: {
      channels: 1,
      labels: ['gray']
    }
  }; // hide .channels and .labels properties

  for (var model in convert) {
    if (convert.hasOwnProperty(model)) {
      if (!('channels' in convert[model])) {
        throw new Error('missing channels property: ' + model);
      }

      if (!('labels' in convert[model])) {
        throw new Error('missing channel labels property: ' + model);
      }

      if (convert[model].labels.length !== convert[model].channels) {
        throw new Error('channel and label counts mismatch: ' + model);
      }

      var channels = convert[model].channels;
      var labels = convert[model].labels;
      delete convert[model].channels;
      delete convert[model].labels;
      Object.defineProperty(convert[model], 'channels', {
        value: channels
      });
      Object.defineProperty(convert[model], 'labels', {
        value: labels
      });
    }
  }

  convert.rgb.hsl = function (rgb) {
    var r = rgb[0] / 255;
    var g = rgb[1] / 255;
    var b = rgb[2] / 255;
    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);
    var delta = max - min;
    var h;
    var s;
    var l;

    if (max === min) {
      h = 0;
    } else if (r === max) {
      h = (g - b) / delta;
    } else if (g === max) {
      h = 2 + (b - r) / delta;
    } else if (b === max) {
      h = 4 + (r - g) / delta;
    }

    h = Math.min(h * 60, 360);

    if (h < 0) {
      h += 360;
    }

    l = (min + max) / 2;

    if (max === min) {
      s = 0;
    } else if (l <= 0.5) {
      s = delta / (max + min);
    } else {
      s = delta / (2 - max - min);
    }

    return [h, s * 100, l * 100];
  };

  convert.rgb.hsv = function (rgb) {
    var rdif;
    var gdif;
    var bdif;
    var h;
    var s;
    var r = rgb[0] / 255;
    var g = rgb[1] / 255;
    var b = rgb[2] / 255;
    var v = Math.max(r, g, b);
    var diff = v - Math.min(r, g, b);

    var diffc = function (c) {
      return (v - c) / 6 / diff + 1 / 2;
    };

    if (diff === 0) {
      h = s = 0;
    } else {
      s = diff / v;
      rdif = diffc(r);
      gdif = diffc(g);
      bdif = diffc(b);

      if (r === v) {
        h = bdif - gdif;
      } else if (g === v) {
        h = 1 / 3 + rdif - bdif;
      } else if (b === v) {
        h = 2 / 3 + gdif - rdif;
      }

      if (h < 0) {
        h += 1;
      } else if (h > 1) {
        h -= 1;
      }
    }

    return [h * 360, s * 100, v * 100];
  };

  convert.rgb.hwb = function (rgb) {
    var r = rgb[0];
    var g = rgb[1];
    var b = rgb[2];
    var h = convert.rgb.hsl(rgb)[0];
    var w = 1 / 255 * Math.min(r, Math.min(g, b));
    b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));
    return [h, w * 100, b * 100];
  };

  convert.rgb.cmyk = function (rgb) {
    var r = rgb[0] / 255;
    var g = rgb[1] / 255;
    var b = rgb[2] / 255;
    var c;
    var m;
    var y;
    var k;
    k = Math.min(1 - r, 1 - g, 1 - b);
    c = (1 - r - k) / (1 - k) || 0;
    m = (1 - g - k) / (1 - k) || 0;
    y = (1 - b - k) / (1 - k) || 0;
    return [c * 100, m * 100, y * 100, k * 100];
  };
  /**
   * See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
   * */


  function comparativeDistance(x, y) {
    return Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2);
  }

  convert.rgb.keyword = function (rgb) {
    var reversed = reverseKeywords[rgb];

    if (reversed) {
      return reversed;
    }

    var currentClosestDistance = Infinity;
    var currentClosestKeyword;

    for (var keyword in colorName) {
      if (colorName.hasOwnProperty(keyword)) {
        var value = colorName[keyword]; // Compute comparative distance

        var distance = comparativeDistance(rgb, value); // Check if its less, if so set as closest

        if (distance < currentClosestDistance) {
          currentClosestDistance = distance;
          currentClosestKeyword = keyword;
        }
      }
    }

    return currentClosestKeyword;
  };

  convert.keyword.rgb = function (keyword) {
    return colorName[keyword];
  };

  convert.rgb.xyz = function (rgb) {
    var r = rgb[0] / 255;
    var g = rgb[1] / 255;
    var b = rgb[2] / 255; // assume sRGB

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    var x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    var y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    var z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    return [x * 100, y * 100, z * 100];
  };

  convert.rgb.lab = function (rgb) {
    var xyz = convert.rgb.xyz(rgb);
    var x = xyz[0];
    var y = xyz[1];
    var z = xyz[2];
    var l;
    var a;
    var b;
    x /= 95.047;
    y /= 100;
    z /= 108.883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
    l = 116 * y - 16;
    a = 500 * (x - y);
    b = 200 * (y - z);
    return [l, a, b];
  };

  convert.hsl.rgb = function (hsl) {
    var h = hsl[0] / 360;
    var s = hsl[1] / 100;
    var l = hsl[2] / 100;
    var t1;
    var t2;
    var t3;
    var rgb;
    var val;

    if (s === 0) {
      val = l * 255;
      return [val, val, val];
    }

    if (l < 0.5) {
      t2 = l * (1 + s);
    } else {
      t2 = l + s - l * s;
    }

    t1 = 2 * l - t2;
    rgb = [0, 0, 0];

    for (var i = 0; i < 3; i++) {
      t3 = h + 1 / 3 * -(i - 1);

      if (t3 < 0) {
        t3++;
      }

      if (t3 > 1) {
        t3--;
      }

      if (6 * t3 < 1) {
        val = t1 + (t2 - t1) * 6 * t3;
      } else if (2 * t3 < 1) {
        val = t2;
      } else if (3 * t3 < 2) {
        val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
      } else {
        val = t1;
      }

      rgb[i] = val * 255;
    }

    return rgb;
  };

  convert.hsl.hsv = function (hsl) {
    var h = hsl[0];
    var s = hsl[1] / 100;
    var l = hsl[2] / 100;
    var smin = s;
    var lmin = Math.max(l, 0.01);
    var sv;
    var v;
    l *= 2;
    s *= l <= 1 ? l : 2 - l;
    smin *= lmin <= 1 ? lmin : 2 - lmin;
    v = (l + s) / 2;
    sv = l === 0 ? 2 * smin / (lmin + smin) : 2 * s / (l + s);
    return [h, sv * 100, v * 100];
  };

  convert.hsv.rgb = function (hsv) {
    var h = hsv[0] / 60;
    var s = hsv[1] / 100;
    var v = hsv[2] / 100;
    var hi = Math.floor(h) % 6;
    var f = h - Math.floor(h);
    var p = 255 * v * (1 - s);
    var q = 255 * v * (1 - s * f);
    var t = 255 * v * (1 - s * (1 - f));
    v *= 255;

    switch (hi) {
      case 0:
        return [v, t, p];

      case 1:
        return [q, v, p];

      case 2:
        return [p, v, t];

      case 3:
        return [p, q, v];

      case 4:
        return [t, p, v];

      case 5:
        return [v, p, q];
    }
  };

  convert.hsv.hsl = function (hsv) {
    var h = hsv[0];
    var s = hsv[1] / 100;
    var v = hsv[2] / 100;
    var vmin = Math.max(v, 0.01);
    var lmin;
    var sl;
    var l;
    l = (2 - s) * v;
    lmin = (2 - s) * vmin;
    sl = s * vmin;
    sl /= lmin <= 1 ? lmin : 2 - lmin;
    sl = sl || 0;
    l /= 2;
    return [h, sl * 100, l * 100];
  }; // http://dev.w3.org/csswg/css-color/#hwb-to-rgb


  convert.hwb.rgb = function (hwb) {
    var h = hwb[0] / 360;
    var wh = hwb[1] / 100;
    var bl = hwb[2] / 100;
    var ratio = wh + bl;
    var i;
    var v;
    var f;
    var n; // wh + bl cant be > 1

    if (ratio > 1) {
      wh /= ratio;
      bl /= ratio;
    }

    i = Math.floor(6 * h);
    v = 1 - bl;
    f = 6 * h - i;

    if ((i & 0x01) !== 0) {
      f = 1 - f;
    }

    n = wh + f * (v - wh); // linear interpolation

    var r;
    var g;
    var b;

    switch (i) {
      default:
      case 6:
      case 0:
        r = v;
        g = n;
        b = wh;
        break;

      case 1:
        r = n;
        g = v;
        b = wh;
        break;

      case 2:
        r = wh;
        g = v;
        b = n;
        break;

      case 3:
        r = wh;
        g = n;
        b = v;
        break;

      case 4:
        r = n;
        g = wh;
        b = v;
        break;

      case 5:
        r = v;
        g = wh;
        b = n;
        break;
    }

    return [r * 255, g * 255, b * 255];
  };

  convert.cmyk.rgb = function (cmyk) {
    var c = cmyk[0] / 100;
    var m = cmyk[1] / 100;
    var y = cmyk[2] / 100;
    var k = cmyk[3] / 100;
    var r;
    var g;
    var b;
    r = 1 - Math.min(1, c * (1 - k) + k);
    g = 1 - Math.min(1, m * (1 - k) + k);
    b = 1 - Math.min(1, y * (1 - k) + k);
    return [r * 255, g * 255, b * 255];
  };

  convert.xyz.rgb = function (xyz) {
    var x = xyz[0] / 100;
    var y = xyz[1] / 100;
    var z = xyz[2] / 100;
    var r;
    var g;
    var b;
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.2040 + z * 1.0570; // assume sRGB

    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1.0 / 2.4) - 0.055 : r * 12.92;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1.0 / 2.4) - 0.055 : g * 12.92;
    b = b > 0.0031308 ? 1.055 * Math.pow(b, 1.0 / 2.4) - 0.055 : b * 12.92;
    r = Math.min(Math.max(0, r), 1);
    g = Math.min(Math.max(0, g), 1);
    b = Math.min(Math.max(0, b), 1);
    return [r * 255, g * 255, b * 255];
  };

  convert.xyz.lab = function (xyz) {
    var x = xyz[0];
    var y = xyz[1];
    var z = xyz[2];
    var l;
    var a;
    var b;
    x /= 95.047;
    y /= 100;
    z /= 108.883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
    l = 116 * y - 16;
    a = 500 * (x - y);
    b = 200 * (y - z);
    return [l, a, b];
  };

  convert.lab.xyz = function (lab) {
    var l = lab[0];
    var a = lab[1];
    var b = lab[2];
    var x;
    var y;
    var z;
    y = (l + 16) / 116;
    x = a / 500 + y;
    z = y - b / 200;
    var y2 = Math.pow(y, 3);
    var x2 = Math.pow(x, 3);
    var z2 = Math.pow(z, 3);
    y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
    x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
    z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;
    x *= 95.047;
    y *= 100;
    z *= 108.883;
    return [x, y, z];
  };

  convert.lab.lch = function (lab) {
    var l = lab[0];
    var a = lab[1];
    var b = lab[2];
    var hr;
    var h;
    var c;
    hr = Math.atan2(b, a);
    h = hr * 360 / 2 / Math.PI;

    if (h < 0) {
      h += 360;
    }

    c = Math.sqrt(a * a + b * b);
    return [l, c, h];
  };

  convert.lch.lab = function (lch) {
    var l = lch[0];
    var c = lch[1];
    var h = lch[2];
    var a;
    var b;
    var hr;
    hr = h / 360 * 2 * Math.PI;
    a = c * Math.cos(hr);
    b = c * Math.sin(hr);
    return [l, a, b];
  };

  convert.rgb.ansi16 = function (args) {
    var r = args[0];
    var g = args[1];
    var b = args[2];
    var value = 1 in arguments ? arguments[1] : convert.rgb.hsv(args)[2]; // hsv -> ansi16 optimization

    value = Math.round(value / 50);

    if (value === 0) {
      return 30;
    }

    var ansi = 30 + (Math.round(b / 255) << 2 | Math.round(g / 255) << 1 | Math.round(r / 255));

    if (value === 2) {
      ansi += 60;
    }

    return ansi;
  };

  convert.hsv.ansi16 = function (args) {
    // optimization here; we already know the value and don't need to get
    // it converted for us.
    return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
  };

  convert.rgb.ansi256 = function (args) {
    var r = args[0];
    var g = args[1];
    var b = args[2]; // we use the extended greyscale palette here, with the exception of
    // black and white. normal palette only has 4 greyscale shades.

    if (r === g && g === b) {
      if (r < 8) {
        return 16;
      }

      if (r > 248) {
        return 231;
      }

      return Math.round((r - 8) / 247 * 24) + 232;
    }

    var ansi = 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
    return ansi;
  };

  convert.ansi16.rgb = function (args) {
    var color = args % 10; // handle greyscale

    if (color === 0 || color === 7) {
      if (args > 50) {
        color += 3.5;
      }

      color = color / 10.5 * 255;
      return [color, color, color];
    }

    var mult = (~~(args > 50) + 1) * 0.5;
    var r = (color & 1) * mult * 255;
    var g = (color >> 1 & 1) * mult * 255;
    var b = (color >> 2 & 1) * mult * 255;
    return [r, g, b];
  };

  convert.ansi256.rgb = function (args) {
    // handle greyscale
    if (args >= 232) {
      var c = (args - 232) * 10 + 8;
      return [c, c, c];
    }

    args -= 16;
    var rem;
    var r = Math.floor(args / 36) / 5 * 255;
    var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
    var b = rem % 6 / 5 * 255;
    return [r, g, b];
  };

  convert.rgb.hex = function (args) {
    var integer = ((Math.round(args[0]) & 0xFF) << 16) + ((Math.round(args[1]) & 0xFF) << 8) + (Math.round(args[2]) & 0xFF);
    var string = integer.toString(16).toUpperCase();
    return '000000'.substring(string.length) + string;
  };

  convert.hex.rgb = function (args) {
    var match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);

    if (!match) {
      return [0, 0, 0];
    }

    var colorString = match[0];

    if (match[0].length === 3) {
      colorString = colorString.split('').map(function (char) {
        return char + char;
      }).join('');
    }

    var integer = parseInt(colorString, 16);
    var r = integer >> 16 & 0xFF;
    var g = integer >> 8 & 0xFF;
    var b = integer & 0xFF;
    return [r, g, b];
  };

  convert.rgb.hcg = function (rgb) {
    var r = rgb[0] / 255;
    var g = rgb[1] / 255;
    var b = rgb[2] / 255;
    var max = Math.max(Math.max(r, g), b);
    var min = Math.min(Math.min(r, g), b);
    var chroma = max - min;
    var grayscale;
    var hue;

    if (chroma < 1) {
      grayscale = min / (1 - chroma);
    } else {
      grayscale = 0;
    }

    if (chroma <= 0) {
      hue = 0;
    } else if (max === r) {
      hue = (g - b) / chroma % 6;
    } else if (max === g) {
      hue = 2 + (b - r) / chroma;
    } else {
      hue = 4 + (r - g) / chroma + 4;
    }

    hue /= 6;
    hue %= 1;
    return [hue * 360, chroma * 100, grayscale * 100];
  };

  convert.hsl.hcg = function (hsl) {
    var s = hsl[1] / 100;
    var l = hsl[2] / 100;
    var c = 1;
    var f = 0;

    if (l < 0.5) {
      c = 2.0 * s * l;
    } else {
      c = 2.0 * s * (1.0 - l);
    }

    if (c < 1.0) {
      f = (l - 0.5 * c) / (1.0 - c);
    }

    return [hsl[0], c * 100, f * 100];
  };

  convert.hsv.hcg = function (hsv) {
    var s = hsv[1] / 100;
    var v = hsv[2] / 100;
    var c = s * v;
    var f = 0;

    if (c < 1.0) {
      f = (v - c) / (1 - c);
    }

    return [hsv[0], c * 100, f * 100];
  };

  convert.hcg.rgb = function (hcg) {
    var h = hcg[0] / 360;
    var c = hcg[1] / 100;
    var g = hcg[2] / 100;

    if (c === 0.0) {
      return [g * 255, g * 255, g * 255];
    }

    var pure = [0, 0, 0];
    var hi = h % 1 * 6;
    var v = hi % 1;
    var w = 1 - v;
    var mg = 0;

    switch (Math.floor(hi)) {
      case 0:
        pure[0] = 1;
        pure[1] = v;
        pure[2] = 0;
        break;

      case 1:
        pure[0] = w;
        pure[1] = 1;
        pure[2] = 0;
        break;

      case 2:
        pure[0] = 0;
        pure[1] = 1;
        pure[2] = v;
        break;

      case 3:
        pure[0] = 0;
        pure[1] = w;
        pure[2] = 1;
        break;

      case 4:
        pure[0] = v;
        pure[1] = 0;
        pure[2] = 1;
        break;

      default:
        pure[0] = 1;
        pure[1] = 0;
        pure[2] = w;
    }

    mg = (1.0 - c) * g;
    return [(c * pure[0] + mg) * 255, (c * pure[1] + mg) * 255, (c * pure[2] + mg) * 255];
  };

  convert.hcg.hsv = function (hcg) {
    var c = hcg[1] / 100;
    var g = hcg[2] / 100;
    var v = c + g * (1.0 - c);
    var f = 0;

    if (v > 0.0) {
      f = c / v;
    }

    return [hcg[0], f * 100, v * 100];
  };

  convert.hcg.hsl = function (hcg) {
    var c = hcg[1] / 100;
    var g = hcg[2] / 100;
    var l = g * (1.0 - c) + 0.5 * c;
    var s = 0;

    if (l > 0.0 && l < 0.5) {
      s = c / (2 * l);
    } else if (l >= 0.5 && l < 1.0) {
      s = c / (2 * (1 - l));
    }

    return [hcg[0], s * 100, l * 100];
  };

  convert.hcg.hwb = function (hcg) {
    var c = hcg[1] / 100;
    var g = hcg[2] / 100;
    var v = c + g * (1.0 - c);
    return [hcg[0], (v - c) * 100, (1 - v) * 100];
  };

  convert.hwb.hcg = function (hwb) {
    var w = hwb[1] / 100;
    var b = hwb[2] / 100;
    var v = 1 - b;
    var c = v - w;
    var g = 0;

    if (c < 1) {
      g = (v - c) / (1 - c);
    }

    return [hwb[0], c * 100, g * 100];
  };

  convert.apple.rgb = function (apple) {
    return [apple[0] / 65535 * 255, apple[1] / 65535 * 255, apple[2] / 65535 * 255];
  };

  convert.rgb.apple = function (rgb) {
    return [rgb[0] / 255 * 65535, rgb[1] / 255 * 65535, rgb[2] / 255 * 65535];
  };

  convert.gray.rgb = function (args) {
    return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
  };

  convert.gray.hsl = convert.gray.hsv = function (args) {
    return [0, 0, args[0]];
  };

  convert.gray.hwb = function (gray) {
    return [0, 100, gray[0]];
  };

  convert.gray.cmyk = function (gray) {
    return [0, 0, 0, gray[0]];
  };

  convert.gray.lab = function (gray) {
    return [gray[0], 0, 0];
  };

  convert.gray.hex = function (gray) {
    var val = Math.round(gray[0] / 100 * 255) & 0xFF;
    var integer = (val << 16) + (val << 8) + val;
    var string = integer.toString(16).toUpperCase();
    return '000000'.substring(string.length) + string;
  };

  convert.rgb.gray = function (rgb) {
    var val = (rgb[0] + rgb[1] + rgb[2]) / 3;
    return [val / 255 * 100];
  };
});
var conversions_1 = conversions.rgb;
var conversions_2 = conversions.hsl;
var conversions_3 = conversions.hsv;
var conversions_4 = conversions.hwb;
var conversions_5 = conversions.cmyk;
var conversions_6 = conversions.xyz;
var conversions_7 = conversions.lab;
var conversions_8 = conversions.lch;
var conversions_9 = conversions.hex;
var conversions_10 = conversions.keyword;
var conversions_11 = conversions.ansi16;
var conversions_12 = conversions.ansi256;
var conversions_13 = conversions.hcg;
var conversions_14 = conversions.apple;
var conversions_15 = conversions.gray;

/*
	this function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
  var graph = {}; // https://jsperf.com/object-keys-vs-for-in-with-closure/3

  var models = Object.keys(conversions);

  for (var len = models.length, i = 0; i < len; i++) {
    graph[models[i]] = {
      // http://jsperf.com/1-vs-infinity
      // micro-opt, but this is simple.
      distance: -1,
      parent: null
    };
  }

  return graph;
} // https://en.wikipedia.org/wiki/Breadth-first_search


function deriveBFS(fromModel) {
  var graph = buildGraph();
  var queue = [fromModel]; // unshift -> queue -> pop

  graph[fromModel].distance = 0;

  while (queue.length) {
    var current = queue.pop();
    var adjacents = Object.keys(conversions[current]);

    for (var len = adjacents.length, i = 0; i < len; i++) {
      var adjacent = adjacents[i];
      var node = graph[adjacent];

      if (node.distance === -1) {
        node.distance = graph[current].distance + 1;
        node.parent = current;
        queue.unshift(adjacent);
      }
    }
  }

  return graph;
}

function link(from, to) {
  return function (args) {
    return to(from(args));
  };
}

function wrapConversion(toModel, graph) {
  var path = [graph[toModel].parent, toModel];
  var fn = conversions[graph[toModel].parent][toModel];
  var cur = graph[toModel].parent;

  while (graph[cur].parent) {
    path.unshift(graph[cur].parent);
    fn = link(conversions[graph[cur].parent][cur], fn);
    cur = graph[cur].parent;
  }

  fn.conversion = path;
  return fn;
}

var route = function (fromModel) {
  var graph = deriveBFS(fromModel);
  var conversion = {};
  var models = Object.keys(graph);

  for (var len = models.length, i = 0; i < len; i++) {
    var toModel = models[i];
    var node = graph[toModel];

    if (node.parent === null) {
      // no possible conversion, or this node is the source model.
      continue;
    }

    conversion[toModel] = wrapConversion(toModel, graph);
  }

  return conversion;
};

var convert = {};
var models = Object.keys(conversions);

function wrapRaw(fn) {
  var wrappedFn = function (args) {
    if (args === undefined || args === null) {
      return args;
    }

    if (arguments.length > 1) {
      args = Array.prototype.slice.call(arguments);
    }

    return fn(args);
  }; // preserve .conversion property if there is one


  if ('conversion' in fn) {
    wrappedFn.conversion = fn.conversion;
  }

  return wrappedFn;
}

function wrapRounded(fn) {
  var wrappedFn = function (args) {
    if (args === undefined || args === null) {
      return args;
    }

    if (arguments.length > 1) {
      args = Array.prototype.slice.call(arguments);
    }

    var result = fn(args); // we're assuming the result is an array here.
    // see notice in conversions.js; don't use box types
    // in conversion functions.

    if (typeof result === 'object') {
      for (var len = result.length, i = 0; i < len; i++) {
        result[i] = Math.round(result[i]);
      }
    }

    return result;
  }; // preserve .conversion property if there is one


  if ('conversion' in fn) {
    wrappedFn.conversion = fn.conversion;
  }

  return wrappedFn;
}

models.forEach(function (fromModel) {
  convert[fromModel] = {};
  Object.defineProperty(convert[fromModel], 'channels', {
    value: conversions[fromModel].channels
  });
  Object.defineProperty(convert[fromModel], 'labels', {
    value: conversions[fromModel].labels
  });
  var routes = route(fromModel);
  var routeModels = Object.keys(routes);
  routeModels.forEach(function (toModel) {
    var fn = routes[toModel];
    convert[fromModel][toModel] = wrapRounded(fn);
    convert[fromModel][toModel].raw = wrapRaw(fn);
  });
});
var colorConvert = convert;

var ansiStyles = createCommonjsModule(function (module) {

  const wrapAnsi16 = (fn, offset) => function () {
    const code = fn.apply(colorConvert, arguments);
    return `\u001B[${code + offset}m`;
  };

  const wrapAnsi256 = (fn, offset) => function () {
    const code = fn.apply(colorConvert, arguments);
    return `\u001B[${38 + offset};5;${code}m`;
  };

  const wrapAnsi16m = (fn, offset) => function () {
    const rgb = fn.apply(colorConvert, arguments);
    return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
  };

  function assembleStyles() {
    const codes = new Map();
    const styles = {
      modifier: {
        reset: [0, 0],
        // 21 isn't widely supported and 22 does the same thing
        bold: [1, 22],
        dim: [2, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        hidden: [8, 28],
        strikethrough: [9, 29]
      },
      color: {
        black: [30, 39],
        red: [31, 39],
        green: [32, 39],
        yellow: [33, 39],
        blue: [34, 39],
        magenta: [35, 39],
        cyan: [36, 39],
        white: [37, 39],
        gray: [90, 39],
        // Bright color
        redBright: [91, 39],
        greenBright: [92, 39],
        yellowBright: [93, 39],
        blueBright: [94, 39],
        magentaBright: [95, 39],
        cyanBright: [96, 39],
        whiteBright: [97, 39]
      },
      bgColor: {
        bgBlack: [40, 49],
        bgRed: [41, 49],
        bgGreen: [42, 49],
        bgYellow: [43, 49],
        bgBlue: [44, 49],
        bgMagenta: [45, 49],
        bgCyan: [46, 49],
        bgWhite: [47, 49],
        // Bright color
        bgBlackBright: [100, 49],
        bgRedBright: [101, 49],
        bgGreenBright: [102, 49],
        bgYellowBright: [103, 49],
        bgBlueBright: [104, 49],
        bgMagentaBright: [105, 49],
        bgCyanBright: [106, 49],
        bgWhiteBright: [107, 49]
      }
    }; // Fix humans

    styles.color.grey = styles.color.gray;

    for (const groupName of Object.keys(styles)) {
      const group = styles[groupName];

      for (const styleName of Object.keys(group)) {
        const style = group[styleName];
        styles[styleName] = {
          open: `\u001B[${style[0]}m`,
          close: `\u001B[${style[1]}m`
        };
        group[styleName] = styles[styleName];
        codes.set(style[0], style[1]);
      }

      Object.defineProperty(styles, groupName, {
        value: group,
        enumerable: false
      });
      Object.defineProperty(styles, 'codes', {
        value: codes,
        enumerable: false
      });
    }

    const ansi2ansi = n => n;

    const rgb2rgb = (r, g, b) => [r, g, b];

    styles.color.close = '\u001B[39m';
    styles.bgColor.close = '\u001B[49m';
    styles.color.ansi = {
      ansi: wrapAnsi16(ansi2ansi, 0)
    };
    styles.color.ansi256 = {
      ansi256: wrapAnsi256(ansi2ansi, 0)
    };
    styles.color.ansi16m = {
      rgb: wrapAnsi16m(rgb2rgb, 0)
    };
    styles.bgColor.ansi = {
      ansi: wrapAnsi16(ansi2ansi, 10)
    };
    styles.bgColor.ansi256 = {
      ansi256: wrapAnsi256(ansi2ansi, 10)
    };
    styles.bgColor.ansi16m = {
      rgb: wrapAnsi16m(rgb2rgb, 10)
    };

    for (let key of Object.keys(colorConvert)) {
      if (typeof colorConvert[key] !== 'object') {
        continue;
      }

      const suite = colorConvert[key];

      if (key === 'ansi16') {
        key = 'ansi';
      }

      if ('ansi16' in suite) {
        styles.color.ansi[key] = wrapAnsi16(suite.ansi16, 0);
        styles.bgColor.ansi[key] = wrapAnsi16(suite.ansi16, 10);
      }

      if ('ansi256' in suite) {
        styles.color.ansi256[key] = wrapAnsi256(suite.ansi256, 0);
        styles.bgColor.ansi256[key] = wrapAnsi256(suite.ansi256, 10);
      }

      if ('rgb' in suite) {
        styles.color.ansi16m[key] = wrapAnsi16m(suite.rgb, 0);
        styles.bgColor.ansi16m[key] = wrapAnsi16m(suite.rgb, 10);
      }
    }

    return styles;
  } // Make the export immutable


  Object.defineProperty(module, 'exports', {
    enumerable: true,
    get: assembleStyles
  });
});

var hasFlag = (flag, argv) => {
  argv = argv || process.argv;
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
  const pos = argv.indexOf(prefix + flag);
  const terminatorPos = argv.indexOf('--');
  return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
};

const env = process.env;
let forceColor;

if (hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false')) {
  forceColor = false;
} else if (hasFlag('color') || hasFlag('colors') || hasFlag('color=true') || hasFlag('color=always')) {
  forceColor = true;
}

if ('FORCE_COLOR' in env) {
  forceColor = env.FORCE_COLOR.length === 0 || parseInt(env.FORCE_COLOR, 10) !== 0;
}

function translateLevel(level) {
  if (level === 0) {
    return false;
  }

  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}

function supportsColor(stream) {
  if (forceColor === false) {
    return 0;
  }

  if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) {
    return 3;
  }

  if (hasFlag('color=256')) {
    return 2;
  }

  if (stream && !stream.isTTY && forceColor !== true) {
    return 0;
  }

  const min = forceColor ? 1 : 0;

  if (process.platform === 'win32') {
    // Node.js 7.5.0 is the first version of Node.js to include a patch to
    // libuv that enables 256 color output on Windows. Anything earlier and it
    // won't work. However, here we target Node.js 8 at minimum as it is an LTS
    // release, and Node.js 7 is not. Windows 10 build 10586 is the first Windows
    // release that supports 256 colors. Windows 10 build 14931 is the first release
    // that supports 16m/TrueColor.
    const osRelease = os.release().split('.');

    if (Number(process.versions.node.split('.')[0]) >= 8 && Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }

    return 1;
  }

  if ('CI' in env) {
    if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
      return 1;
    }

    return min;
  }

  if ('TEAMCITY_VERSION' in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }

  if (env.COLORTERM === 'truecolor') {
    return 3;
  }

  if ('TERM_PROGRAM' in env) {
    const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

    switch (env.TERM_PROGRAM) {
      case 'iTerm.app':
        return version >= 3 ? 3 : 2;

      case 'Apple_Terminal':
        return 2;
      // No default
    }
  }

  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }

  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }

  if ('COLORTERM' in env) {
    return 1;
  }

  if (env.TERM === 'dumb') {
    return min;
  }

  return min;
}

function getSupportLevel(stream) {
  const level = supportsColor(stream);
  return translateLevel(level);
}

var supportsColor_1 = {
  supportsColor: getSupportLevel,
  stdout: getSupportLevel(process.stdout),
  stderr: getSupportLevel(process.stderr)
};

const TEMPLATE_REGEX = /(?:\\(u[a-f\d]{4}|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
const STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u[a-f\d]{4}|x[a-f\d]{2}|.)|([^\\])/gi;
const ESCAPES = new Map([['n', '\n'], ['r', '\r'], ['t', '\t'], ['b', '\b'], ['f', '\f'], ['v', '\v'], ['0', '\0'], ['\\', '\\'], ['e', '\u001B'], ['a', '\u0007']]);

function unescape(c) {
  if (c[0] === 'u' && c.length === 5 || c[0] === 'x' && c.length === 3) {
    return String.fromCharCode(parseInt(c.slice(1), 16));
  }

  return ESCAPES.get(c) || c;
}

function parseArguments(name, args) {
  const results = [];
  const chunks = args.trim().split(/\s*,\s*/g);
  let matches;

  for (const chunk of chunks) {
    if (!isNaN(chunk)) {
      results.push(Number(chunk));
    } else if (matches = chunk.match(STRING_REGEX)) {
      results.push(matches[2].replace(ESCAPE_REGEX, (m, escape, chr) => escape ? unescape(escape) : chr));
    } else {
      throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
    }
  }

  return results;
}

function parseStyle(style) {
  STYLE_REGEX.lastIndex = 0;
  const results = [];
  let matches;

  while ((matches = STYLE_REGEX.exec(style)) !== null) {
    const name = matches[1];

    if (matches[2]) {
      const args = parseArguments(name, matches[2]);
      results.push([name].concat(args));
    } else {
      results.push([name]);
    }
  }

  return results;
}

function buildStyle(chalk, styles) {
  const enabled = {};

  for (const layer of styles) {
    for (const style of layer.styles) {
      enabled[style[0]] = layer.inverse ? null : style.slice(1);
    }
  }

  let current = chalk;

  for (const styleName of Object.keys(enabled)) {
    if (Array.isArray(enabled[styleName])) {
      if (!(styleName in current)) {
        throw new Error(`Unknown Chalk style: ${styleName}`);
      }

      if (enabled[styleName].length > 0) {
        current = current[styleName].apply(current, enabled[styleName]);
      } else {
        current = current[styleName];
      }
    }
  }

  return current;
}

var templates = (chalk, tmp) => {
  const styles = [];
  const chunks = [];
  let chunk = []; // eslint-disable-next-line max-params

  tmp.replace(TEMPLATE_REGEX, (m, escapeChar, inverse, style, close, chr) => {
    if (escapeChar) {
      chunk.push(unescape(escapeChar));
    } else if (style) {
      const str = chunk.join('');
      chunk = [];
      chunks.push(styles.length === 0 ? str : buildStyle(chalk, styles)(str));
      styles.push({
        inverse,
        styles: parseStyle(style)
      });
    } else if (close) {
      if (styles.length === 0) {
        throw new Error('Found extraneous } in Chalk template literal');
      }

      chunks.push(buildStyle(chalk, styles)(chunk.join('')));
      chunk = [];
      styles.pop();
    } else {
      chunk.push(chr);
    }
  });
  chunks.push(chunk.join(''));

  if (styles.length > 0) {
    const errMsg = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? '' : 's'} (\`}\`)`;
    throw new Error(errMsg);
  }

  return chunks.join('');
};

var chalk = createCommonjsModule(function (module) {

  const stdoutColor = supportsColor_1.stdout;
  const isSimpleWindowsTerm = process.platform === 'win32' && !(process.env.TERM || '').toLowerCase().startsWith('xterm'); // `supportsColor.level` → `ansiStyles.color[name]` mapping

  const levelMapping = ['ansi', 'ansi', 'ansi256', 'ansi16m']; // `color-convert` models to exclude from the Chalk API due to conflicts and such

  const skipModels = new Set(['gray']);
  const styles = Object.create(null);

  function applyOptions(obj, options) {
    options = options || {}; // Detect level if not set manually

    const scLevel = stdoutColor ? stdoutColor.level : 0;
    obj.level = options.level === undefined ? scLevel : options.level;
    obj.enabled = 'enabled' in options ? options.enabled : obj.level > 0;
  }

  function Chalk(options) {
    // We check for this.template here since calling `chalk.constructor()`
    // by itself will have a `this` of a previously constructed chalk object
    if (!this || !(this instanceof Chalk) || this.template) {
      const chalk = {};
      applyOptions(chalk, options);

      chalk.template = function () {
        const args = [].slice.call(arguments);
        return chalkTag.apply(null, [chalk.template].concat(args));
      };

      Object.setPrototypeOf(chalk, Chalk.prototype);
      Object.setPrototypeOf(chalk.template, chalk);
      chalk.template.constructor = Chalk;
      return chalk.template;
    }

    applyOptions(this, options);
  } // Use bright blue on Windows as the normal blue color is illegible


  if (isSimpleWindowsTerm) {
    ansiStyles.blue.open = '\u001B[94m';
  }

  for (const key of Object.keys(ansiStyles)) {
    ansiStyles[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles[key].close), 'g');
    styles[key] = {
      get() {
        const codes = ansiStyles[key];
        return build.call(this, this._styles ? this._styles.concat(codes) : [codes], this._empty, key);
      }

    };
  }

  styles.visible = {
    get() {
      return build.call(this, this._styles || [], true, 'visible');
    }

  };
  ansiStyles.color.closeRe = new RegExp(escapeStringRegexp(ansiStyles.color.close), 'g');

  for (const model of Object.keys(ansiStyles.color.ansi)) {
    if (skipModels.has(model)) {
      continue;
    }

    styles[model] = {
      get() {
        const level = this.level;
        return function () {
          const open = ansiStyles.color[levelMapping[level]][model].apply(null, arguments);
          const codes = {
            open,
            close: ansiStyles.color.close,
            closeRe: ansiStyles.color.closeRe
          };
          return build.call(this, this._styles ? this._styles.concat(codes) : [codes], this._empty, model);
        };
      }

    };
  }

  ansiStyles.bgColor.closeRe = new RegExp(escapeStringRegexp(ansiStyles.bgColor.close), 'g');

  for (const model of Object.keys(ansiStyles.bgColor.ansi)) {
    if (skipModels.has(model)) {
      continue;
    }

    const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
    styles[bgModel] = {
      get() {
        const level = this.level;
        return function () {
          const open = ansiStyles.bgColor[levelMapping[level]][model].apply(null, arguments);
          const codes = {
            open,
            close: ansiStyles.bgColor.close,
            closeRe: ansiStyles.bgColor.closeRe
          };
          return build.call(this, this._styles ? this._styles.concat(codes) : [codes], this._empty, model);
        };
      }

    };
  }

  const proto = Object.defineProperties(() => {}, styles);

  function build(_styles, _empty, key) {
    const builder = function () {
      return applyStyle.apply(builder, arguments);
    };

    builder._styles = _styles;
    builder._empty = _empty;
    const self = this;
    Object.defineProperty(builder, 'level', {
      enumerable: true,

      get() {
        return self.level;
      },

      set(level) {
        self.level = level;
      }

    });
    Object.defineProperty(builder, 'enabled', {
      enumerable: true,

      get() {
        return self.enabled;
      },

      set(enabled) {
        self.enabled = enabled;
      }

    }); // See below for fix regarding invisible grey/dim combination on Windows

    builder.hasGrey = this.hasGrey || key === 'gray' || key === 'grey'; // `__proto__` is used because we must return a function, but there is
    // no way to create a function with a different prototype

    builder.__proto__ = proto; // eslint-disable-line no-proto

    return builder;
  }

  function applyStyle() {
    // Support varags, but simply cast to string in case there's only one arg
    const args = arguments;
    const argsLen = args.length;
    let str = String(arguments[0]);

    if (argsLen === 0) {
      return '';
    }

    if (argsLen > 1) {
      // Don't slice `arguments`, it prevents V8 optimizations
      for (let a = 1; a < argsLen; a++) {
        str += ' ' + args[a];
      }
    }

    if (!this.enabled || this.level <= 0 || !str) {
      return this._empty ? '' : str;
    } // Turns out that on Windows dimmed gray text becomes invisible in cmd.exe,
    // see https://github.com/chalk/chalk/issues/58
    // If we're on Windows and we're dealing with a gray color, temporarily make 'dim' a noop.


    const originalDim = ansiStyles.dim.open;

    if (isSimpleWindowsTerm && this.hasGrey) {
      ansiStyles.dim.open = '';
    }

    for (const code of this._styles.slice().reverse()) {
      // Replace any instances already present with a re-opening code
      // otherwise only the part of the string until said closing code
      // will be colored, and the rest will simply be 'plain'.
      str = code.open + str.replace(code.closeRe, code.open) + code.close; // Close the styling before a linebreak and reopen
      // after next line to fix a bleed issue on macOS
      // https://github.com/chalk/chalk/pull/92

      str = str.replace(/\r?\n/g, `${code.close}$&${code.open}`);
    } // Reset the original `dim` if we changed it to work around the Windows dimmed gray issue


    ansiStyles.dim.open = originalDim;
    return str;
  }

  function chalkTag(chalk, strings) {
    if (!Array.isArray(strings)) {
      // If chalk() was called by itself or with a string,
      // return the string itself as a string.
      return [].slice.call(arguments, 1).join(' ');
    }

    const args = [].slice.call(arguments, 2);
    const parts = [strings.raw[0]];

    for (let i = 1; i < strings.length; i++) {
      parts.push(String(args[i - 1]).replace(/[{}\\]/g, '\\$&'));
      parts.push(String(strings.raw[i]));
    }

    return templates(chalk, parts.join(''));
  }

  Object.defineProperties(Chalk.prototype, styles);
  module.exports = Chalk(); // eslint-disable-line new-cap

  module.exports.supportsColor = stdoutColor;
  module.exports.default = module.exports; // For TypeScript
});
var chalk_1 = chalk.supportsColor;

var lib = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.shouldHighlight = shouldHighlight;
  exports.getChalk = getChalk;
  exports.default = highlight;

  var _jsTokens = _interopRequireWildcard(jsTokens);

  var _esutils = _interopRequireDefault(utils);

  var _chalk = _interopRequireDefault(chalk);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  function getDefs(chalk) {
    return {
      keyword: chalk.cyan,
      capitalized: chalk.yellow,
      jsx_tag: chalk.yellow,
      punctuator: chalk.yellow,
      number: chalk.magenta,
      string: chalk.green,
      regex: chalk.magenta,
      comment: chalk.grey,
      invalid: chalk.white.bgRed.bold
    };
  }

  const NEWLINE = /\r\n|[\n\r\u2028\u2029]/;
  const JSX_TAG = /^[a-z][\w-]*$/i;
  const BRACKET = /^[()[\]{}]$/;

  function getTokenType(match) {
    const [offset, text] = match.slice(-2);
    const token = (0, _jsTokens.matchToToken)(match);

    if (token.type === "name") {
      if (_esutils.default.keyword.isReservedWordES6(token.value)) {
        return "keyword";
      }

      if (JSX_TAG.test(token.value) && (text[offset - 1] === "<" || text.substr(offset - 2, 2) == "</")) {
        return "jsx_tag";
      }

      if (token.value[0] !== token.value[0].toLowerCase()) {
        return "capitalized";
      }
    }

    if (token.type === "punctuator" && BRACKET.test(token.value)) {
      return "bracket";
    }

    if (token.type === "invalid" && (token.value === "@" || token.value === "#")) {
      return "punctuator";
    }

    return token.type;
  }

  function highlightTokens(defs, text) {
    return text.replace(_jsTokens.default, function (...args) {
      const type = getTokenType(args);
      const colorize = defs[type];

      if (colorize) {
        return args[0].split(NEWLINE).map(str => colorize(str)).join("\n");
      } else {
        return args[0];
      }
    });
  }

  function shouldHighlight(options) {
    return _chalk.default.supportsColor || options.forceColor;
  }

  function getChalk(options) {
    let chalk = _chalk.default;

    if (options.forceColor) {
      chalk = new _chalk.default.constructor({
        enabled: true,
        level: 1
      });
    }

    return chalk;
  }

  function highlight(code, options = {}) {
    if (shouldHighlight(options)) {
      const chalk = getChalk(options);
      const defs = getDefs(chalk);
      return highlightTokens(defs, code);
    } else {
      return code;
    }
  }
});
unwrapExports(lib);
var lib_1 = lib.shouldHighlight;
var lib_2 = lib.getChalk;

var lib$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.codeFrameColumns = codeFrameColumns;
  exports.default = _default;

  var _highlight = _interopRequireWildcard(lib);

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  let deprecationWarningShown = false;

  function getDefs(chalk) {
    return {
      gutter: chalk.grey,
      marker: chalk.red.bold,
      message: chalk.red.bold
    };
  }

  const NEWLINE = /\r\n|[\n\r\u2028\u2029]/;

  function getMarkerLines(loc, source, opts) {
    const startLoc = Object.assign({
      column: 0,
      line: -1
    }, loc.start);
    const endLoc = Object.assign({}, startLoc, {}, loc.end);
    const {
      linesAbove = 2,
      linesBelow = 3
    } = opts || {};
    const startLine = startLoc.line;
    const startColumn = startLoc.column;
    const endLine = endLoc.line;
    const endColumn = endLoc.column;
    let start = Math.max(startLine - (linesAbove + 1), 0);
    let end = Math.min(source.length, endLine + linesBelow);

    if (startLine === -1) {
      start = 0;
    }

    if (endLine === -1) {
      end = source.length;
    }

    const lineDiff = endLine - startLine;
    const markerLines = {};

    if (lineDiff) {
      for (let i = 0; i <= lineDiff; i++) {
        const lineNumber = i + startLine;

        if (!startColumn) {
          markerLines[lineNumber] = true;
        } else if (i === 0) {
          const sourceLength = source[lineNumber - 1].length;
          markerLines[lineNumber] = [startColumn, sourceLength - startColumn + 1];
        } else if (i === lineDiff) {
          markerLines[lineNumber] = [0, endColumn];
        } else {
          const sourceLength = source[lineNumber - i].length;
          markerLines[lineNumber] = [0, sourceLength];
        }
      }
    } else {
      if (startColumn === endColumn) {
        if (startColumn) {
          markerLines[startLine] = [startColumn, 0];
        } else {
          markerLines[startLine] = true;
        }
      } else {
        markerLines[startLine] = [startColumn, endColumn - startColumn];
      }
    }

    return {
      start,
      end,
      markerLines
    };
  }

  function codeFrameColumns(rawLines, loc, opts = {}) {
    const highlighted = (opts.highlightCode || opts.forceColor) && (0, _highlight.shouldHighlight)(opts);
    const chalk = (0, _highlight.getChalk)(opts);
    const defs = getDefs(chalk);

    const maybeHighlight = (chalkFn, string) => {
      return highlighted ? chalkFn(string) : string;
    };

    const lines = rawLines.split(NEWLINE);
    const {
      start,
      end,
      markerLines
    } = getMarkerLines(loc, lines, opts);
    const hasColumns = loc.start && typeof loc.start.column === "number";
    const numberMaxWidth = String(end).length;
    const highlightedLines = highlighted ? (0, _highlight.default)(rawLines, opts) : rawLines;
    let frame = highlightedLines.split(NEWLINE).slice(start, end).map((line, index) => {
      const number = start + 1 + index;
      const paddedNumber = ` ${number}`.slice(-numberMaxWidth);
      const gutter = ` ${paddedNumber} | `;
      const hasMarker = markerLines[number];
      const lastMarkerLine = !markerLines[number + 1];

      if (hasMarker) {
        let markerLine = "";

        if (Array.isArray(hasMarker)) {
          const markerSpacing = line.slice(0, Math.max(hasMarker[0] - 1, 0)).replace(/[^\t]/g, " ");
          const numberOfMarkers = hasMarker[1] || 1;
          markerLine = ["\n ", maybeHighlight(defs.gutter, gutter.replace(/\d/g, " ")), markerSpacing, maybeHighlight(defs.marker, "^").repeat(numberOfMarkers)].join("");

          if (lastMarkerLine && opts.message) {
            markerLine += " " + maybeHighlight(defs.message, opts.message);
          }
        }

        return [maybeHighlight(defs.marker, ">"), maybeHighlight(defs.gutter, gutter), line, markerLine].join("");
      } else {
        return ` ${maybeHighlight(defs.gutter, gutter)}${line}`;
      }
    }).join("\n");

    if (opts.message && !hasColumns) {
      frame = `${" ".repeat(numberMaxWidth + 1)}${opts.message}\n${frame}`;
    }

    if (highlighted) {
      return chalk.reset(frame);
    } else {
      return frame;
    }
  }

  function _default(rawLines, lineNumber, colNumber, opts = {}) {
    if (!deprecationWarningShown) {
      deprecationWarningShown = true;
      const message = "Passing lineNumber and colNumber is deprecated to @babel/code-frame. Please use `codeFrameColumns`.";

      if (process.emitWarning) {
        process.emitWarning(message, "DeprecationWarning");
      } else {
        const deprecationError = new Error(message);
        deprecationError.name = "DeprecationWarning";
        console.warn(new Error(message));
      }
    }

    colNumber = Math.max(colNumber, 0);
    const location = {
      start: {
        column: colNumber,
        line: lineNumber
      }
    };
    return codeFrameColumns(rawLines, location, opts);
  }
});
unwrapExports(lib$1);
var lib_1$1 = lib$1.codeFrameColumns;

var require$$0 = getCjsExportFromNamespace(dist);

const {
  default: LinesAndColumns$1
} = require$$0;
const {
  codeFrameColumns
} = lib$1;
const JSONError = errorEx_1('JSONError', {
  fileName: errorEx_1.append('in %s'),
  codeFrame: errorEx_1.append('\n\n%s\n')
});

var parseJson$1 = (string, reviver, filename) => {
  if (typeof reviver === 'string') {
    filename = reviver;
    reviver = null;
  }

  try {
    try {
      return JSON.parse(string, reviver);
    } catch (error) {
      jsonParseBetterErrors(string, reviver);
      throw error;
    }
  } catch (error) {
    error.message = error.message.replace(/\n/g, '');
    const indexMatch = error.message.match(/in JSON at position (\d+) while parsing near/);
    const jsonError = new JSONError(error);

    if (filename) {
      jsonError.fileName = filename;
    }

    if (indexMatch && indexMatch.length > 0) {
      const lines = new LinesAndColumns$1(string);
      const index = Number(indexMatch[1]);
      const location = lines.locationForIndex(index);
      const codeFrame = codeFrameColumns(string, {
        start: {
          line: location.line + 1,
          column: location.column + 1
        }
      }, {
        highlightCode: true
      });
      jsonError.codeFrame = codeFrame;
    }

    throw jsonError;
  }
};

var constants = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Type = exports.Char = void 0;
  const Char = {
    ANCHOR: '&',
    COMMENT: '#',
    TAG: '!',
    DIRECTIVES_END: '-',
    DOCUMENT_END: '.'
  };
  exports.Char = Char;
  const Type = {
    ALIAS: 'ALIAS',
    BLANK_LINE: 'BLANK_LINE',
    BLOCK_FOLDED: 'BLOCK_FOLDED',
    BLOCK_LITERAL: 'BLOCK_LITERAL',
    COMMENT: 'COMMENT',
    DIRECTIVE: 'DIRECTIVE',
    DOCUMENT: 'DOCUMENT',
    FLOW_MAP: 'FLOW_MAP',
    FLOW_SEQ: 'FLOW_SEQ',
    MAP: 'MAP',
    MAP_KEY: 'MAP_KEY',
    MAP_VALUE: 'MAP_VALUE',
    PLAIN: 'PLAIN',
    QUOTE_DOUBLE: 'QUOTE_DOUBLE',
    QUOTE_SINGLE: 'QUOTE_SINGLE',
    SEQ: 'SEQ',
    SEQ_ITEM: 'SEQ_ITEM'
  };
  exports.Type = Type;
});
unwrapExports(constants);
var constants_1 = constants.Type;
var constants_2 = constants.Char;

var sourceUtils = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getLinePos = getLinePos;
  exports.getLine = getLine;
  exports.getPrettyContext = getPrettyContext;

  function findLineStarts(src) {
    const ls = [0];
    let offset = src.indexOf('\n');

    while (offset !== -1) {
      offset += 1;
      ls.push(offset);
      offset = src.indexOf('\n', offset);
    }

    return ls;
  }

  function getSrcInfo(cst) {
    let lineStarts, src;

    if (typeof cst === 'string') {
      lineStarts = findLineStarts(cst);
      src = cst;
    } else {
      if (Array.isArray(cst)) cst = cst[0];

      if (cst && cst.context) {
        if (!cst.lineStarts) cst.lineStarts = findLineStarts(cst.context.src);
        lineStarts = cst.lineStarts;
        src = cst.context.src;
      }
    }

    return {
      lineStarts,
      src
    };
  }
  /**
   * @typedef {Object} LinePos - One-indexed position in the source
   * @property {number} line
   * @property {number} col
   */

  /**
   * Determine the line/col position matching a character offset.
   *
   * Accepts a source string or a CST document as the second parameter. With
   * the latter, starting indices for lines are cached in the document as
   * `lineStarts: number[]`.
   *
   * Returns a one-indexed `{ line, col }` location if found, or
   * `undefined` otherwise.
   *
   * @param {number} offset
   * @param {string|Document|Document[]} cst
   * @returns {?LinePos}
   */


  function getLinePos(offset, cst) {
    if (typeof offset !== 'number' || offset < 0) return null;
    const {
      lineStarts,
      src
    } = getSrcInfo(cst);
    if (!lineStarts || !src || offset > src.length) return null;

    for (let i = 0; i < lineStarts.length; ++i) {
      const start = lineStarts[i];

      if (offset < start) {
        return {
          line: i,
          col: offset - lineStarts[i - 1] + 1
        };
      }

      if (offset === start) return {
        line: i + 1,
        col: 1
      };
    }

    const line = lineStarts.length;
    return {
      line,
      col: offset - lineStarts[line - 1] + 1
    };
  }
  /**
   * Get a specified line from the source.
   *
   * Accepts a source string or a CST document as the second parameter. With
   * the latter, starting indices for lines are cached in the document as
   * `lineStarts: number[]`.
   *
   * Returns the line as a string if found, or `null` otherwise.
   *
   * @param {number} line One-indexed line number
   * @param {string|Document|Document[]} cst
   * @returns {?string}
   */


  function getLine(line, cst) {
    const {
      lineStarts,
      src
    } = getSrcInfo(cst);
    if (!lineStarts || !(line >= 1) || line > lineStarts.length) return null;
    const start = lineStarts[line - 1];
    let end = lineStarts[line]; // undefined for last line; that's ok for slice()

    while (end && end > start && src[end - 1] === '\n') --end;

    return src.slice(start, end);
  }
  /**
   * Pretty-print the starting line from the source indicated by the range `pos`
   *
   * Trims output to `maxWidth` chars while keeping the starting column visible,
   * using `…` at either end to indicate dropped characters.
   *
   * Returns a two-line string (or `null`) with `\n` as separator; the second line
   * will hold appropriately indented `^` marks indicating the column range.
   *
   * @param {Object} pos
   * @param {LinePos} pos.start
   * @param {LinePos} [pos.end]
   * @param {string|Document|Document[]*} cst
   * @param {number} [maxWidth=80]
   * @returns {?string}
   */


  function getPrettyContext({
    start,
    end
  }, cst, maxWidth = 80) {
    let src = getLine(start.line, cst);
    if (!src) return null;
    let {
      col
    } = start;

    if (src.length > maxWidth) {
      if (col <= maxWidth - 10) {
        src = src.substr(0, maxWidth - 1) + '…';
      } else {
        const halfWidth = Math.round(maxWidth / 2);
        if (src.length > col + halfWidth) src = src.substr(0, col + halfWidth - 1) + '…';
        col -= src.length - maxWidth;
        src = '…' + src.substr(1 - maxWidth);
      }
    }

    let errLen = 1;
    let errEnd = '';

    if (end) {
      if (end.line === start.line && col + (end.col - start.col) <= maxWidth + 1) {
        errLen = end.col - start.col;
      } else {
        errLen = Math.min(src.length + 1, maxWidth) - col;
        errEnd = '…';
      }
    }

    const offset = col > 1 ? ' '.repeat(col - 1) : '';
    const err = '^'.repeat(errLen);
    return `${src}\n${offset}${err}${errEnd}`;
  }
});
unwrapExports(sourceUtils);
var sourceUtils_1 = sourceUtils.getLinePos;
var sourceUtils_2 = sourceUtils.getLine;
var sourceUtils_3 = sourceUtils.getPrettyContext;

var Range_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  class Range {
    static copy(orig) {
      return new Range(orig.start, orig.end);
    }

    constructor(start, end) {
      this.start = start;
      this.end = end || start;
    }

    isEmpty() {
      return typeof this.start !== 'number' || !this.end || this.end <= this.start;
    }
    /**
     * Set `origStart` and `origEnd` to point to the original source range for
     * this node, which may differ due to dropped CR characters.
     *
     * @param {number[]} cr - Positions of dropped CR characters
     * @param {number} offset - Starting index of `cr` from the last call
     * @returns {number} - The next offset, matching the one found for `origStart`
     */


    setOrigRange(cr, offset) {
      const {
        start,
        end
      } = this;

      if (cr.length === 0 || end <= cr[0]) {
        this.origStart = start;
        this.origEnd = end;
        return offset;
      }

      let i = offset;

      while (i < cr.length) {
        if (cr[i] > start) break;else ++i;
      }

      this.origStart = start + i;
      const nextOffset = i;

      while (i < cr.length) {
        // if end was at \n, it should now be at \r
        if (cr[i] >= end) break;else ++i;
      }

      this.origEnd = end + i;
      return nextOffset;
    }

  }

  exports.default = Range;
});
unwrapExports(Range_1);

var Node_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }
  /** Root class of all nodes */


  class Node {
    static addStringTerminator(src, offset, str) {
      if (str[str.length - 1] === '\n') return str;
      const next = Node.endOfWhiteSpace(src, offset);
      return next >= src.length || src[next] === '\n' ? str + '\n' : str;
    } // ^(---|...)


    static atDocumentBoundary(src, offset, sep) {
      const ch0 = src[offset];
      if (!ch0) return true;
      const prev = src[offset - 1];
      if (prev && prev !== '\n') return false;

      if (sep) {
        if (ch0 !== sep) return false;
      } else {
        if (ch0 !== constants.Char.DIRECTIVES_END && ch0 !== constants.Char.DOCUMENT_END) return false;
      }

      const ch1 = src[offset + 1];
      const ch2 = src[offset + 2];
      if (ch1 !== ch0 || ch2 !== ch0) return false;
      const ch3 = src[offset + 3];
      return !ch3 || ch3 === '\n' || ch3 === '\t' || ch3 === ' ';
    }

    static endOfIdentifier(src, offset) {
      let ch = src[offset];
      const isVerbatim = ch === '<';
      const notOk = isVerbatim ? ['\n', '\t', ' ', '>'] : ['\n', '\t', ' ', '[', ']', '{', '}', ','];

      while (ch && notOk.indexOf(ch) === -1) ch = src[offset += 1];

      if (isVerbatim && ch === '>') offset += 1;
      return offset;
    }

    static endOfIndent(src, offset) {
      let ch = src[offset];

      while (ch === ' ') ch = src[offset += 1];

      return offset;
    }

    static endOfLine(src, offset) {
      let ch = src[offset];

      while (ch && ch !== '\n') ch = src[offset += 1];

      return offset;
    }

    static endOfWhiteSpace(src, offset) {
      let ch = src[offset];

      while (ch === '\t' || ch === ' ') ch = src[offset += 1];

      return offset;
    }

    static startOfLine(src, offset) {
      let ch = src[offset - 1];
      if (ch === '\n') return offset;

      while (ch && ch !== '\n') ch = src[offset -= 1];

      return offset + 1;
    }
    /**
     * End of indentation, or null if the line's indent level is not more
     * than `indent`
     *
     * @param {string} src
     * @param {number} indent
     * @param {number} lineStart
     * @returns {?number}
     */


    static endOfBlockIndent(src, indent, lineStart) {
      const inEnd = Node.endOfIndent(src, lineStart);

      if (inEnd > lineStart + indent) {
        return inEnd;
      } else {
        const wsEnd = Node.endOfWhiteSpace(src, inEnd);
        const ch = src[wsEnd];
        if (!ch || ch === '\n') return wsEnd;
      }

      return null;
    }

    static atBlank(src, offset, endAsBlank) {
      const ch = src[offset];
      return ch === '\n' || ch === '\t' || ch === ' ' || endAsBlank && !ch;
    }

    static nextNodeIsIndented(ch, indentDiff, indicatorAsIndent) {
      if (!ch || indentDiff < 0) return false;
      if (indentDiff > 0) return true;
      return indicatorAsIndent && ch === '-';
    } // should be at line or string end, or at next non-whitespace char


    static normalizeOffset(src, offset) {
      const ch = src[offset];
      return !ch ? offset : ch !== '\n' && src[offset - 1] === '\n' ? offset - 1 : Node.endOfWhiteSpace(src, offset);
    } // fold single newline into space, multiple newlines to N - 1 newlines
    // presumes src[offset] === '\n'


    static foldNewline(src, offset, indent) {
      let inCount = 0;
      let error = false;
      let fold = '';
      let ch = src[offset + 1];

      while (ch === ' ' || ch === '\t' || ch === '\n') {
        switch (ch) {
          case '\n':
            inCount = 0;
            offset += 1;
            fold += '\n';
            break;

          case '\t':
            if (inCount <= indent) error = true;
            offset = Node.endOfWhiteSpace(src, offset + 2) - 1;
            break;

          case ' ':
            inCount += 1;
            offset += 1;
            break;
        }

        ch = src[offset + 1];
      }

      if (!fold) fold = ' ';
      if (ch && inCount <= indent) error = true;
      return {
        fold,
        offset,
        error
      };
    }

    constructor(type, props, context) {
      Object.defineProperty(this, 'context', {
        value: context || null,
        writable: true
      });
      this.error = null;
      this.range = null;
      this.valueRange = null;
      this.props = props || [];
      this.type = type;
      this.value = null;
    }

    getPropValue(idx, key, skipKey) {
      if (!this.context) return null;
      const {
        src
      } = this.context;
      const prop = this.props[idx];
      return prop && src[prop.start] === key ? src.slice(prop.start + (skipKey ? 1 : 0), prop.end) : null;
    }

    get anchor() {
      for (let i = 0; i < this.props.length; ++i) {
        const anchor = this.getPropValue(i, constants.Char.ANCHOR, true);
        if (anchor != null) return anchor;
      }

      return null;
    }

    get comment() {
      const comments = [];

      for (let i = 0; i < this.props.length; ++i) {
        const comment = this.getPropValue(i, constants.Char.COMMENT, true);
        if (comment != null) comments.push(comment);
      }

      return comments.length > 0 ? comments.join('\n') : null;
    }

    commentHasRequiredWhitespace(start) {
      const {
        src
      } = this.context;
      if (this.header && start === this.header.end) return false;
      if (!this.valueRange) return false;
      const {
        end
      } = this.valueRange;
      return start !== end || Node.atBlank(src, end - 1);
    }

    get hasComment() {
      if (this.context) {
        const {
          src
        } = this.context;

        for (let i = 0; i < this.props.length; ++i) {
          if (src[this.props[i].start] === constants.Char.COMMENT) return true;
        }
      }

      return false;
    }

    get hasProps() {
      if (this.context) {
        const {
          src
        } = this.context;

        for (let i = 0; i < this.props.length; ++i) {
          if (src[this.props[i].start] !== constants.Char.COMMENT) return true;
        }
      }

      return false;
    }

    get includesTrailingLines() {
      return false;
    }

    get jsonLike() {
      const jsonLikeTypes = [constants.Type.FLOW_MAP, constants.Type.FLOW_SEQ, constants.Type.QUOTE_DOUBLE, constants.Type.QUOTE_SINGLE];
      return jsonLikeTypes.indexOf(this.type) !== -1;
    }

    get rangeAsLinePos() {
      if (!this.range || !this.context) return undefined;
      const start = (0, sourceUtils.getLinePos)(this.range.start, this.context.root);
      if (!start) return undefined;
      const end = (0, sourceUtils.getLinePos)(this.range.end, this.context.root);
      return {
        start,
        end
      };
    }

    get rawValue() {
      if (!this.valueRange || !this.context) return null;
      const {
        start,
        end
      } = this.valueRange;
      return this.context.src.slice(start, end);
    }

    get tag() {
      for (let i = 0; i < this.props.length; ++i) {
        const tag = this.getPropValue(i, constants.Char.TAG, false);

        if (tag != null) {
          if (tag[1] === '<') {
            return {
              verbatim: tag.slice(2, -1)
            };
          } else {
            // eslint-disable-next-line no-unused-vars
            const [_, handle, suffix] = tag.match(/^(.*!)([^!]*)$/);
            return {
              handle,
              suffix
            };
          }
        }
      }

      return null;
    }

    get valueRangeContainsNewline() {
      if (!this.valueRange || !this.context) return false;
      const {
        start,
        end
      } = this.valueRange;
      const {
        src
      } = this.context;

      for (let i = start; i < end; ++i) {
        if (src[i] === '\n') return true;
      }

      return false;
    }

    parseComment(start) {
      const {
        src
      } = this.context;

      if (src[start] === constants.Char.COMMENT) {
        const end = Node.endOfLine(src, start + 1);
        const commentRange = new _Range.default(start, end);
        this.props.push(commentRange);
        return end;
      }

      return start;
    }
    /**
     * Populates the `origStart` and `origEnd` values of all ranges for this
     * node. Extended by child classes to handle descendant nodes.
     *
     * @param {number[]} cr - Positions of dropped CR characters
     * @param {number} offset - Starting index of `cr` from the last call
     * @returns {number} - The next offset, matching the one found for `origStart`
     */


    setOrigRanges(cr, offset) {
      if (this.range) offset = this.range.setOrigRange(cr, offset);
      if (this.valueRange) this.valueRange.setOrigRange(cr, offset);
      this.props.forEach(prop => prop.setOrigRange(cr, offset));
      return offset;
    }

    toString() {
      const {
        context: {
          src
        },
        range,
        value
      } = this;
      if (value != null) return value;
      const str = src.slice(range.start, range.end);
      return Node.addStringTerminator(src, range.end, str);
    }

  }

  exports.default = Node;
});
unwrapExports(Node_1);

var errors = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.YAMLWarning = exports.YAMLSyntaxError = exports.YAMLSemanticError = exports.YAMLReferenceError = exports.YAMLError = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class YAMLError extends Error {
    constructor(name, source, message) {
      if (!message || !(source instanceof _Node.default)) throw new Error(`Invalid arguments for new ${name}`);
      super();
      this.name = name;
      this.message = message;
      this.source = source;
    }

    makePretty() {
      if (!this.source) return;
      this.nodeType = this.source.type;
      const cst = this.source.context && this.source.context.root;

      if (typeof this.offset === 'number') {
        this.range = new _Range.default(this.offset, this.offset + 1);
        const start = cst && (0, sourceUtils.getLinePos)(this.offset, cst);

        if (start) {
          const end = {
            line: start.line,
            col: start.col + 1
          };
          this.linePos = {
            start,
            end
          };
        }

        delete this.offset;
      } else {
        this.range = this.source.range;
        this.linePos = this.source.rangeAsLinePos;
      }

      if (this.linePos) {
        const {
          line,
          col
        } = this.linePos.start;
        this.message += ` at line ${line}, column ${col}`;
        const ctx = cst && (0, sourceUtils.getPrettyContext)(this.linePos, cst);
        if (ctx) this.message += `:\n\n${ctx}\n`;
      }

      delete this.source;
    }

  }

  exports.YAMLError = YAMLError;

  class YAMLReferenceError extends YAMLError {
    constructor(source, message) {
      super('YAMLReferenceError', source, message);
    }

  }

  exports.YAMLReferenceError = YAMLReferenceError;

  class YAMLSemanticError extends YAMLError {
    constructor(source, message) {
      super('YAMLSemanticError', source, message);
    }

  }

  exports.YAMLSemanticError = YAMLSemanticError;

  class YAMLSyntaxError extends YAMLError {
    constructor(source, message) {
      super('YAMLSyntaxError', source, message);
    }

  }

  exports.YAMLSyntaxError = YAMLSyntaxError;

  class YAMLWarning extends YAMLError {
    constructor(source, message) {
      super('YAMLWarning', source, message);
    }

  }

  exports.YAMLWarning = YAMLWarning;
});
unwrapExports(errors);
var errors_1 = errors.YAMLWarning;
var errors_2 = errors.YAMLSyntaxError;
var errors_3 = errors.YAMLSemanticError;
var errors_4 = errors.YAMLReferenceError;
var errors_5 = errors.YAMLError;

var BlankLine_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class BlankLine extends _Node.default {
    constructor() {
      super(constants.Type.BLANK_LINE);
    }
    /* istanbul ignore next */


    get includesTrailingLines() {
      // This is never called from anywhere, but if it were,
      // this is the value it should return.
      return true;
    }
    /**
     * Parses blank lines from the source
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first \n character
     * @returns {number} - Index of the character after this
     */


    parse(context, start) {
      this.context = context;
      const {
        src
      } = context;
      let offset = start + 1;

      while (_Node.default.atBlank(src, offset)) {
        const lineEnd = _Node.default.endOfWhiteSpace(src, offset);

        if (lineEnd === '\n') offset = lineEnd + 1;else break;
      }

      this.range = new _Range.default(start, offset);
      return offset;
    }

  }

  exports.default = BlankLine;
});
unwrapExports(BlankLine_1);

var CollectionItem_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _BlankLine = _interopRequireDefault(BlankLine_1);

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class CollectionItem extends _Node.default {
    constructor(type, props) {
      super(type, props);
      this.node = null;
    }

    get includesTrailingLines() {
      return !!this.node && this.node.includesTrailingLines;
    }
    /**
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this
     */


    parse(context, start) {
      this.context = context;
      const {
        parseNode,
        src
      } = context;
      let {
        atLineStart,
        lineStart
      } = context;
      if (!atLineStart && this.type === constants.Type.SEQ_ITEM) this.error = new errors.YAMLSemanticError(this, 'Sequence items must not have preceding content on the same line');
      const indent = atLineStart ? start - lineStart : context.indent;

      let offset = _Node.default.endOfWhiteSpace(src, start + 1);

      let ch = src[offset];
      const inlineComment = ch === '#';
      const comments = [];
      let blankLine = null;

      while (ch === '\n' || ch === '#') {
        if (ch === '#') {
          const end = _Node.default.endOfLine(src, offset + 1);

          comments.push(new _Range.default(offset, end));
          offset = end;
        } else {
          atLineStart = true;
          lineStart = offset + 1;

          const wsEnd = _Node.default.endOfWhiteSpace(src, lineStart);

          if (src[wsEnd] === '\n' && comments.length === 0) {
            blankLine = new _BlankLine.default();
            lineStart = blankLine.parse({
              src
            }, lineStart);
          }

          offset = _Node.default.endOfIndent(src, lineStart);
        }

        ch = src[offset];
      }

      if (_Node.default.nextNodeIsIndented(ch, offset - (lineStart + indent), this.type !== constants.Type.SEQ_ITEM)) {
        this.node = parseNode({
          atLineStart,
          inCollection: false,
          indent,
          lineStart,
          parent: this
        }, offset);
      } else if (ch && lineStart > start + 1) {
        offset = lineStart - 1;
      }

      if (this.node) {
        if (blankLine) {
          // Only blank lines preceding non-empty nodes are captured. Note that
          // this means that collection item range start indices do not always
          // increase monotonically. -- eemeli/yaml#126
          const items = context.parent.items || context.parent.contents;
          if (items) items.push(blankLine);
        }

        if (comments.length) Array.prototype.push.apply(this.props, comments);
        offset = this.node.range.end;
      } else {
        if (inlineComment) {
          const c = comments[0];
          this.props.push(c);
          offset = c.end;
        } else {
          offset = _Node.default.endOfLine(src, start + 1);
        }
      }

      const end = this.node ? this.node.valueRange.end : offset;
      this.valueRange = new _Range.default(start, end);
      return offset;
    }

    setOrigRanges(cr, offset) {
      offset = super.setOrigRanges(cr, offset);
      return this.node ? this.node.setOrigRanges(cr, offset) : offset;
    }

    toString() {
      const {
        context: {
          src
        },
        node,
        range,
        value
      } = this;
      if (value != null) return value;
      const str = node ? src.slice(range.start, node.range.start) + String(node) : src.slice(range.start, range.end);
      return _Node.default.addStringTerminator(src, range.end, str);
    }

  }

  exports.default = CollectionItem;
});
unwrapExports(CollectionItem_1);

var Comment_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class Comment extends _Node.default {
    constructor() {
      super(constants.Type.COMMENT);
    }
    /**
     * Parses a comment line from the source
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this scalar
     */


    parse(context, start) {
      this.context = context;
      const offset = this.parseComment(start);
      this.range = new _Range.default(start, offset);
      return offset;
    }

  }

  exports.default = Comment;
});
unwrapExports(Comment_1);

var Collection_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.grabCollectionEndComments = grabCollectionEndComments;
  exports.default = void 0;

  var _BlankLine = _interopRequireDefault(BlankLine_1);

  var _CollectionItem = _interopRequireDefault(CollectionItem_1);

  var _Comment = _interopRequireDefault(Comment_1);

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function grabCollectionEndComments(node) {
    let cnode = node;

    while (cnode instanceof _CollectionItem.default) cnode = cnode.node;

    if (!(cnode instanceof Collection)) return null;
    const len = cnode.items.length;
    let ci = -1;

    for (let i = len - 1; i >= 0; --i) {
      const n = cnode.items[i];

      if (n.type === constants.Type.COMMENT) {
        // Keep sufficiently indented comments with preceding node
        const {
          indent,
          lineStart
        } = n.context;
        if (indent > 0 && n.range.start >= lineStart + indent) break;
        ci = i;
      } else if (n.type === constants.Type.BLANK_LINE) ci = i;else break;
    }

    if (ci === -1) return null;
    const ca = cnode.items.splice(ci, len - ci);
    const prevEnd = ca[0].range.start;

    while (true) {
      cnode.range.end = prevEnd;
      if (cnode.valueRange && cnode.valueRange.end > prevEnd) cnode.valueRange.end = prevEnd;
      if (cnode === node) break;
      cnode = cnode.context.parent;
    }

    return ca;
  }

  class Collection extends _Node.default {
    static nextContentHasIndent(src, offset, indent) {
      const lineStart = _Node.default.endOfLine(src, offset) + 1;
      offset = _Node.default.endOfWhiteSpace(src, lineStart);
      const ch = src[offset];
      if (!ch) return false;
      if (offset >= lineStart + indent) return true;
      if (ch !== '#' && ch !== '\n') return false;
      return Collection.nextContentHasIndent(src, offset, indent);
    }

    constructor(firstItem) {
      super(firstItem.type === constants.Type.SEQ_ITEM ? constants.Type.SEQ : constants.Type.MAP);

      for (let i = firstItem.props.length - 1; i >= 0; --i) {
        if (firstItem.props[i].start < firstItem.context.lineStart) {
          // props on previous line are assumed by the collection
          this.props = firstItem.props.slice(0, i + 1);
          firstItem.props = firstItem.props.slice(i + 1);
          const itemRange = firstItem.props[0] || firstItem.valueRange;
          firstItem.range.start = itemRange.start;
          break;
        }
      }

      this.items = [firstItem];
      const ec = grabCollectionEndComments(firstItem);
      if (ec) Array.prototype.push.apply(this.items, ec);
    }

    get includesTrailingLines() {
      return this.items.length > 0;
    }
    /**
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this
     */


    parse(context, start) {
      this.context = context;
      const {
        parseNode,
        src
      } = context; // It's easier to recalculate lineStart here rather than tracking down the
      // last context from which to read it -- eemeli/yaml#2

      let lineStart = _Node.default.startOfLine(src, start);

      const firstItem = this.items[0]; // First-item context needs to be correct for later comment handling
      // -- eemeli/yaml#17

      firstItem.context.parent = this;
      this.valueRange = _Range.default.copy(firstItem.valueRange);
      const indent = firstItem.range.start - firstItem.context.lineStart;
      let offset = start;
      offset = _Node.default.normalizeOffset(src, offset);
      let ch = src[offset];
      let atLineStart = _Node.default.endOfWhiteSpace(src, lineStart) === offset;
      let prevIncludesTrailingLines = false;

      while (ch) {
        while (ch === '\n' || ch === '#') {
          if (atLineStart && ch === '\n' && !prevIncludesTrailingLines) {
            const blankLine = new _BlankLine.default();
            offset = blankLine.parse({
              src
            }, offset);
            this.valueRange.end = offset;

            if (offset >= src.length) {
              ch = null;
              break;
            }

            this.items.push(blankLine);
            offset -= 1; // blankLine.parse() consumes terminal newline
          } else if (ch === '#') {
            if (offset < lineStart + indent && !Collection.nextContentHasIndent(src, offset, indent)) {
              return offset;
            }

            const comment = new _Comment.default();
            offset = comment.parse({
              indent,
              lineStart,
              src
            }, offset);
            this.items.push(comment);
            this.valueRange.end = offset;

            if (offset >= src.length) {
              ch = null;
              break;
            }
          }

          lineStart = offset + 1;
          offset = _Node.default.endOfIndent(src, lineStart);

          if (_Node.default.atBlank(src, offset)) {
            const wsEnd = _Node.default.endOfWhiteSpace(src, offset);

            const next = src[wsEnd];

            if (!next || next === '\n' || next === '#') {
              offset = wsEnd;
            }
          }

          ch = src[offset];
          atLineStart = true;
        }

        if (!ch) {
          break;
        }

        if (offset !== lineStart + indent && (atLineStart || ch !== ':')) {
          if (lineStart > start) offset = lineStart;
          break;
        }

        if (firstItem.type === constants.Type.SEQ_ITEM !== (ch === '-')) {
          let typeswitch = true;

          if (ch === '-') {
            // map key may start with -, as long as it's followed by a non-whitespace char
            const next = src[offset + 1];
            typeswitch = !next || next === '\n' || next === '\t' || next === ' ';
          }

          if (typeswitch) {
            if (lineStart > start) offset = lineStart;
            break;
          }
        }

        const node = parseNode({
          atLineStart,
          inCollection: true,
          indent,
          lineStart,
          parent: this
        }, offset);
        if (!node) return offset; // at next document start

        this.items.push(node);
        this.valueRange.end = node.valueRange.end;
        offset = _Node.default.normalizeOffset(src, node.range.end);
        ch = src[offset];
        atLineStart = false;
        prevIncludesTrailingLines = node.includesTrailingLines; // Need to reset lineStart and atLineStart here if preceding node's range
        // has advanced to check the current line's indentation level
        // -- eemeli/yaml#10 & eemeli/yaml#38

        if (ch) {
          let ls = offset - 1;
          let prev = src[ls];

          while (prev === ' ' || prev === '\t') prev = src[--ls];

          if (prev === '\n') {
            lineStart = ls + 1;
            atLineStart = true;
          }
        }

        const ec = grabCollectionEndComments(node);
        if (ec) Array.prototype.push.apply(this.items, ec);
      }

      return offset;
    }

    setOrigRanges(cr, offset) {
      offset = super.setOrigRanges(cr, offset);
      this.items.forEach(node => {
        offset = node.setOrigRanges(cr, offset);
      });
      return offset;
    }

    toString() {
      const {
        context: {
          src
        },
        items,
        range,
        value
      } = this;
      if (value != null) return value;
      let str = src.slice(range.start, items[0].range.start) + String(items[0]);

      for (let i = 1; i < items.length; ++i) {
        const item = items[i];
        const {
          atLineStart,
          indent
        } = item.context;
        if (atLineStart) for (let i = 0; i < indent; ++i) str += ' ';
        str += String(item);
      }

      return _Node.default.addStringTerminator(src, range.end, str);
    }

  }

  exports.default = Collection;
});
unwrapExports(Collection_1);
var Collection_2 = Collection_1.grabCollectionEndComments;

var Directive_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class Directive extends _Node.default {
    constructor() {
      super(constants.Type.DIRECTIVE);
      this.name = null;
    }

    get parameters() {
      const raw = this.rawValue;
      return raw ? raw.trim().split(/[ \t]+/) : [];
    }

    parseName(start) {
      const {
        src
      } = this.context;
      let offset = start;
      let ch = src[offset];

      while (ch && ch !== '\n' && ch !== '\t' && ch !== ' ') ch = src[offset += 1];

      this.name = src.slice(start, offset);
      return offset;
    }

    parseParameters(start) {
      const {
        src
      } = this.context;
      let offset = start;
      let ch = src[offset];

      while (ch && ch !== '\n' && ch !== '#') ch = src[offset += 1];

      this.valueRange = new _Range.default(start, offset);
      return offset;
    }

    parse(context, start) {
      this.context = context;
      let offset = this.parseName(start + 1);
      offset = this.parseParameters(offset);
      offset = this.parseComment(offset);
      this.range = new _Range.default(start, offset);
      return offset;
    }

  }

  exports.default = Directive;
});
unwrapExports(Directive_1);

var Document_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _BlankLine = _interopRequireDefault(BlankLine_1);

  var _Comment = _interopRequireDefault(Comment_1);

  var _Directive = _interopRequireDefault(Directive_1);

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class Document extends _Node.default {
    static startCommentOrEndBlankLine(src, start) {
      const offset = _Node.default.endOfWhiteSpace(src, start);

      const ch = src[offset];
      return ch === '#' || ch === '\n' ? offset : start;
    }

    constructor() {
      super(constants.Type.DOCUMENT);
      this.directives = null;
      this.contents = null;
      this.directivesEndMarker = null;
      this.documentEndMarker = null;
    }

    parseDirectives(start) {
      const {
        src
      } = this.context;
      this.directives = [];
      let atLineStart = true;
      let hasDirectives = false;
      let offset = start;

      while (!_Node.default.atDocumentBoundary(src, offset, constants.Char.DIRECTIVES_END)) {
        offset = Document.startCommentOrEndBlankLine(src, offset);

        switch (src[offset]) {
          case '\n':
            if (atLineStart) {
              const blankLine = new _BlankLine.default();
              offset = blankLine.parse({
                src
              }, offset);

              if (offset < src.length) {
                this.directives.push(blankLine);
              }
            } else {
              offset += 1;
              atLineStart = true;
            }

            break;

          case '#':
            {
              const comment = new _Comment.default();
              offset = comment.parse({
                src
              }, offset);
              this.directives.push(comment);
              atLineStart = false;
            }
            break;

          case '%':
            {
              const directive = new _Directive.default();
              offset = directive.parse({
                parent: this,
                src
              }, offset);
              this.directives.push(directive);
              hasDirectives = true;
              atLineStart = false;
            }
            break;

          default:
            if (hasDirectives) {
              this.error = new errors.YAMLSemanticError(this, 'Missing directives-end indicator line');
            } else if (this.directives.length > 0) {
              this.contents = this.directives;
              this.directives = [];
            }

            return offset;
        }
      }

      if (src[offset]) {
        this.directivesEndMarker = new _Range.default(offset, offset + 3);
        return offset + 3;
      }

      if (hasDirectives) {
        this.error = new errors.YAMLSemanticError(this, 'Missing directives-end indicator line');
      } else if (this.directives.length > 0) {
        this.contents = this.directives;
        this.directives = [];
      }

      return offset;
    }

    parseContents(start) {
      const {
        parseNode,
        src
      } = this.context;
      if (!this.contents) this.contents = [];
      let lineStart = start;

      while (src[lineStart - 1] === '-') lineStart -= 1;

      let offset = _Node.default.endOfWhiteSpace(src, start);

      let atLineStart = lineStart === start;
      this.valueRange = new _Range.default(offset);

      while (!_Node.default.atDocumentBoundary(src, offset, constants.Char.DOCUMENT_END)) {
        switch (src[offset]) {
          case '\n':
            if (atLineStart) {
              const blankLine = new _BlankLine.default();
              offset = blankLine.parse({
                src
              }, offset);

              if (offset < src.length) {
                this.contents.push(blankLine);
              }
            } else {
              offset += 1;
              atLineStart = true;
            }

            lineStart = offset;
            break;

          case '#':
            {
              const comment = new _Comment.default();
              offset = comment.parse({
                src
              }, offset);
              this.contents.push(comment);
              atLineStart = false;
            }
            break;

          default:
            {
              const iEnd = _Node.default.endOfIndent(src, offset);

              const context = {
                atLineStart,
                indent: -1,
                inFlow: false,
                inCollection: false,
                lineStart,
                parent: this
              };
              const node = parseNode(context, iEnd);
              if (!node) return this.valueRange.end = iEnd; // at next document start

              this.contents.push(node);
              offset = node.range.end;
              atLineStart = false;
              const ec = (0, Collection_1.grabCollectionEndComments)(node);
              if (ec) Array.prototype.push.apply(this.contents, ec);
            }
        }

        offset = Document.startCommentOrEndBlankLine(src, offset);
      }

      this.valueRange.end = offset;

      if (src[offset]) {
        this.documentEndMarker = new _Range.default(offset, offset + 3);
        offset += 3;

        if (src[offset]) {
          offset = _Node.default.endOfWhiteSpace(src, offset);

          if (src[offset] === '#') {
            const comment = new _Comment.default();
            offset = comment.parse({
              src
            }, offset);
            this.contents.push(comment);
          }

          switch (src[offset]) {
            case '\n':
              offset += 1;
              break;

            case undefined:
              break;

            default:
              this.error = new errors.YAMLSyntaxError(this, 'Document end marker line cannot have a non-comment suffix');
          }
        }
      }

      return offset;
    }
    /**
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this
     */


    parse(context, start) {
      context.root = this;
      this.context = context;
      const {
        src
      } = context;
      let offset = src.charCodeAt(start) === 0xfeff ? start + 1 : start; // skip BOM

      offset = this.parseDirectives(offset);
      offset = this.parseContents(offset);
      return offset;
    }

    setOrigRanges(cr, offset) {
      offset = super.setOrigRanges(cr, offset);
      this.directives.forEach(node => {
        offset = node.setOrigRanges(cr, offset);
      });
      if (this.directivesEndMarker) offset = this.directivesEndMarker.setOrigRange(cr, offset);
      this.contents.forEach(node => {
        offset = node.setOrigRanges(cr, offset);
      });
      if (this.documentEndMarker) offset = this.documentEndMarker.setOrigRange(cr, offset);
      return offset;
    }

    toString() {
      const {
        contents,
        directives,
        value
      } = this;
      if (value != null) return value;
      let str = directives.join('');

      if (contents.length > 0) {
        if (directives.length > 0 || contents[0].type === constants.Type.COMMENT) str += '---\n';
        str += contents.join('');
      }

      if (str[str.length - 1] !== '\n') str += '\n';
      return str;
    }

  }

  exports.default = Document;
});
unwrapExports(Document_1);

var Alias_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class Alias extends _Node.default {
    /**
     * Parses an *alias from the source
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this scalar
     */
    parse(context, start) {
      this.context = context;
      const {
        src
      } = context;

      let offset = _Node.default.endOfIdentifier(src, start + 1);

      this.valueRange = new _Range.default(start + 1, offset);
      offset = _Node.default.endOfWhiteSpace(src, offset);
      offset = this.parseComment(offset);
      return offset;
    }

  }

  exports.default = Alias;
});
unwrapExports(Alias_1);

var BlockValue_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.Chomp = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const Chomp = {
    CLIP: 'CLIP',
    KEEP: 'KEEP',
    STRIP: 'STRIP'
  };
  exports.Chomp = Chomp;

  class BlockValue extends _Node.default {
    constructor(type, props) {
      super(type, props);
      this.blockIndent = null;
      this.chomping = Chomp.CLIP;
      this.header = null;
    }

    get includesTrailingLines() {
      return this.chomping === Chomp.KEEP;
    }

    get strValue() {
      if (!this.valueRange || !this.context) return null;
      let {
        start,
        end
      } = this.valueRange;
      const {
        indent,
        src
      } = this.context;
      if (this.valueRange.isEmpty()) return '';
      let lastNewLine = null;
      let ch = src[end - 1];

      while (ch === '\n' || ch === '\t' || ch === ' ') {
        end -= 1;

        if (end <= start) {
          if (this.chomping === Chomp.KEEP) break;else return ''; // probably never happens
        }

        if (ch === '\n') lastNewLine = end;
        ch = src[end - 1];
      }

      let keepStart = end + 1;

      if (lastNewLine) {
        if (this.chomping === Chomp.KEEP) {
          keepStart = lastNewLine;
          end = this.valueRange.end;
        } else {
          end = lastNewLine;
        }
      }

      const bi = indent + this.blockIndent;
      const folded = this.type === constants.Type.BLOCK_FOLDED;
      let atStart = true;
      let str = '';
      let sep = '';
      let prevMoreIndented = false;

      for (let i = start; i < end; ++i) {
        for (let j = 0; j < bi; ++j) {
          if (src[i] !== ' ') break;
          i += 1;
        }

        const ch = src[i];

        if (ch === '\n') {
          if (sep === '\n') str += '\n';else sep = '\n';
        } else {
          const lineEnd = _Node.default.endOfLine(src, i);

          const line = src.slice(i, lineEnd);
          i = lineEnd;

          if (folded && (ch === ' ' || ch === '\t') && i < keepStart) {
            if (sep === ' ') sep = '\n';else if (!prevMoreIndented && !atStart && sep === '\n') sep = '\n\n';
            str += sep + line; //+ ((lineEnd < end && src[lineEnd]) || '')

            sep = lineEnd < end && src[lineEnd] || '';
            prevMoreIndented = true;
          } else {
            str += sep + line;
            sep = folded && i < keepStart ? ' ' : '\n';
            prevMoreIndented = false;
          }

          if (atStart && line !== '') atStart = false;
        }
      }

      return this.chomping === Chomp.STRIP ? str : str + '\n';
    }

    parseBlockHeader(start) {
      const {
        src
      } = this.context;
      let offset = start + 1;
      let bi = '';

      while (true) {
        const ch = src[offset];

        switch (ch) {
          case '-':
            this.chomping = Chomp.STRIP;
            break;

          case '+':
            this.chomping = Chomp.KEEP;
            break;

          case '0':
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            bi += ch;
            break;

          default:
            this.blockIndent = Number(bi) || null;
            this.header = new _Range.default(start, offset);
            return offset;
        }

        offset += 1;
      }
    }

    parseBlockValue(start) {
      const {
        indent,
        src
      } = this.context;
      let offset = start;
      let valueEnd = start;
      let bi = this.blockIndent ? indent + this.blockIndent - 1 : indent;
      let minBlockIndent = 1;

      for (let ch = src[offset]; ch === '\n'; ch = src[offset]) {
        offset += 1;
        if (_Node.default.atDocumentBoundary(src, offset)) break;

        const end = _Node.default.endOfBlockIndent(src, bi, offset); // should not include tab?


        if (end === null) break;

        if (!this.blockIndent) {
          // no explicit block indent, none yet detected
          const lineIndent = end - (offset + indent);

          if (src[end] !== '\n') {
            // first line with non-whitespace content
            if (lineIndent < minBlockIndent) {
              offset -= 1;
              break;
            }

            this.blockIndent = lineIndent;
            bi = indent + this.blockIndent - 1;
          } else if (lineIndent > minBlockIndent) {
            // empty line with more whitespace
            minBlockIndent = lineIndent;
          }
        }

        if (src[end] === '\n') {
          offset = end;
        } else {
          offset = valueEnd = _Node.default.endOfLine(src, end);
        }
      }

      if (this.chomping !== Chomp.KEEP) {
        offset = src[valueEnd] ? valueEnd + 1 : valueEnd;
      }

      this.valueRange = new _Range.default(start + 1, offset);
      return offset;
    }
    /**
     * Parses a block value from the source
     *
     * Accepted forms are:
     * ```
     * BS
     * block
     * lines
     *
     * BS #comment
     * block
     * lines
     * ```
     * where the block style BS matches the regexp `[|>][-+1-9]*` and block lines
     * are empty or have an indent level greater than `indent`.
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this block
     */


    parse(context, start) {
      this.context = context;
      const {
        src
      } = context;
      let offset = this.parseBlockHeader(start);
      offset = _Node.default.endOfWhiteSpace(src, offset);
      offset = this.parseComment(offset);
      offset = this.parseBlockValue(offset);
      return offset;
    }

    setOrigRanges(cr, offset) {
      offset = super.setOrigRanges(cr, offset);
      return this.header ? this.header.setOrigRange(cr, offset) : offset;
    }

  }

  exports.default = BlockValue;
});
unwrapExports(BlockValue_1);
var BlockValue_2 = BlockValue_1.Chomp;

var FlowCollection_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _BlankLine = _interopRequireDefault(BlankLine_1);

  var _Comment = _interopRequireDefault(Comment_1);

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class FlowCollection extends _Node.default {
    constructor(type, props) {
      super(type, props);
      this.items = null;
    }

    prevNodeIsJsonLike(idx = this.items.length) {
      const node = this.items[idx - 1];
      return !!node && (node.jsonLike || node.type === constants.Type.COMMENT && this.nodeIsJsonLike(idx - 1));
    }
    /**
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this
     */


    parse(context, start) {
      this.context = context;
      const {
        parseNode,
        src
      } = context;
      let {
        indent,
        lineStart
      } = context;
      let char = src[start]; // { or [

      this.items = [{
        char,
        offset: start
      }];

      let offset = _Node.default.endOfWhiteSpace(src, start + 1);

      char = src[offset];

      while (char && char !== ']' && char !== '}') {
        switch (char) {
          case '\n':
            {
              lineStart = offset + 1;

              const wsEnd = _Node.default.endOfWhiteSpace(src, lineStart);

              if (src[wsEnd] === '\n') {
                const blankLine = new _BlankLine.default();
                lineStart = blankLine.parse({
                  src
                }, lineStart);
                this.items.push(blankLine);
              }

              offset = _Node.default.endOfIndent(src, lineStart);

              if (offset <= lineStart + indent) {
                char = src[offset];

                if (offset < lineStart + indent || char !== ']' && char !== '}') {
                  const msg = 'Insufficient indentation in flow collection';
                  this.error = new errors.YAMLSemanticError(this, msg);
                }
              }
            }
            break;

          case ',':
            {
              this.items.push({
                char,
                offset
              });
              offset += 1;
            }
            break;

          case '#':
            {
              const comment = new _Comment.default();
              offset = comment.parse({
                src
              }, offset);
              this.items.push(comment);
            }
            break;

          case '?':
          case ':':
            {
              const next = src[offset + 1];

              if (next === '\n' || next === '\t' || next === ' ' || next === ',' || // in-flow : after JSON-like key does not need to be followed by whitespace
              char === ':' && this.prevNodeIsJsonLike()) {
                this.items.push({
                  char,
                  offset
                });
                offset += 1;
                break;
              }
            }
          // fallthrough

          default:
            {
              const node = parseNode({
                atLineStart: false,
                inCollection: false,
                inFlow: true,
                indent: -1,
                lineStart,
                parent: this
              }, offset);

              if (!node) {
                // at next document start
                this.valueRange = new _Range.default(start, offset);
                return offset;
              }

              this.items.push(node);
              offset = _Node.default.normalizeOffset(src, node.range.end);
            }
        }

        offset = _Node.default.endOfWhiteSpace(src, offset);
        char = src[offset];
      }

      this.valueRange = new _Range.default(start, offset + 1);

      if (char) {
        this.items.push({
          char,
          offset
        });
        offset = _Node.default.endOfWhiteSpace(src, offset + 1);
        offset = this.parseComment(offset);
      }

      return offset;
    }

    setOrigRanges(cr, offset) {
      offset = super.setOrigRanges(cr, offset);
      this.items.forEach(node => {
        if (node instanceof _Node.default) {
          offset = node.setOrigRanges(cr, offset);
        } else if (cr.length === 0) {
          node.origOffset = node.offset;
        } else {
          let i = offset;

          while (i < cr.length) {
            if (cr[i] > node.offset) break;else ++i;
          }

          node.origOffset = node.offset + i;
          offset = i;
        }
      });
      return offset;
    }

    toString() {
      const {
        context: {
          src
        },
        items,
        range,
        value
      } = this;
      if (value != null) return value;
      const nodes = items.filter(item => item instanceof _Node.default);
      let str = '';
      let prevEnd = range.start;
      nodes.forEach(node => {
        const prefix = src.slice(prevEnd, node.range.start);
        prevEnd = node.range.end;
        str += prefix + String(node);

        if (str[str.length - 1] === '\n' && src[prevEnd - 1] !== '\n' && src[prevEnd] === '\n') {
          // Comment range does not include the terminal newline, but its
          // stringified value does. Without this fix, newlines at comment ends
          // get duplicated.
          prevEnd += 1;
        }
      });
      str += src.slice(prevEnd, range.end);
      return _Node.default.addStringTerminator(src, range.end, str);
    }

  }

  exports.default = FlowCollection;
});
unwrapExports(FlowCollection_1);

var PlainValue_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class PlainValue extends _Node.default {
    static endOfLine(src, start, inFlow) {
      let ch = src[start];
      let offset = start;

      while (ch && ch !== '\n') {
        if (inFlow && (ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === ',')) break;
        const next = src[offset + 1];
        if (ch === ':' && (!next || next === '\n' || next === '\t' || next === ' ' || inFlow && next === ',')) break;
        if ((ch === ' ' || ch === '\t') && next === '#') break;
        offset += 1;
        ch = next;
      }

      return offset;
    }

    get strValue() {
      if (!this.valueRange || !this.context) return null;
      let {
        start,
        end
      } = this.valueRange;
      const {
        src
      } = this.context;
      let ch = src[end - 1];

      while (start < end && (ch === '\n' || ch === '\t' || ch === ' ')) ch = src[--end - 1];

      ch = src[start];

      while (start < end && (ch === '\n' || ch === '\t' || ch === ' ')) ch = src[++start];

      let str = '';

      for (let i = start; i < end; ++i) {
        const ch = src[i];

        if (ch === '\n') {
          const {
            fold,
            offset
          } = _Node.default.foldNewline(src, i, -1);

          str += fold;
          i = offset;
        } else if (ch === ' ' || ch === '\t') {
          // trim trailing whitespace
          const wsStart = i;
          let next = src[i + 1];

          while (i < end && (next === ' ' || next === '\t')) {
            i += 1;
            next = src[i + 1];
          }

          if (next !== '\n') str += i > wsStart ? src.slice(wsStart, i + 1) : ch;
        } else {
          str += ch;
        }
      }

      return str;
    }

    parseBlockValue(start) {
      const {
        indent,
        inFlow,
        src
      } = this.context;
      let offset = start;
      let valueEnd = start;

      for (let ch = src[offset]; ch === '\n'; ch = src[offset]) {
        if (_Node.default.atDocumentBoundary(src, offset + 1)) break;

        const end = _Node.default.endOfBlockIndent(src, indent, offset + 1);

        if (end === null || src[end] === '#') break;

        if (src[end] === '\n') {
          offset = end;
        } else {
          valueEnd = PlainValue.endOfLine(src, end, inFlow);
          offset = valueEnd;
        }
      }

      if (this.valueRange.isEmpty()) this.valueRange.start = start;
      this.valueRange.end = valueEnd;
      return valueEnd;
    }
    /**
     * Parses a plain value from the source
     *
     * Accepted forms are:
     * ```
     * #comment
     *
     * first line
     *
     * first line #comment
     *
     * first line
     * block
     * lines
     *
     * #comment
     * block
     * lines
     * ```
     * where block lines are empty or have an indent level greater than `indent`.
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this scalar, may be `\n`
     */


    parse(context, start) {
      this.context = context;
      const {
        inFlow,
        src
      } = context;
      let offset = start;
      const ch = src[offset];

      if (ch && ch !== '#' && ch !== '\n') {
        offset = PlainValue.endOfLine(src, start, inFlow);
      }

      this.valueRange = new _Range.default(start, offset);
      offset = _Node.default.endOfWhiteSpace(src, offset);
      offset = this.parseComment(offset);

      if (!this.hasComment || this.valueRange.isEmpty()) {
        offset = this.parseBlockValue(offset);
      }

      return offset;
    }

  }

  exports.default = PlainValue;
});
unwrapExports(PlainValue_1);

var QuoteDouble_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class QuoteDouble extends _Node.default {
    static endOfQuote(src, offset) {
      let ch = src[offset];

      while (ch && ch !== '"') {
        offset += ch === '\\' ? 2 : 1;
        ch = src[offset];
      }

      return offset + 1;
    }
    /**
     * @returns {string | { str: string, errors: YAMLSyntaxError[] }}
     */


    get strValue() {
      if (!this.valueRange || !this.context) return null;
      const errors$1 = [];
      const {
        start,
        end
      } = this.valueRange;
      const {
        indent,
        src
      } = this.context;
      if (src[end - 1] !== '"') errors$1.push(new errors.YAMLSyntaxError(this, 'Missing closing "quote')); // Using String#replace is too painful with escaped newlines preceded by
      // escaped backslashes; also, this should be faster.

      let str = '';

      for (let i = start + 1; i < end - 1; ++i) {
        const ch = src[i];

        if (ch === '\n') {
          if (_Node.default.atDocumentBoundary(src, i + 1)) errors$1.push(new errors.YAMLSemanticError(this, 'Document boundary indicators are not allowed within string values'));

          const {
            fold,
            offset,
            error
          } = _Node.default.foldNewline(src, i, indent);

          str += fold;
          i = offset;
          if (error) errors$1.push(new errors.YAMLSemanticError(this, 'Multi-line double-quoted string needs to be sufficiently indented'));
        } else if (ch === '\\') {
          i += 1;

          switch (src[i]) {
            case '0':
              str += '\0';
              break;
            // null character

            case 'a':
              str += '\x07';
              break;
            // bell character

            case 'b':
              str += '\b';
              break;
            // backspace

            case 'e':
              str += '\x1b';
              break;
            // escape character

            case 'f':
              str += '\f';
              break;
            // form feed

            case 'n':
              str += '\n';
              break;
            // line feed

            case 'r':
              str += '\r';
              break;
            // carriage return

            case 't':
              str += '\t';
              break;
            // horizontal tab

            case 'v':
              str += '\v';
              break;
            // vertical tab

            case 'N':
              str += '\u0085';
              break;
            // Unicode next line

            case '_':
              str += '\u00a0';
              break;
            // Unicode non-breaking space

            case 'L':
              str += '\u2028';
              break;
            // Unicode line separator

            case 'P':
              str += '\u2029';
              break;
            // Unicode paragraph separator

            case ' ':
              str += ' ';
              break;

            case '"':
              str += '"';
              break;

            case '/':
              str += '/';
              break;

            case '\\':
              str += '\\';
              break;

            case '\t':
              str += '\t';
              break;

            case 'x':
              str += this.parseCharCode(i + 1, 2, errors$1);
              i += 2;
              break;

            case 'u':
              str += this.parseCharCode(i + 1, 4, errors$1);
              i += 4;
              break;

            case 'U':
              str += this.parseCharCode(i + 1, 8, errors$1);
              i += 8;
              break;

            case '\n':
              // skip escaped newlines, but still trim the following line
              while (src[i + 1] === ' ' || src[i + 1] === '\t') i += 1;

              break;

            default:
              errors$1.push(new errors.YAMLSyntaxError(this, `Invalid escape sequence ${src.substr(i - 1, 2)}`));
              str += '\\' + src[i];
          }
        } else if (ch === ' ' || ch === '\t') {
          // trim trailing whitespace
          const wsStart = i;
          let next = src[i + 1];

          while (next === ' ' || next === '\t') {
            i += 1;
            next = src[i + 1];
          }

          if (next !== '\n') str += i > wsStart ? src.slice(wsStart, i + 1) : ch;
        } else {
          str += ch;
        }
      }

      return errors$1.length > 0 ? {
        errors: errors$1,
        str
      } : str;
    }

    parseCharCode(offset, length, errors$1) {
      const {
        src
      } = this.context;
      const cc = src.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;

      if (isNaN(code)) {
        errors$1.push(new errors.YAMLSyntaxError(this, `Invalid escape sequence ${src.substr(offset - 2, length + 2)}`));
        return src.substr(offset - 2, length + 2);
      }

      return String.fromCodePoint(code);
    }
    /**
     * Parses a "double quoted" value from the source
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this scalar
     */


    parse(context, start) {
      this.context = context;
      const {
        src
      } = context;
      let offset = QuoteDouble.endOfQuote(src, start + 1);
      this.valueRange = new _Range.default(start, offset);
      offset = _Node.default.endOfWhiteSpace(src, offset);
      offset = this.parseComment(offset);
      return offset;
    }

  }

  exports.default = QuoteDouble;
});
unwrapExports(QuoteDouble_1);

var QuoteSingle_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Node = _interopRequireDefault(Node_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class QuoteSingle extends _Node.default {
    static endOfQuote(src, offset) {
      let ch = src[offset];

      while (ch) {
        if (ch === "'") {
          if (src[offset + 1] !== "'") break;
          ch = src[offset += 2];
        } else {
          ch = src[offset += 1];
        }
      }

      return offset + 1;
    }
    /**
     * @returns {string | { str: string, errors: YAMLSyntaxError[] }}
     */


    get strValue() {
      if (!this.valueRange || !this.context) return null;
      const errors$1 = [];
      const {
        start,
        end
      } = this.valueRange;
      const {
        indent,
        src
      } = this.context;
      if (src[end - 1] !== "'") errors$1.push(new errors.YAMLSyntaxError(this, "Missing closing 'quote"));
      let str = '';

      for (let i = start + 1; i < end - 1; ++i) {
        const ch = src[i];

        if (ch === '\n') {
          if (_Node.default.atDocumentBoundary(src, i + 1)) errors$1.push(new errors.YAMLSemanticError(this, 'Document boundary indicators are not allowed within string values'));

          const {
            fold,
            offset,
            error
          } = _Node.default.foldNewline(src, i, indent);

          str += fold;
          i = offset;
          if (error) errors$1.push(new errors.YAMLSemanticError(this, 'Multi-line single-quoted string needs to be sufficiently indented'));
        } else if (ch === "'") {
          str += ch;
          i += 1;
          if (src[i] !== "'") errors$1.push(new errors.YAMLSyntaxError(this, 'Unescaped single quote? This should not happen.'));
        } else if (ch === ' ' || ch === '\t') {
          // trim trailing whitespace
          const wsStart = i;
          let next = src[i + 1];

          while (next === ' ' || next === '\t') {
            i += 1;
            next = src[i + 1];
          }

          if (next !== '\n') str += i > wsStart ? src.slice(wsStart, i + 1) : ch;
        } else {
          str += ch;
        }
      }

      return errors$1.length > 0 ? {
        errors: errors$1,
        str
      } : str;
    }
    /**
     * Parses a 'single quoted' value from the source
     *
     * @param {ParseContext} context
     * @param {number} start - Index of first character
     * @returns {number} - Index of the character after this scalar
     */


    parse(context, start) {
      this.context = context;
      const {
        src
      } = context;
      let offset = QuoteSingle.endOfQuote(src, start + 1);
      this.valueRange = new _Range.default(start, offset);
      offset = _Node.default.endOfWhiteSpace(src, offset);
      offset = this.parseComment(offset);
      return offset;
    }

  }

  exports.default = QuoteSingle;
});
unwrapExports(QuoteSingle_1);

var ParseContext_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Alias = _interopRequireDefault(Alias_1);

  var _BlockValue = _interopRequireDefault(BlockValue_1);

  var _Collection = _interopRequireDefault(Collection_1);

  var _CollectionItem = _interopRequireDefault(CollectionItem_1);

  var _FlowCollection = _interopRequireDefault(FlowCollection_1);

  var _Node = _interopRequireDefault(Node_1);

  var _PlainValue = _interopRequireDefault(PlainValue_1);

  var _QuoteDouble = _interopRequireDefault(QuoteDouble_1);

  var _QuoteSingle = _interopRequireDefault(QuoteSingle_1);

  var _Range = _interopRequireDefault(Range_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function createNewNode(type, props) {
    switch (type) {
      case constants.Type.ALIAS:
        return new _Alias.default(type, props);

      case constants.Type.BLOCK_FOLDED:
      case constants.Type.BLOCK_LITERAL:
        return new _BlockValue.default(type, props);

      case constants.Type.FLOW_MAP:
      case constants.Type.FLOW_SEQ:
        return new _FlowCollection.default(type, props);

      case constants.Type.MAP_KEY:
      case constants.Type.MAP_VALUE:
      case constants.Type.SEQ_ITEM:
        return new _CollectionItem.default(type, props);

      case constants.Type.COMMENT:
      case constants.Type.PLAIN:
        return new _PlainValue.default(type, props);

      case constants.Type.QUOTE_DOUBLE:
        return new _QuoteDouble.default(type, props);

      case constants.Type.QUOTE_SINGLE:
        return new _QuoteSingle.default(type, props);

      /* istanbul ignore next */

      default:
        return null;
      // should never happen
    }
  }
  /**
   * @param {boolean} atLineStart - Node starts at beginning of line
   * @param {boolean} inFlow - true if currently in a flow context
   * @param {boolean} inCollection - true if currently in a collection context
   * @param {number} indent - Current level of indentation
   * @param {number} lineStart - Start of the current line
   * @param {Node} parent - The parent of the node
   * @param {string} src - Source of the YAML document
   */


  class ParseContext {
    static parseType(src, offset, inFlow) {
      switch (src[offset]) {
        case '*':
          return constants.Type.ALIAS;

        case '>':
          return constants.Type.BLOCK_FOLDED;

        case '|':
          return constants.Type.BLOCK_LITERAL;

        case '{':
          return constants.Type.FLOW_MAP;

        case '[':
          return constants.Type.FLOW_SEQ;

        case '?':
          return !inFlow && _Node.default.atBlank(src, offset + 1, true) ? constants.Type.MAP_KEY : constants.Type.PLAIN;

        case ':':
          return !inFlow && _Node.default.atBlank(src, offset + 1, true) ? constants.Type.MAP_VALUE : constants.Type.PLAIN;

        case '-':
          return !inFlow && _Node.default.atBlank(src, offset + 1, true) ? constants.Type.SEQ_ITEM : constants.Type.PLAIN;

        case '"':
          return constants.Type.QUOTE_DOUBLE;

        case "'":
          return constants.Type.QUOTE_SINGLE;

        default:
          return constants.Type.PLAIN;
      }
    }

    constructor(orig = {}, {
      atLineStart,
      inCollection,
      inFlow,
      indent,
      lineStart,
      parent
    } = {}) {
      _defineProperty(this, "parseNode", (overlay, start) => {
        if (_Node.default.atDocumentBoundary(this.src, start)) return null;
        const context = new ParseContext(this, overlay);
        const {
          props,
          type,
          valueStart
        } = context.parseProps(start);
        const node = createNewNode(type, props);
        let offset = node.parse(context, valueStart);
        node.range = new _Range.default(start, offset);
        /* istanbul ignore if */

        if (offset <= start) {
          // This should never happen, but if it does, let's make sure to at least
          // step one character forward to avoid a busy loop.
          node.error = new Error(`Node#parse consumed no characters`);
          node.error.parseEnd = offset;
          node.error.source = node;
          node.range.end = start + 1;
        }

        if (context.nodeStartsCollection(node)) {
          if (!node.error && !context.atLineStart && context.parent.type === constants.Type.DOCUMENT) {
            node.error = new errors.YAMLSyntaxError(node, 'Block collection must not have preceding content here (e.g. directives-end indicator)');
          }

          const collection = new _Collection.default(node);
          offset = collection.parse(new ParseContext(context), offset);
          collection.range = new _Range.default(start, offset);
          return collection;
        }

        return node;
      });

      this.atLineStart = atLineStart != null ? atLineStart : orig.atLineStart || false;
      this.inCollection = inCollection != null ? inCollection : orig.inCollection || false;
      this.inFlow = inFlow != null ? inFlow : orig.inFlow || false;
      this.indent = indent != null ? indent : orig.indent;
      this.lineStart = lineStart != null ? lineStart : orig.lineStart;
      this.parent = parent != null ? parent : orig.parent || {};
      this.root = orig.root;
      this.src = orig.src;
    }

    nodeStartsCollection(node) {
      const {
        inCollection,
        inFlow,
        src
      } = this;
      if (inCollection || inFlow) return false;
      if (node instanceof _CollectionItem.default) return true; // check for implicit key

      let offset = node.range.end;
      if (src[offset] === '\n' || src[offset - 1] === '\n') return false;
      offset = _Node.default.endOfWhiteSpace(src, offset);
      return src[offset] === ':';
    } // Anchor and tag are before type, which determines the node implementation
    // class; hence this intermediate step.


    parseProps(offset) {
      const {
        inFlow,
        parent,
        src
      } = this;
      const props = [];
      let lineHasProps = false;
      offset = _Node.default.endOfWhiteSpace(src, offset);
      let ch = src[offset];

      while (ch === constants.Char.ANCHOR || ch === constants.Char.COMMENT || ch === constants.Char.TAG || ch === '\n') {
        if (ch === '\n') {
          const lineStart = offset + 1;

          const inEnd = _Node.default.endOfIndent(src, lineStart);

          const indentDiff = inEnd - (lineStart + this.indent);
          const noIndicatorAsIndent = parent.type === constants.Type.SEQ_ITEM && parent.context.atLineStart;
          if (!_Node.default.nextNodeIsIndented(src[inEnd], indentDiff, !noIndicatorAsIndent)) break;
          this.atLineStart = true;
          this.lineStart = lineStart;
          lineHasProps = false;
          offset = inEnd;
        } else if (ch === constants.Char.COMMENT) {
          const end = _Node.default.endOfLine(src, offset + 1);

          props.push(new _Range.default(offset, end));
          offset = end;
        } else {
          let end = _Node.default.endOfIdentifier(src, offset + 1);

          if (ch === constants.Char.TAG && src[end] === ',' && /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+,\d\d\d\d(-\d\d){0,2}\/\S/.test(src.slice(offset + 1, end + 13))) {
            // Let's presume we're dealing with a YAML 1.0 domain tag here, rather
            // than an empty but 'foo.bar' private-tagged node in a flow collection
            // followed without whitespace by a plain string starting with a year
            // or date divided by something.
            end = _Node.default.endOfIdentifier(src, end + 5);
          }

          props.push(new _Range.default(offset, end));
          lineHasProps = true;
          offset = _Node.default.endOfWhiteSpace(src, end);
        }

        ch = src[offset];
      } // '- &a : b' has an anchor on an empty node


      if (lineHasProps && ch === ':' && _Node.default.atBlank(src, offset + 1, true)) offset -= 1;
      const type = ParseContext.parseType(src, offset, inFlow);
      return {
        props,
        type,
        valueStart: offset
      };
    }
    /**
     * Parses a node from the source
     * @param {ParseContext} overlay
     * @param {number} start - Index of first non-whitespace character for the node
     * @returns {?Node} - null if at a document boundary
     */


  }

  exports.default = ParseContext;
});
unwrapExports(ParseContext_1);

var parse_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = parse;

  var _Document = _interopRequireDefault(Document_1);

  var _ParseContext = _interopRequireDefault(ParseContext_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  } // Published as 'yaml/parse-cst'


  function parse(src) {
    const cr = [];

    if (src.indexOf('\r') !== -1) {
      src = src.replace(/\r\n?/g, (match, offset) => {
        if (match.length > 1) cr.push(offset);
        return '\n';
      });
    }

    const documents = [];
    let offset = 0;

    do {
      const doc = new _Document.default();
      const context = new _ParseContext.default({
        src
      });
      offset = doc.parse(context, offset);
      documents.push(doc);
    } while (offset < src.length);

    documents.setOrigRanges = () => {
      if (cr.length === 0) return false;

      for (let i = 1; i < cr.length; ++i) cr[i] -= i;

      let crOffset = 0;

      for (let i = 0; i < documents.length; ++i) {
        crOffset = documents[i].setOrigRanges(cr, crOffset);
      }

      cr.splice(0, cr.length);
      return true;
    };

    documents.toString = () => documents.join('...\n');

    return documents;
  }
});
unwrapExports(parse_1);

var addComment_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.addCommentBefore = addCommentBefore;
  exports.default = addComment;

  function addCommentBefore(str, indent, comment) {
    if (!comment) return str;
    const cc = comment.replace(/[\s\S]^/gm, `$&${indent}#`);
    return `#${cc}\n${indent}${str}`;
  }

  function addComment(str, indent, comment) {
    return !comment ? str : comment.indexOf('\n') === -1 ? `${str} #${comment}` : `${str}\n` + comment.replace(/^/gm, `${indent || ''}#`);
  }
});
unwrapExports(addComment_1);
var addComment_2 = addComment_1.addCommentBefore;

var toJSON_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = toJSON;

  function toJSON(value, arg, ctx) {
    if (Array.isArray(value)) return value.map((v, i) => toJSON(v, String(i), ctx));

    if (value && typeof value.toJSON === 'function') {
      const anchor = ctx && ctx.anchors && ctx.anchors.find(a => a.node === value);
      if (anchor) ctx.onCreate = res => {
        anchor.res = res;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (anchor && ctx.onCreate) ctx.onCreate(res);
      return res;
    }

    return value;
  }
});
unwrapExports(toJSON_1);

var Node_1$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  class Node {}

  exports.default = Node;
});
unwrapExports(Node_1$1);

var Scalar_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _toJSON = _interopRequireDefault(toJSON_1);

  var _Node = _interopRequireDefault(Node_1$1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  } // Published as 'yaml/scalar'


  class Scalar extends _Node.default {
    constructor(value) {
      super();
      this.value = value;
    }

    toJSON(arg, ctx) {
      return ctx && ctx.keep ? this.value : (0, _toJSON.default)(this.value, arg, ctx);
    }

    toString() {
      return String(this.value);
    }

  }

  exports.default = Scalar;
});
unwrapExports(Scalar_1);

var Pair_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _addComment = _interopRequireDefault(addComment_1);

  var _toJSON = _interopRequireDefault(toJSON_1);

  var _Collection = _interopRequireDefault(Collection_1$1);

  var _Node = _interopRequireDefault(Node_1$1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  } // Published as 'yaml/pair'


  const stringifyKey = (key, jsKey, ctx) => {
    if (jsKey === null) return '';
    if (typeof jsKey !== 'object') return String(jsKey);
    if (key instanceof _Node.default && ctx && ctx.doc) return key.toString({
      anchors: {},
      doc: ctx.doc,
      indent: '',
      inFlow: true,
      inStringifyKey: true
    });
    return JSON.stringify(jsKey);
  };

  class Pair extends _Node.default {
    constructor(key, value = null) {
      super();
      this.key = key;
      this.value = value;
      this.type = 'PAIR';
    }

    get commentBefore() {
      return this.key && this.key.commentBefore;
    }

    set commentBefore(cb) {
      if (this.key == null) this.key = new _Scalar.default(null);
      this.key.commentBefore = cb;
    }

    addToJSMap(ctx, map) {
      const key = (0, _toJSON.default)(this.key, '', ctx);

      if (map instanceof Map) {
        const value = (0, _toJSON.default)(this.value, key, ctx);
        map.set(key, value);
      } else if (map instanceof Set) {
        map.add(key);
      } else {
        const stringKey = stringifyKey(this.key, key, ctx);
        map[stringKey] = (0, _toJSON.default)(this.value, stringKey, ctx);
      }

      return map;
    }

    toJSON(_, ctx) {
      const pair = ctx && ctx.mapAsMap ? new Map() : {};
      return this.addToJSMap(ctx, pair);
    }

    toString(ctx, onComment, onChompKeep) {
      if (!ctx || !ctx.doc) return JSON.stringify(this);
      const {
        simpleKeys
      } = ctx.doc.options;
      let {
        key,
        value
      } = this;
      let keyComment = key instanceof _Node.default && key.comment;

      if (simpleKeys) {
        if (keyComment) {
          throw new Error('With simple keys, key nodes cannot have comments');
        }

        if (key instanceof _Collection.default) {
          const msg = 'With simple keys, collection cannot be used as a key value';
          throw new Error(msg);
        }
      }

      const explicitKey = !simpleKeys && (!key || keyComment || key instanceof _Collection.default || key.type === constants.Type.BLOCK_FOLDED || key.type === constants.Type.BLOCK_LITERAL);
      const {
        doc,
        indent
      } = ctx;
      ctx = Object.assign({}, ctx, {
        implicitKey: !explicitKey,
        indent: indent + '  '
      });
      let chompKeep = false;
      let str = doc.schema.stringify(key, ctx, () => keyComment = null, () => chompKeep = true);
      str = (0, _addComment.default)(str, ctx.indent, keyComment);

      if (ctx.allNullValues && !simpleKeys) {
        if (this.comment) {
          str = (0, _addComment.default)(str, ctx.indent, this.comment);
          if (onComment) onComment();
        } else if (chompKeep && !keyComment && onChompKeep) onChompKeep();

        return ctx.inFlow ? str : `? ${str}`;
      }

      str = explicitKey ? `? ${str}\n${indent}:` : `${str}:`;

      if (this.comment) {
        // expected (but not strictly required) to be a single-line comment
        str = (0, _addComment.default)(str, ctx.indent, this.comment);
        if (onComment) onComment();
      }

      let vcb = '';
      let valueComment = null;

      if (value instanceof _Node.default) {
        if (value.spaceBefore) vcb = '\n';

        if (value.commentBefore) {
          const cs = value.commentBefore.replace(/^/gm, `${ctx.indent}#`);
          vcb += `\n${cs}`;
        }

        valueComment = value.comment;
      } else if (value && typeof value === 'object') {
        value = doc.schema.createNode(value, true);
      }

      ctx.implicitKey = false;
      if (!explicitKey && !this.comment && value instanceof _Scalar.default) ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      const valueStr = doc.schema.stringify(value, ctx, () => valueComment = null, () => chompKeep = true);
      let ws = ' ';

      if (vcb || this.comment) {
        ws = `${vcb}\n${ctx.indent}`;
      } else if (!explicitKey && value instanceof _Collection.default) {
        const flow = valueStr[0] === '[' || valueStr[0] === '{';
        if (!flow || valueStr.includes('\n')) ws = `\n${ctx.indent}`;
      }

      if (chompKeep && !valueComment && onChompKeep) onChompKeep();
      return (0, _addComment.default)(str + ws + valueStr, ctx.indent, valueComment);
    }

  }

  exports.default = Pair;
});
unwrapExports(Pair_1);

var Collection_1$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.isEmptyPath = void 0;

  var _addComment = _interopRequireDefault(addComment_1);

  var _Node = _interopRequireDefault(Node_1$1);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function collectionFromPath(schema, path, value) {
    let v = value;

    for (let i = path.length - 1; i >= 0; --i) {
      const k = path[i];
      const o = Number.isInteger(k) && k >= 0 ? [] : {};
      o[k] = v;
      v = o;
    }

    return schema.createNode(v, false);
  } // null, undefined, or an empty non-string iterable (e.g. [])


  const isEmptyPath = path => path == null || typeof path === 'object' && path[Symbol.iterator]().next().done;

  exports.isEmptyPath = isEmptyPath;

  class Collection extends _Node.default {
    constructor(schema) {
      super();

      _defineProperty(this, "items", []);

      this.schema = schema;
    }

    addIn(path, value) {
      if (isEmptyPath(path)) this.add(value);else {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (node instanceof Collection) node.addIn(rest, value);else if (node === undefined && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }

    deleteIn([key, ...rest]) {
      if (rest.length === 0) return this.delete(key);
      const node = this.get(key, true);
      if (node instanceof Collection) return node.deleteIn(rest);else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }

    getIn([key, ...rest], keepScalar) {
      const node = this.get(key, true);
      if (rest.length === 0) return !keepScalar && node instanceof _Scalar.default ? node.value : node;else return node instanceof Collection ? node.getIn(rest, keepScalar) : undefined;
    }

    hasAllNullValues() {
      return this.items.every(node => {
        if (!(node instanceof _Pair.default)) return false;
        const n = node.value;
        return n == null || n instanceof _Scalar.default && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }

    hasIn([key, ...rest]) {
      if (rest.length === 0) return this.has(key);
      const node = this.get(key, true);
      return node instanceof Collection ? node.hasIn(rest) : false;
    }

    setIn([key, ...rest], value) {
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (node instanceof Collection) node.setIn(rest, value);else if (node === undefined && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    } // overridden in implementations

    /* istanbul ignore next */


    toJSON() {
      return null;
    }

    toString(ctx, {
      blockItem,
      flowChars,
      isMap,
      itemIndent
    }, onComment, onChompKeep) {
      const {
        doc,
        indent
      } = ctx;
      const inFlow = this.type && this.type.substr(0, 4) === 'FLOW' || ctx.inFlow;
      if (inFlow) itemIndent += '  ';
      const allNullValues = isMap && this.hasAllNullValues();
      ctx = Object.assign({}, ctx, {
        allNullValues,
        indent: itemIndent,
        inFlow,
        type: null
      });
      let chompKeep = false;
      let hasItemWithNewLine = false;
      const nodes = this.items.reduce((nodes, item, i) => {
        let comment;

        if (item) {
          if (!chompKeep && item.spaceBefore) nodes.push({
            type: 'comment',
            str: ''
          });
          if (item.commentBefore) item.commentBefore.match(/^.*$/gm).forEach(line => {
            nodes.push({
              type: 'comment',
              str: `#${line}`
            });
          });
          if (item.comment) comment = item.comment;
          if (inFlow && (!chompKeep && item.spaceBefore || item.commentBefore || item.comment || item.key && (item.key.commentBefore || item.key.comment) || item.value && (item.value.commentBefore || item.value.comment))) hasItemWithNewLine = true;
        }

        chompKeep = false;
        let str = doc.schema.stringify(item, ctx, () => comment = null, () => chompKeep = true);
        if (inFlow && !hasItemWithNewLine && str.includes('\n')) hasItemWithNewLine = true;
        if (inFlow && i < this.items.length - 1) str += ',';
        str = (0, _addComment.default)(str, itemIndent, comment);
        if (chompKeep && (comment || inFlow)) chompKeep = false;
        nodes.push({
          type: 'item',
          str
        });
        return nodes;
      }, []);
      let str;

      if (nodes.length === 0) {
        str = flowChars.start + flowChars.end;
      } else if (inFlow) {
        const {
          start,
          end
        } = flowChars;
        const strings = nodes.map(n => n.str);

        if (hasItemWithNewLine || strings.reduce((sum, str) => sum + str.length + 2, 2) > Collection.maxFlowStringSingleLineLength) {
          str = start;

          for (const s of strings) {
            str += s ? `\n  ${indent}${s}` : '\n';
          }

          str += `\n${indent}${end}`;
        } else {
          str = `${start} ${strings.join(' ')} ${end}`;
        }
      } else {
        const strings = nodes.map(blockItem);
        str = strings.shift();

        for (const s of strings) str += s ? `\n${indent}${s}` : '\n';
      }

      if (this.comment) {
        str += '\n' + this.comment.replace(/^/gm, `${indent}#`);
        if (onComment) onComment();
      } else if (chompKeep && onChompKeep) onChompKeep();

      return str;
    }

  }

  exports.default = Collection;

  _defineProperty(Collection, "maxFlowStringSingleLineLength", 60);
});
unwrapExports(Collection_1$1);
var Collection_2$1 = Collection_1$1.isEmptyPath;

var Alias_1$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _toJSON = _interopRequireDefault(toJSON_1);

  var _Collection = _interopRequireDefault(Collection_1$1);

  var _Node = _interopRequireDefault(Node_1$1);

  var _Pair = _interopRequireDefault(Pair_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  const getAliasCount = (node, anchors) => {
    if (node instanceof Alias) {
      const anchor = anchors.find(a => a.node === node.source);
      return anchor.count * anchor.aliasCount;
    } else if (node instanceof _Collection.default) {
      let count = 0;

      for (const item of node.items) {
        const c = getAliasCount(item, anchors);
        if (c > count) count = c;
      }

      return count;
    } else if (node instanceof _Pair.default) {
      const kc = getAliasCount(node.key, anchors);
      const vc = getAliasCount(node.value, anchors);
      return Math.max(kc, vc);
    }

    return 1;
  };

  class Alias extends _Node.default {
    static stringify({
      range,
      source
    }, {
      anchors,
      doc,
      implicitKey,
      inStringifyKey
    }) {
      let anchor = Object.keys(anchors).find(a => anchors[a] === source);
      if (!anchor && inStringifyKey) anchor = doc.anchors.getName(source) || doc.anchors.newName();
      if (anchor) return `*${anchor}${implicitKey ? ' ' : ''}`;
      const msg = doc.anchors.getName(source) ? 'Alias node must be after source node' : 'Source node not found for alias node';
      throw new Error(`${msg} [${range}]`);
    }

    constructor(source) {
      super();
      this.source = source;
      this.type = constants.Type.ALIAS;
    }

    set tag(t) {
      throw new Error('Alias nodes cannot have tags');
    }

    toJSON(arg, ctx) {
      if (!ctx) return (0, _toJSON.default)(this.source, arg, ctx);
      const {
        anchors,
        maxAliasCount
      } = ctx;
      const anchor = anchors.find(a => a.node === this.source);
      /* istanbul ignore if */

      if (!anchor || anchor.res === undefined) {
        const msg = 'This should not happen: Alias anchor was not resolved?';
        if (this.cstNode) throw new errors.YAMLReferenceError(this.cstNode, msg);else throw new ReferenceError(msg);
      }

      if (maxAliasCount >= 0) {
        anchor.count += 1;
        if (anchor.aliasCount === 0) anchor.aliasCount = getAliasCount(this.source, anchors);

        if (anchor.count * anchor.aliasCount > maxAliasCount) {
          const msg = 'Excessive alias count indicates a resource exhaustion attack';
          if (this.cstNode) throw new errors.YAMLReferenceError(this.cstNode, msg);else throw new ReferenceError(msg);
        }
      }

      return anchor.res;
    } // Only called when stringifying an alias mapping key while constructing
    // Object output.


    toString(ctx) {
      return Alias.stringify(this, ctx);
    }

  }

  exports.default = Alias;

  _defineProperty(Alias, "default", true);
});
unwrapExports(Alias_1$1);

var _Map = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.findPair = findPair;
  exports.default = void 0;

  var _Collection = _interopRequireDefault(Collection_1$1);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function findPair(items, key) {
    const k = key instanceof _Scalar.default ? key.value : key;

    for (const it of items) {
      if (it instanceof _Pair.default) {
        if (it.key === key || it.key === k) return it;
        if (it.key && it.key.value === k) return it;
      }
    }

    return undefined;
  }

  class YAMLMap extends _Collection.default {
    add(pair, overwrite) {
      if (!pair) pair = new _Pair.default(pair);else if (!(pair instanceof _Pair.default)) pair = new _Pair.default(pair.key || pair, pair.value);
      const prev = findPair(this.items, pair.key);
      const sortEntries = this.schema && this.schema.sortMapEntries;

      if (prev) {
        if (overwrite) prev.value = pair.value;else throw new Error(`Key ${pair.key} already set`);
      } else if (sortEntries) {
        const i = this.items.findIndex(item => sortEntries(pair, item) < 0);
        if (i === -1) this.items.push(pair);else this.items.splice(i, 0, pair);
      } else {
        this.items.push(pair);
      }
    }

    delete(key) {
      const it = findPair(this.items, key);
      if (!it) return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }

    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it && it.value;
      return !keepScalar && node instanceof _Scalar.default ? node.value : node;
    }

    has(key) {
      return !!findPair(this.items, key);
    }

    set(key, value) {
      this.add(new _Pair.default(key, value), true);
    }
    /**
     * @param {*} arg ignored
     * @param {*} ctx Conversion context, originally set in Document#toJSON()
     * @param {Class} Type If set, forces the returned collection type
     * @returns {*} Instance of Type, Map, or Object
     */


    toJSON(_, ctx, Type) {
      const map = Type ? new Type() : ctx && ctx.mapAsMap ? new Map() : {};
      if (ctx && ctx.onCreate) ctx.onCreate(map);

      for (const item of this.items) item.addToJSMap(ctx, map);

      return map;
    }

    toString(ctx, onComment, onChompKeep) {
      if (!ctx) return JSON.stringify(this);

      for (const item of this.items) {
        if (!(item instanceof _Pair.default)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }

      return super.toString(ctx, {
        blockItem: n => n.str,
        flowChars: {
          start: '{',
          end: '}'
        },
        isMap: true,
        itemIndent: ctx.indent || ''
      }, onComment, onChompKeep);
    }

  }

  exports.default = YAMLMap;
});

unwrapExports(_Map);
var _Map_1 = _Map.findPair;

var Seq = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _toJSON = _interopRequireDefault(toJSON_1);

  var _Collection = _interopRequireDefault(Collection_1$1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  } // Published as 'yaml/seq'


  function asItemIndex(key) {
    let idx = key instanceof _Scalar.default ? key.value : key;
    if (idx && typeof idx === 'string') idx = Number(idx);
    return Number.isInteger(idx) && idx >= 0 ? idx : null;
  }

  class YAMLSeq extends _Collection.default {
    add(value) {
      this.items.push(value);
    }

    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== 'number') return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }

    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== 'number') return undefined;
      const it = this.items[idx];
      return !keepScalar && it instanceof _Scalar.default ? it.value : it;
    }

    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === 'number' && idx < this.items.length;
    }

    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== 'number') throw new Error(`Expected a valid index, not ${key}.`);
      this.items[idx] = value;
    }

    toJSON(_, ctx) {
      const seq = [];
      if (ctx && ctx.onCreate) ctx.onCreate(seq);
      let i = 0;

      for (const item of this.items) seq.push((0, _toJSON.default)(item, String(i++), ctx));

      return seq;
    }

    toString(ctx, onComment, onChompKeep) {
      if (!ctx) return JSON.stringify(this);
      return super.toString(ctx, {
        blockItem: n => n.type === 'comment' ? n.str : `- ${n.str}`,
        flowChars: {
          start: '[',
          end: ']'
        },
        isMap: false,
        itemIndent: (ctx.indent || '') + '  '
      }, onComment, onChompKeep);
    }

  }

  exports.default = YAMLSeq;
});
unwrapExports(Seq);

var Merge_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.MERGE_KEY = void 0;

  var _Map$1 = _interopRequireDefault(_Map);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  var _Seq = _interopRequireDefault(Seq);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const MERGE_KEY = '<<';
  exports.MERGE_KEY = MERGE_KEY;

  class Merge extends _Pair.default {
    constructor(pair) {
      if (pair instanceof _Pair.default) {
        let seq = pair.value;

        if (!(seq instanceof _Seq.default)) {
          seq = new _Seq.default();
          seq.items.push(pair.value);
          seq.range = pair.value.range;
        }

        super(pair.key, seq);
        this.range = pair.range;
      } else {
        super(new _Scalar.default(MERGE_KEY), new _Seq.default());
      }

      this.type = 'MERGE_PAIR';
    } // If the value associated with a merge key is a single mapping node, each of
    // its key/value pairs is inserted into the current mapping, unless the key
    // already exists in it. If the value associated with the merge key is a
    // sequence, then this sequence is expected to contain mapping nodes and each
    // of these nodes is merged in turn according to its order in the sequence.
    // Keys in mapping nodes earlier in the sequence override keys specified in
    // later mapping nodes. -- http://yaml.org/type/merge.html


    addToJSMap(ctx, map) {
      for (const {
        source
      } of this.value.items) {
        if (!(source instanceof _Map$1.default)) throw new Error('Merge sources must be maps');
        const srcMap = source.toJSON(null, ctx, Map);

        for (const [key, value] of srcMap) {
          if (map instanceof Map) {
            if (!map.has(key)) map.set(key, value);
          } else if (map instanceof Set) {
            map.add(key);
          } else {
            if (!Object.prototype.hasOwnProperty.call(map, key)) map[key] = value;
          }
        }
      }

      return map;
    }

    toString(ctx, onComment) {
      const seq = this.value;
      if (seq.items.length > 1) return super.toString(ctx, onComment);
      this.value = seq.items[0];
      const str = super.toString(ctx, onComment);
      this.value = seq;
      return str;
    }

  }

  exports.default = Merge;
});
unwrapExports(Merge_1);
var Merge_2 = Merge_1.MERGE_KEY;

var Anchors_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Alias = _interopRequireDefault(Alias_1$1);

  var _Map$1 = _interopRequireDefault(_Map);

  var _Merge = _interopRequireDefault(Merge_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  var _Seq = _interopRequireDefault(Seq);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  class Anchors {
    static validAnchorNode(node) {
      return node instanceof _Scalar.default || node instanceof _Seq.default || node instanceof _Map$1.default;
    }

    constructor(prefix) {
      _defineProperty(this, "map", {});

      this.prefix = prefix;
    }

    createAlias(node, name) {
      this.setAnchor(node, name);
      return new _Alias.default(node);
    }

    createMergePair(...sources) {
      const merge = new _Merge.default();
      merge.value.items = sources.map(s => {
        if (s instanceof _Alias.default) {
          if (s.source instanceof _Map$1.default) return s;
        } else if (s instanceof _Map$1.default) {
          return this.createAlias(s);
        }

        throw new Error('Merge sources must be Map nodes or their Aliases');
      });
      return merge;
    }

    getName(node) {
      const {
        map
      } = this;
      return Object.keys(map).find(a => map[a] === node);
    }

    getNode(name) {
      return this.map[name];
    }

    newName(prefix) {
      if (!prefix) prefix = this.prefix;
      const names = Object.keys(this.map);

      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!names.includes(name)) return name;
      }
    } // During parsing, map & aliases contain CST nodes


    resolveNodes() {
      const {
        map,
        _cstAliases
      } = this;
      Object.keys(map).forEach(a => {
        map[a] = map[a].resolved;
      });

      _cstAliases.forEach(a => {
        a.source = a.source.resolved;
      });

      delete this._cstAliases;
    }

    setAnchor(node, name) {
      if (node != null && !Anchors.validAnchorNode(node)) {
        throw new Error('Anchors may only be set for Scalar, Seq and Map nodes');
      }

      if (name && /[\x00-\x19\s,[\]{}]/.test(name)) {
        throw new Error('Anchor names must not contain whitespace or control characters');
      }

      const {
        map
      } = this;
      const prev = node && Object.keys(map).find(a => map[a] === node);

      if (prev) {
        if (!name) {
          return prev;
        } else if (prev !== name) {
          delete map[prev];
          map[name] = node;
        }
      } else {
        if (!name) {
          if (!node) return null;
          name = this.newName();
        }

        map[name] = node;
      }

      return name;
    }

  }

  exports.default = Anchors;
});
unwrapExports(Anchors_1);

var listTagNames = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Collection = _interopRequireDefault(Collection_1$1);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const visit = (node, tags) => {
    if (node && typeof node === 'object') {
      const {
        tag
      } = node;

      if (node instanceof _Collection.default) {
        if (tag) tags[tag] = true;
        node.items.forEach(n => visit(n, tags));
      } else if (node instanceof _Pair.default) {
        visit(node.key, tags);
        visit(node.value, tags);
      } else if (node instanceof _Scalar.default) {
        if (tag) tags[tag] = true;
      }
    }

    return tags;
  };

  var _default = node => Object.keys(visit(node, {}));

  exports.default = _default;
});
unwrapExports(listTagNames);

var warnings = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.warn = warn;
  exports.warnFileDeprecation = warnFileDeprecation;
  exports.warnOptionDeprecation = warnOptionDeprecation;
  /* global global, console */

  function warn(warning, type) {
    if (global && global._YAML_SILENCE_WARNINGS) return;
    const {
      emitWarning
    } = global && global.process; // This will throw in Jest if `warning` is an Error instance due to
    // https://github.com/facebook/jest/issues/2549

    if (emitWarning) emitWarning(warning, type);else {
      // eslint-disable-next-line no-console
      console.warn(type ? `${type}: ${warning}` : warning);
    }
  }

  function warnFileDeprecation(filename) {
    if (global && global._YAML_SILENCE_DEPRECATION_WARNINGS) return;
    const path = filename.replace(/.*yaml[/\\]/i, '').replace(/\.js$/, '').replace(/\\/g, '/');
    warn(`The endpoint 'yaml/${path}' will be removed in a future release.`, 'DeprecationWarning');
  }

  const warned = {};

  function warnOptionDeprecation(name, alternative) {
    if (global && global._YAML_SILENCE_DEPRECATION_WARNINGS) return;
    if (warned[name]) return;
    warned[name] = true;
    let msg = `The option '${name}' will be removed in a future release`;
    msg += alternative ? `, use '${alternative}' instead.` : '.';
    warn(msg, 'DeprecationWarning');
  }
});
unwrapExports(warnings);
var warnings_1 = warnings.warn;
var warnings_2 = warnings.warnFileDeprecation;
var warnings_3 = warnings.warnOptionDeprecation;

var foldFlowLines_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = foldFlowLines;
  exports.FOLD_QUOTED = exports.FOLD_BLOCK = exports.FOLD_FLOW = void 0;
  const FOLD_FLOW = 'flow';
  exports.FOLD_FLOW = FOLD_FLOW;
  const FOLD_BLOCK = 'block';
  exports.FOLD_BLOCK = FOLD_BLOCK;
  const FOLD_QUOTED = 'quoted'; // presumes i+1 is at the start of a line
  // returns index of last newline in more-indented block

  exports.FOLD_QUOTED = FOLD_QUOTED;

  const consumeMoreIndentedLines = (text, i) => {
    let ch = text[i + 1];

    while (ch === ' ' || ch === '\t') {
      do {
        ch = text[i += 1];
      } while (ch && ch !== '\n');

      ch = text[i + 1];
    }

    return i;
  };
  /**
   * Tries to keep input at up to `lineWidth` characters, splitting only on spaces
   * not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
   * terminated with `\n` and started with `indent`.
   *
   * @param {string} text
   * @param {string} indent
   * @param {string} [mode='flow'] `'block'` prevents more-indented lines
   *   from being folded; `'quoted'` allows for `\` escapes, including escaped
   *   newlines
   * @param {Object} options
   * @param {number} [options.indentAtStart] Accounts for leading contents on
   *   the first line, defaulting to `indent.length`
   * @param {number} [options.lineWidth=80]
   * @param {number} [options.minContentWidth=20] Allow highly indented lines to
   *   stretch the line width
   * @param {function} options.onFold Called once if the text is folded
   * @param {function} options.onFold Called once if any line of text exceeds
   *   lineWidth characters
   */


  function foldFlowLines(text, indent, mode, {
    indentAtStart,
    lineWidth = 80,
    minContentWidth = 20,
    onFold,
    onOverflow
  }) {
    if (!lineWidth || lineWidth < 0) return text;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep) return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - (typeof indentAtStart === 'number' ? indentAtStart : indent.length);
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;

    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text, i);
      if (i !== -1) end = i + endStep;
    }

    for (let ch; ch = text[i += 1];) {
      if (mode === FOLD_QUOTED && ch === '\\') {
        switch (text[i + 1]) {
          case 'x':
            i += 3;
            break;

          case 'u':
            i += 5;
            break;

          case 'U':
            i += 9;
            break;

          default:
            i += 1;
        }
      }

      if (ch === '\n') {
        if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i);
        end = i + endStep;
        split = undefined;
      } else {
        if (ch === ' ' && prev && prev !== ' ' && prev !== '\n' && prev !== '\t') {
          // space surrounded by non-space can be replaced with newline + indent
          const next = text[i + 1];
          if (next && next !== ' ' && next !== '\n' && next !== '\t') split = i;
        }

        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = undefined;
          } else if (mode === FOLD_QUOTED) {
            // white-space collected at end may stretch past lineWidth
            while (prev === ' ' || prev === '\t') {
              prev = ch;
              ch = text[i += 1];
              overflow = true;
            } // i - 2 accounts for not-dropped last char + newline-escaping \


            folds.push(i - 2);
            escapedFolds[i - 2] = true;
            end = i - 2 + endStep;
            split = undefined;
          } else {
            overflow = true;
          }
        }
      }

      prev = ch;
    }

    if (overflow && onOverflow) onOverflow();
    if (folds.length === 0) return text;
    if (onFold) onFold();
    let res = text.slice(0, folds[0]);

    for (let i = 0; i < folds.length; ++i) {
      const fold = folds[i];
      const end = folds[i + 1] || text.length;
      if (mode === FOLD_QUOTED && escapedFolds[fold]) res += `${text[fold]}\\`;
      res += `\n${indent}${text.slice(fold + 1, end)}`;
    }

    return res;
  }
});
unwrapExports(foldFlowLines_1);
var foldFlowLines_2 = foldFlowLines_1.FOLD_QUOTED;
var foldFlowLines_3 = foldFlowLines_1.FOLD_BLOCK;
var foldFlowLines_4 = foldFlowLines_1.FOLD_FLOW;

var options = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.strOptions = exports.nullOptions = exports.boolOptions = exports.binaryOptions = void 0;
  const binaryOptions = {
    defaultType: constants.Type.BLOCK_LITERAL,
    lineWidth: 76
  };
  exports.binaryOptions = binaryOptions;
  const boolOptions = {
    trueStr: 'true',
    falseStr: 'false'
  };
  exports.boolOptions = boolOptions;
  const nullOptions = {
    nullStr: 'null'
  };
  exports.nullOptions = nullOptions;
  const strOptions = {
    defaultType: constants.Type.PLAIN,
    doubleQuoted: {
      jsonEncoding: false,
      minMultiLineLength: 40
    },
    fold: {
      lineWidth: 80,
      minContentWidth: 20
    }
  };
  exports.strOptions = strOptions;
});
unwrapExports(options);
var options_1 = options.strOptions;
var options_2 = options.nullOptions;
var options_3 = options.boolOptions;
var options_4 = options.binaryOptions;

var stringify = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.stringifyNumber = stringifyNumber;
  exports.stringifyString = stringifyString;

  var _foldFlowLines = _interopRequireWildcard(foldFlowLines_1);

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  const getFoldOptions = ({
    indentAtStart
  }) => indentAtStart ? Object.assign({
    indentAtStart
  }, options.strOptions.fold) : options.strOptions.fold;

  function stringifyNumber({
    format,
    minFractionDigits,
    tag,
    value
  }) {
    if (!isFinite(value)) return isNaN(value) ? '.nan' : value < 0 ? '-.inf' : '.inf';
    let n = JSON.stringify(value);

    if (!format && minFractionDigits && (!tag || tag === 'tag:yaml.org,2002:float') && /^\d/.test(n)) {
      let i = n.indexOf('.');

      if (i < 0) {
        i = n.length;
        n += '.';
      }

      let d = minFractionDigits - (n.length - i - 1);

      while (d-- > 0) n += '0';
    }

    return n;
  }

  function lineLengthOverLimit(str, limit) {
    const strLen = str.length;
    if (strLen <= limit) return false;

    for (let i = 0, start = 0; i < strLen; ++i) {
      if (str[i] === '\n') {
        if (i - start > limit) return true;
        start = i + 1;
        if (strLen - start <= limit) return false;
      }
    }

    return true;
  }

  function doubleQuotedString(value, ctx) {
    const {
      implicitKey,
      indent
    } = ctx;
    const {
      jsonEncoding,
      minMultiLineLength
    } = options.strOptions.doubleQuoted;
    const json = JSON.stringify(value);
    if (jsonEncoding) return json;
    let str = '';
    let start = 0;

    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
      if (ch === ' ' && json[i + 1] === '\\' && json[i + 2] === 'n') {
        // space before newline needs to be escaped to not be folded
        str += json.slice(start, i) + '\\ ';
        i += 1;
        start = i;
        ch = '\\';
      }

      if (ch === '\\') switch (json[i + 1]) {
        case 'u':
          {
            str += json.slice(start, i);
            const code = json.substr(i + 2, 4);

            switch (code) {
              case '0000':
                str += '\\0';
                break;

              case '0007':
                str += '\\a';
                break;

              case '000b':
                str += '\\v';
                break;

              case '001b':
                str += '\\e';
                break;

              case '0085':
                str += '\\N';
                break;

              case '00a0':
                str += '\\_';
                break;

              case '2028':
                str += '\\L';
                break;

              case '2029':
                str += '\\P';
                break;

              default:
                if (code.substr(0, 2) === '00') str += '\\x' + code.substr(2);else str += json.substr(i, 6);
            }

            i += 5;
            start = i + 1;
          }
          break;

        case 'n':
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            // folding will eat first newline
            str += json.slice(start, i) + '\n\n';

            while (json[i + 2] === '\\' && json[i + 3] === 'n' && json[i + 4] !== '"') {
              str += '\n';
              i += 2;
            }

            str += indent; // space after newline needs to be escaped to not be folded

            if (json[i + 2] === ' ') str += '\\';
            i += 1;
            start = i + 1;
          }

          break;

        default:
          i += 1;
      }
    }

    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : (0, _foldFlowLines.default)(str, indent, _foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx));
  }

  function singleQuotedString(value, ctx) {
    const {
      indent,
      implicitKey
    } = ctx;

    if (implicitKey) {
      if (/\n/.test(value)) return doubleQuotedString(value, ctx);
    } else {
      // single quoted string can't have leading or trailing whitespace around newline
      if (/[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
    }

    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
    return implicitKey ? res : (0, _foldFlowLines.default)(res, indent, _foldFlowLines.FOLD_FLOW, getFoldOptions(ctx));
  }

  function blockString({
    comment,
    type,
    value
  }, ctx, onComment, onChompKeep) {
    // 1. Block can't end in whitespace unless the last line is non-empty.
    // 2. Strings consisting of only whitespace are best rendered explicitly.
    if (/\n[\t ]+$/.test(value) || /^\s*$/.test(value)) {
      return doubleQuotedString(value, ctx);
    }

    const indent = ctx.indent || (ctx.forceBlockIndent ? ' ' : '');
    const indentSize = indent ? '2' : '1'; // root is at -1

    const literal = type === constants.Type.BLOCK_FOLDED ? false : type === constants.Type.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, options.strOptions.fold.lineWidth - indent.length);
    let header = literal ? '|' : '>';
    if (!value) return header + '\n';
    let wsStart = '';
    let wsEnd = '';
    value = value.replace(/[\n\t ]*$/, ws => {
      const n = ws.indexOf('\n');

      if (n === -1) {
        header += '-'; // strip
      } else if (value === ws || n !== ws.length - 1) {
        header += '+'; // keep

        if (onChompKeep) onChompKeep();
      }

      wsEnd = ws.replace(/\n$/, '');
      return '';
    }).replace(/^[\n ]*/, ws => {
      if (ws.indexOf(' ') !== -1) header += indentSize;
      const m = ws.match(/ +$/);

      if (m) {
        wsStart = ws.slice(0, -m[0].length);
        return m[0];
      } else {
        wsStart = ws;
        return '';
      }
    });
    if (wsEnd) wsEnd = wsEnd.replace(/\n+(?!\n|$)/g, `$&${indent}`);
    if (wsStart) wsStart = wsStart.replace(/\n+/g, `$&${indent}`);

    if (comment) {
      header += ' #' + comment.replace(/ ?[\r\n]+/g, ' ');
      if (onComment) onComment();
    }

    if (!value) return `${header}${indentSize}\n${indent}${wsEnd}`;

    if (literal) {
      value = value.replace(/\n+/g, `$&${indent}`);
      return `${header}\n${indent}${wsStart}${value}${wsEnd}`;
    }

    value = value.replace(/\n+/g, '\n$&').replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, '$1$2') // more-indented lines aren't folded
    //         ^ ind.line  ^ empty     ^ capture next empty lines only at end of indent
    .replace(/\n+/g, `$&${indent}`);
    const body = (0, _foldFlowLines.default)(`${wsStart}${value}${wsEnd}`, indent, _foldFlowLines.FOLD_BLOCK, options.strOptions.fold);
    return `${header}\n${indent}${body}`;
  }

  function plainString(item, ctx, onComment, onChompKeep) {
    const {
      comment,
      type,
      value
    } = item;
    const {
      actualString,
      implicitKey,
      indent,
      inFlow,
      tags
    } = ctx;

    if (implicitKey && /[\n[\]{},]/.test(value) || inFlow && /[[\]{},]/.test(value)) {
      return doubleQuotedString(value, ctx);
    }

    if (!value || /^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      // not allowed:
      // - empty string, '-' or '?'
      // - start with an indicator character (except [?:-]) or /[?-] /
      // - '\n ', ': ' or ' \n' anywhere
      // - '#' not preceded by a non-space char
      // - end with ' ' or ':'
      return implicitKey || inFlow || value.indexOf('\n') === -1 ? value.indexOf('"') !== -1 && value.indexOf("'") === -1 ? singleQuotedString(value, ctx) : doubleQuotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }

    if (!implicitKey && !inFlow && type !== constants.Type.PLAIN && value.indexOf('\n') !== -1) {
      // Where allowed & type not set explicitly, prefer block style for multiline strings
      return blockString(item, ctx, onComment, onChompKeep);
    }

    const str = value.replace(/\n+/g, `$&\n${indent}`); // Verify that output will be parsed as a string, as e.g. plain numbers and
    // booleans get parsed with those types in v1.2 (e.g. '42', 'true' & '0.9e-3'),
    // and others in v1.1.

    if (actualString && typeof tags.resolveScalar(str).value !== 'string') {
      return doubleQuotedString(value, ctx);
    }

    const body = implicitKey ? str : (0, _foldFlowLines.default)(str, indent, _foldFlowLines.FOLD_FLOW, getFoldOptions(ctx));

    if (comment && !inFlow && (body.indexOf('\n') !== -1 || comment.indexOf('\n') !== -1)) {
      if (onComment) onComment();
      return (0, addComment_1.addCommentBefore)(body, indent, comment);
    }

    return body;
  }

  function stringifyString(item, ctx, onComment, onChompKeep) {
    const {
      defaultType
    } = options.strOptions;
    const {
      implicitKey,
      inFlow
    } = ctx;
    let {
      type,
      value
    } = item;

    if (typeof value !== 'string') {
      value = String(value);
      item = Object.assign({}, item, {
        value
      });
    }

    const _stringify = _type => {
      switch (_type) {
        case constants.Type.BLOCK_FOLDED:
        case constants.Type.BLOCK_LITERAL:
          return blockString(item, ctx, onComment, onChompKeep);

        case constants.Type.QUOTE_DOUBLE:
          return doubleQuotedString(value, ctx);

        case constants.Type.QUOTE_SINGLE:
          return singleQuotedString(value, ctx);

        case constants.Type.PLAIN:
          return plainString(item, ctx, onComment, onChompKeep);

        default:
          return null;
      }
    };

    if (type !== constants.Type.QUOTE_DOUBLE && /[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(value)) {
      // force double quotes on control characters
      type = constants.Type.QUOTE_DOUBLE;
    } else if ((implicitKey || inFlow) && (type === constants.Type.BLOCK_FOLDED || type === constants.Type.BLOCK_LITERAL)) {
      // should not happen; blocks are not valid inside flow containers
      type = constants.Type.QUOTE_DOUBLE;
    }

    let res = _stringify(type);

    if (res === null) {
      res = _stringify(defaultType);
      if (res === null) throw new Error(`Unsupported default string type ${defaultType}`);
    }

    return res;
  }
});
unwrapExports(stringify);
var stringify_1 = stringify.stringifyNumber;
var stringify_2 = stringify.stringifyString;

var parseUtils = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.checkFlowCollectionEnd = checkFlowCollectionEnd;
  exports.checkKeyLength = checkKeyLength;
  exports.resolveComments = resolveComments;

  function checkFlowCollectionEnd(errors$1, cst) {
    let char, name;

    switch (cst.type) {
      case constants.Type.FLOW_MAP:
        char = '}';
        name = 'flow map';
        break;

      case constants.Type.FLOW_SEQ:
        char = ']';
        name = 'flow sequence';
        break;

      default:
        errors$1.push(new errors.YAMLSemanticError(cst, 'Not a flow collection!?'));
        return;
    }

    let lastItem;

    for (let i = cst.items.length - 1; i >= 0; --i) {
      const item = cst.items[i];

      if (!item || item.type !== constants.Type.COMMENT) {
        lastItem = item;
        break;
      }
    }

    if (lastItem && lastItem.char !== char) {
      const msg = `Expected ${name} to end with ${char}`;
      let err;

      if (typeof lastItem.offset === 'number') {
        err = new errors.YAMLSemanticError(cst, msg);
        err.offset = lastItem.offset + 1;
      } else {
        err = new errors.YAMLSemanticError(lastItem, msg);
        if (lastItem.range && lastItem.range.end) err.offset = lastItem.range.end - lastItem.range.start;
      }

      errors$1.push(err);
    }
  }

  function checkKeyLength(errors$1, node, itemIdx, key, keyStart) {
    if (!key || typeof keyStart !== 'number') return;
    const item = node.items[itemIdx];
    let keyEnd = item && item.range && item.range.start;

    if (!keyEnd) {
      for (let i = itemIdx - 1; i >= 0; --i) {
        const it = node.items[i];

        if (it && it.range) {
          keyEnd = it.range.end + 2 * (itemIdx - i);
          break;
        }
      }
    }

    if (keyEnd > keyStart + 1024) {
      const k = String(key).substr(0, 8) + '...' + String(key).substr(-8);
      errors$1.push(new errors.YAMLSemanticError(node, `The "${k}" key is too long`));
    }
  }

  function resolveComments(collection, comments) {
    for (const {
      afterKey,
      before,
      comment
    } of comments) {
      let item = collection.items[before];

      if (!item) {
        if (comment !== undefined) {
          if (collection.comment) collection.comment += '\n' + comment;else collection.comment = comment;
        }
      } else {
        if (afterKey && item.value) item = item.value;

        if (comment === undefined) {
          if (afterKey || !item.commentBefore) item.spaceBefore = true;
        } else {
          if (item.commentBefore) item.commentBefore += '\n' + comment;else item.commentBefore = comment;
        }
      }
    }
  }
});
unwrapExports(parseUtils);
var parseUtils_1 = parseUtils.checkFlowCollectionEnd;
var parseUtils_2 = parseUtils.checkKeyLength;
var parseUtils_3 = parseUtils.resolveComments;

var parseMap_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = parseMap;

  var _PlainValue = _interopRequireDefault(PlainValue_1);

  var _Map$1 = _interopRequireDefault(_Map);

  var _Merge = _interopRequireWildcard(Merge_1);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Alias = _interopRequireDefault(Alias_1$1);

  var _Collection = _interopRequireDefault(Collection_1$1);

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function parseMap(doc, cst) {
    if (cst.type !== constants.Type.MAP && cst.type !== constants.Type.FLOW_MAP) {
      const msg = `A ${cst.type} node cannot be resolved as a mapping`;
      doc.errors.push(new errors.YAMLSyntaxError(cst, msg));
      return null;
    }

    const {
      comments,
      items
    } = cst.type === constants.Type.FLOW_MAP ? resolveFlowMapItems(doc, cst) : resolveBlockMapItems(doc, cst);
    const map = new _Map$1.default();
    map.items = items;
    (0, parseUtils.resolveComments)(map, comments);
    let hasCollectionKey = false;

    for (let i = 0; i < items.length; ++i) {
      const {
        key: iKey
      } = items[i];
      if (iKey instanceof _Collection.default) hasCollectionKey = true;

      if (doc.schema.merge && iKey && iKey.value === _Merge.MERGE_KEY) {
        items[i] = new _Merge.default(items[i]);
        const sources = items[i].value.items;
        let error = null;
        sources.some(node => {
          if (node instanceof _Alias.default) {
            // During parsing, alias sources are CST nodes; to account for
            // circular references their resolved values can't be used here.
            const {
              type
            } = node.source;
            if (type === constants.Type.MAP || type === constants.Type.FLOW_MAP) return false;
            return error = 'Merge nodes aliases can only point to maps';
          }

          return error = 'Merge nodes can only have Alias nodes as values';
        });
        if (error) doc.errors.push(new errors.YAMLSemanticError(cst, error));
      } else {
        for (let j = i + 1; j < items.length; ++j) {
          const {
            key: jKey
          } = items[j];

          if (iKey === jKey || iKey && jKey && Object.prototype.hasOwnProperty.call(iKey, 'value') && iKey.value === jKey.value) {
            const msg = `Map keys must be unique; "${iKey}" is repeated`;
            doc.errors.push(new errors.YAMLSemanticError(cst, msg));
            break;
          }
        }
      }
    }

    if (hasCollectionKey && !doc.options.mapAsMap) {
      const warn = 'Keys with collection values will be stringified as YAML due to JS Object restrictions. Use mapAsMap: true to avoid this.';
      doc.warnings.push(new errors.YAMLWarning(cst, warn));
    }

    cst.resolved = map;
    return map;
  }

  const valueHasPairComment = ({
    context: {
      lineStart,
      node,
      src
    },
    props
  }) => {
    if (props.length === 0) return false;
    const {
      start
    } = props[0];
    if (node && start > node.valueRange.start) return false;
    if (src[start] !== constants.Char.COMMENT) return false;

    for (let i = lineStart; i < start; ++i) if (src[i] === '\n') return false;

    return true;
  };

  function resolvePairComment(item, pair) {
    if (!valueHasPairComment(item)) return;
    const comment = item.getPropValue(0, constants.Char.COMMENT, true);
    let found = false;
    const cb = pair.value.commentBefore;

    if (cb && cb.startsWith(comment)) {
      pair.value.commentBefore = cb.substr(comment.length + 1);
      found = true;
    } else {
      const cc = pair.value.comment;

      if (!item.node && cc && cc.startsWith(comment)) {
        pair.value.comment = cc.substr(comment.length + 1);
        found = true;
      }
    }

    if (found) pair.comment = comment;
  }

  function resolveBlockMapItems(doc, cst) {
    const comments = [];
    const items = [];
    let key = undefined;
    let keyStart = null;

    for (let i = 0; i < cst.items.length; ++i) {
      const item = cst.items[i];

      switch (item.type) {
        case constants.Type.BLANK_LINE:
          comments.push({
            afterKey: !!key,
            before: items.length
          });
          break;

        case constants.Type.COMMENT:
          comments.push({
            afterKey: !!key,
            before: items.length,
            comment: item.comment
          });
          break;

        case constants.Type.MAP_KEY:
          if (key !== undefined) items.push(new _Pair.default(key));
          if (item.error) doc.errors.push(item.error);
          key = doc.resolveNode(item.node);
          keyStart = null;
          break;

        case constants.Type.MAP_VALUE:
          {
            if (key === undefined) key = null;
            if (item.error) doc.errors.push(item.error);

            if (!item.context.atLineStart && item.node && item.node.type === constants.Type.MAP && !item.node.context.atLineStart) {
              const msg = 'Nested mappings are not allowed in compact mappings';
              doc.errors.push(new errors.YAMLSemanticError(item.node, msg));
            }

            let valueNode = item.node;

            if (!valueNode && item.props.length > 0) {
              // Comments on an empty mapping value need to be preserved, so we
              // need to construct a minimal empty node here to use instead of the
              // missing `item.node`. -- eemeli/yaml#19
              valueNode = new _PlainValue.default(constants.Type.PLAIN, []);
              valueNode.context = {
                parent: item,
                src: item.context.src
              };
              const pos = item.range.start + 1;
              valueNode.range = {
                start: pos,
                end: pos
              };
              valueNode.valueRange = {
                start: pos,
                end: pos
              };

              if (typeof item.range.origStart === 'number') {
                const origPos = item.range.origStart + 1;
                valueNode.range.origStart = valueNode.range.origEnd = origPos;
                valueNode.valueRange.origStart = valueNode.valueRange.origEnd = origPos;
              }
            }

            const pair = new _Pair.default(key, doc.resolveNode(valueNode));
            resolvePairComment(item, pair);
            items.push(pair);
            (0, parseUtils.checkKeyLength)(doc.errors, cst, i, key, keyStart);
            key = undefined;
            keyStart = null;
          }
          break;

        default:
          if (key !== undefined) items.push(new _Pair.default(key));
          key = doc.resolveNode(item);
          keyStart = item.range.start;
          if (item.error) doc.errors.push(item.error);

          next: for (let j = i + 1;; ++j) {
            const nextItem = cst.items[j];

            switch (nextItem && nextItem.type) {
              case constants.Type.BLANK_LINE:
              case constants.Type.COMMENT:
                continue next;

              case constants.Type.MAP_VALUE:
                break next;

              default:
                doc.errors.push(new errors.YAMLSemanticError(item, 'Implicit map keys need to be followed by map values'));
                break next;
            }
          }

          if (item.valueRangeContainsNewline) {
            const msg = 'Implicit map keys need to be on a single line';
            doc.errors.push(new errors.YAMLSemanticError(item, msg));
          }

      }
    }

    if (key !== undefined) items.push(new _Pair.default(key));
    return {
      comments,
      items
    };
  }

  function resolveFlowMapItems(doc, cst) {
    const comments = [];
    const items = [];
    let key = undefined;
    let keyStart = null;
    let explicitKey = false;
    let next = '{';

    for (let i = 0; i < cst.items.length; ++i) {
      (0, parseUtils.checkKeyLength)(doc.errors, cst, i, key, keyStart);
      const item = cst.items[i];

      if (typeof item.char === 'string') {
        const {
          char,
          offset
        } = item;

        if (char === '?' && key === undefined && !explicitKey) {
          explicitKey = true;
          next = ':';
          continue;
        }

        if (char === ':') {
          if (key === undefined) key = null;

          if (next === ':') {
            next = ',';
            continue;
          }
        } else {
          if (explicitKey) {
            if (key === undefined && char !== ',') key = null;
            explicitKey = false;
          }

          if (key !== undefined) {
            items.push(new _Pair.default(key));
            key = undefined;
            keyStart = null;

            if (char === ',') {
              next = ':';
              continue;
            }
          }
        }

        if (char === '}') {
          if (i === cst.items.length - 1) continue;
        } else if (char === next) {
          next = ':';
          continue;
        }

        const msg = `Flow map contains an unexpected ${char}`;
        const err = new errors.YAMLSyntaxError(cst, msg);
        err.offset = offset;
        doc.errors.push(err);
      } else if (item.type === constants.Type.BLANK_LINE) {
        comments.push({
          afterKey: !!key,
          before: items.length
        });
      } else if (item.type === constants.Type.COMMENT) {
        comments.push({
          afterKey: !!key,
          before: items.length,
          comment: item.comment
        });
      } else if (key === undefined) {
        if (next === ',') doc.errors.push(new errors.YAMLSemanticError(item, 'Separator , missing in flow map'));
        key = doc.resolveNode(item);
        keyStart = explicitKey ? null : item.range.start; // TODO: add error for non-explicit multiline plain key
      } else {
        if (next !== ',') doc.errors.push(new errors.YAMLSemanticError(item, 'Indicator : missing in flow map entry'));
        items.push(new _Pair.default(key, doc.resolveNode(item)));
        key = undefined;
        explicitKey = false;
      }
    }

    (0, parseUtils.checkFlowCollectionEnd)(doc.errors, cst);
    if (key !== undefined) items.push(new _Pair.default(key));
    return {
      comments,
      items
    };
  }
});
unwrapExports(parseMap_1);

var map = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Map$1 = _interopRequireDefault(_Map);

  var _parseMap = _interopRequireDefault(parseMap_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function createMap(schema, obj, ctx) {
    const map = new _Map$1.default(schema);

    if (obj instanceof Map) {
      for (const [key, value] of obj) map.items.push(schema.createPair(key, value, ctx));
    } else if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) map.items.push(schema.createPair(key, obj[key], ctx));
    }

    if (typeof schema.sortMapEntries === 'function') {
      map.items.sort(schema.sortMapEntries);
    }

    return map;
  }

  var _default = {
    createNode: createMap,
    default: true,
    nodeClass: _Map$1.default,
    tag: 'tag:yaml.org,2002:map',
    resolve: _parseMap.default
  };
  exports.default = _default;
});
unwrapExports(map);

var parseSeq_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = parseSeq;

  var _Pair = _interopRequireDefault(Pair_1);

  var _Seq = _interopRequireDefault(Seq);

  var _Collection = _interopRequireDefault(Collection_1$1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function parseSeq(doc, cst) {
    if (cst.type !== constants.Type.SEQ && cst.type !== constants.Type.FLOW_SEQ) {
      const msg = `A ${cst.type} node cannot be resolved as a sequence`;
      doc.errors.push(new errors.YAMLSyntaxError(cst, msg));
      return null;
    }

    const {
      comments,
      items
    } = cst.type === constants.Type.FLOW_SEQ ? resolveFlowSeqItems(doc, cst) : resolveBlockSeqItems(doc, cst);
    const seq = new _Seq.default();
    seq.items = items;
    (0, parseUtils.resolveComments)(seq, comments);

    if (!doc.options.mapAsMap && items.some(it => it instanceof _Pair.default && it.key instanceof _Collection.default)) {
      const warn = 'Keys with collection values will be stringified as YAML due to JS Object restrictions. Use mapAsMap: true to avoid this.';
      doc.warnings.push(new errors.YAMLWarning(cst, warn));
    }

    cst.resolved = seq;
    return seq;
  }

  function resolveBlockSeqItems(doc, cst) {
    const comments = [];
    const items = [];

    for (let i = 0; i < cst.items.length; ++i) {
      const item = cst.items[i];

      switch (item.type) {
        case constants.Type.BLANK_LINE:
          comments.push({
            before: items.length
          });
          break;

        case constants.Type.COMMENT:
          comments.push({
            comment: item.comment,
            before: items.length
          });
          break;

        case constants.Type.SEQ_ITEM:
          if (item.error) doc.errors.push(item.error);
          items.push(doc.resolveNode(item.node));

          if (item.hasProps) {
            const msg = 'Sequence items cannot have tags or anchors before the - indicator';
            doc.errors.push(new errors.YAMLSemanticError(item, msg));
          }

          break;

        default:
          if (item.error) doc.errors.push(item.error);
          doc.errors.push(new errors.YAMLSyntaxError(item, `Unexpected ${item.type} node in sequence`));
      }
    }

    return {
      comments,
      items
    };
  }

  function resolveFlowSeqItems(doc, cst) {
    const comments = [];
    const items = [];
    let explicitKey = false;
    let key = undefined;
    let keyStart = null;
    let next = '[';

    for (let i = 0; i < cst.items.length; ++i) {
      const item = cst.items[i];

      if (typeof item.char === 'string') {
        const {
          char,
          offset
        } = item;

        if (char !== ':' && (explicitKey || key !== undefined)) {
          if (explicitKey && key === undefined) key = next ? items.pop() : null;
          items.push(new _Pair.default(key));
          explicitKey = false;
          key = undefined;
          keyStart = null;
        }

        if (char === next) {
          next = null;
        } else if (!next && char === '?') {
          explicitKey = true;
        } else if (next !== '[' && char === ':' && key === undefined) {
          if (next === ',') {
            key = items.pop();

            if (key instanceof _Pair.default) {
              const msg = 'Chaining flow sequence pairs is invalid';
              const err = new errors.YAMLSemanticError(cst, msg);
              err.offset = offset;
              doc.errors.push(err);
            }

            if (!explicitKey) (0, parseUtils.checkKeyLength)(doc.errors, cst, i, key, keyStart);
          } else {
            key = null;
          }

          keyStart = null;
          explicitKey = false; // TODO: add error for non-explicit multiline plain key

          next = null;
        } else if (next === '[' || char !== ']' || i < cst.items.length - 1) {
          const msg = `Flow sequence contains an unexpected ${char}`;
          const err = new errors.YAMLSyntaxError(cst, msg);
          err.offset = offset;
          doc.errors.push(err);
        }
      } else if (item.type === constants.Type.BLANK_LINE) {
        comments.push({
          before: items.length
        });
      } else if (item.type === constants.Type.COMMENT) {
        comments.push({
          comment: item.comment,
          before: items.length
        });
      } else {
        if (next) {
          const msg = `Expected a ${next} in flow sequence`;
          doc.errors.push(new errors.YAMLSemanticError(item, msg));
        }

        const value = doc.resolveNode(item);

        if (key === undefined) {
          items.push(value);
        } else {
          items.push(new _Pair.default(key, value));
          key = undefined;
        }

        keyStart = item.range.start;
        next = ',';
      }
    }

    (0, parseUtils.checkFlowCollectionEnd)(doc.errors, cst);
    if (key !== undefined) items.push(new _Pair.default(key));
    return {
      comments,
      items
    };
  }
});
unwrapExports(parseSeq_1);

var seq = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _parseSeq = _interopRequireDefault(parseSeq_1);

  var _Seq = _interopRequireDefault(Seq);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function createSeq(schema, obj, ctx) {
    const seq = new _Seq.default(schema);

    if (obj && obj[Symbol.iterator]) {
      for (const it of obj) {
        const v = schema.createNode(it, ctx.wrapScalars, null, ctx);
        seq.items.push(v);
      }
    }

    return seq;
  }

  var _default = {
    createNode: createSeq,
    default: true,
    nodeClass: _Seq.default,
    tag: 'tag:yaml.org,2002:seq',
    resolve: _parseSeq.default
  };
  exports.default = _default;
});
unwrapExports(seq);

var string = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.resolveString = void 0;

  const resolveString = (doc, node) => {
    // on error, will return { str: string, errors: Error[] }
    const res = node.strValue;
    if (!res) return '';
    if (typeof res === 'string') return res;
    res.errors.forEach(error => {
      if (!error.source) error.source = node;
      doc.errors.push(error);
    });
    return res.str;
  };

  exports.resolveString = resolveString;
  var _default = {
    identify: value => typeof value === 'string',
    default: true,
    tag: 'tag:yaml.org,2002:str',
    resolve: resolveString,

    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({
        actualString: true
      }, ctx);
      return (0, stringify.stringifyString)(item, ctx, onComment, onChompKeep);
    },

    options: options.strOptions
  };
  exports.default = _default;
});
unwrapExports(string);
var string_1 = string.resolveString;

var failsafe = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _map = _interopRequireDefault(map);

  var _seq = _interopRequireDefault(seq);

  var _string = _interopRequireDefault(string);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  var _default = [_map.default, _seq.default, _string.default];
  exports.default = _default;
});
unwrapExports(failsafe);

var core = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.floatObj = exports.expObj = exports.nanObj = exports.hexObj = exports.intObj = exports.octObj = exports.boolObj = exports.nullObj = void 0;

  var _Scalar = _interopRequireDefault(Scalar_1);

  var _failsafe = _interopRequireDefault(failsafe);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const nullObj = {
    identify: value => value == null,
    createNode: (schema, value, ctx) => ctx.wrapScalars ? new _Scalar.default(null) : null,
    default: true,
    tag: 'tag:yaml.org,2002:null',
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => null,
    options: options.nullOptions,
    stringify: () => options.nullOptions.nullStr
  };
  exports.nullObj = nullObj;
  const boolObj = {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: str => str[0] === 't' || str[0] === 'T',
    options: options.boolOptions,
    stringify: ({
      value
    }) => value ? options.boolOptions.trueStr : options.boolOptions.falseStr
  };
  exports.boolObj = boolObj;
  const octObj = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^0o([0-7]+)$/,
    resolve: (str, oct) => parseInt(oct, 8),
    stringify: ({
      value
    }) => '0o' + value.toString(8)
  };
  exports.octObj = octObj;
  const intObj = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9]+$/,
    resolve: str => parseInt(str, 10),
    stringify: stringify.stringifyNumber
  };
  exports.intObj = intObj;
  const hexObj = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^0x([0-9a-fA-F]+)$/,
    resolve: (str, hex) => parseInt(hex, 16),
    stringify: ({
      value
    }) => '0x' + value.toString(16)
  };
  exports.hexObj = hexObj;
  const nanObj = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.inf|(\.nan))$/i,
    resolve: (str, nan) => nan ? NaN : str[0] === '-' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringify.stringifyNumber
  };
  exports.nanObj = nanObj;
  const expObj = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:0|[1-9][0-9]*)(\.[0-9]*)?[eE][-+]?[0-9]+$/,
    resolve: str => parseFloat(str),
    stringify: ({
      value
    }) => Number(value).toExponential()
  };
  exports.expObj = expObj;
  const floatObj = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:0|[1-9][0-9]*)\.([0-9]*)$/,

    resolve(str, frac) {
      const node = new _Scalar.default(parseFloat(str));
      if (frac && frac[frac.length - 1] === '0') node.minFractionDigits = frac.length;
      return node;
    },

    stringify: stringify.stringifyNumber
  };
  exports.floatObj = floatObj;

  var _default = _failsafe.default.concat([nullObj, boolObj, octObj, intObj, hexObj, nanObj, expObj, floatObj]);

  exports.default = _default;
});
unwrapExports(core);
var core_1 = core.floatObj;
var core_2 = core.expObj;
var core_3 = core.nanObj;
var core_4 = core.hexObj;
var core_5 = core.intObj;
var core_6 = core.octObj;
var core_7 = core.boolObj;
var core_8 = core.nullObj;

var json = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _map = _interopRequireDefault(map);

  var _seq = _interopRequireDefault(seq);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const schema = [_map.default, _seq.default, {
    identify: value => typeof value === 'string',
    default: true,
    tag: 'tag:yaml.org,2002:str',
    resolve: string.resolveString,
    stringify: value => JSON.stringify(value)
  }, {
    identify: value => value == null,
    createNode: (schema, value, ctx) => ctx.wrapScalars ? new _Scalar.default(null) : null,
    default: true,
    tag: 'tag:yaml.org,2002:null',
    test: /^null$/,
    resolve: () => null,
    stringify: value => JSON.stringify(value)
  }, {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^true|false$/,
    resolve: str => str === 'true',
    stringify: value => JSON.stringify(value)
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: str => parseInt(str, 10),
    stringify: value => JSON.stringify(value)
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: str => parseFloat(str),
    stringify: value => JSON.stringify(value)
  }];

  schema.scalarFallback = str => {
    throw new SyntaxError(`Unresolved plain scalar ${JSON.stringify(str)}`);
  };

  var _default = schema;
  exports.default = _default;
});
unwrapExports(json);

var binary = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;
  /* global atob, btoa, Buffer */

  var _default = {
    identify: value => value instanceof Uint8Array,
    // Buffer inherits from Uint8Array
    default: false,
    tag: 'tag:yaml.org,2002:binary',

    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve: (doc, node) => {
      if (typeof Buffer === 'function') {
        const src = (0, string.resolveString)(doc, node);
        return Buffer.from(src, 'base64');
      } else if (typeof atob === 'function') {
        const src = atob((0, string.resolveString)(doc, node));
        const buffer = new Uint8Array(src.length);

        for (let i = 0; i < src.length; ++i) buffer[i] = src.charCodeAt(i);

        return buffer;
      } else {
        doc.errors.push(new errors.YAMLReferenceError(node, 'This environment does not support reading binary tags; either Buffer or atob is required'));
        return null;
      }
    },
    options: options.binaryOptions,
    stringify: ({
      comment,
      type,
      value
    }, ctx, onComment, onChompKeep) => {
      let src;

      if (typeof Buffer === 'function') {
        src = value instanceof Buffer ? value.toString('base64') : Buffer.from(value.buffer).toString('base64');
      } else if (typeof btoa === 'function') {
        let s = '';

        for (let i = 0; i < value.length; ++i) s += String.fromCharCode(value[i]);

        src = btoa(s);
      } else {
        throw new Error('This environment does not support writing binary tags; either Buffer or btoa is required');
      }

      if (!type) type = options.binaryOptions.defaultType;

      if (type === constants.Type.QUOTE_DOUBLE) {
        value = src;
      } else {
        const {
          lineWidth
        } = options.binaryOptions;
        const n = Math.ceil(src.length / lineWidth);
        const lines = new Array(n);

        for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
          lines[i] = src.substr(o, lineWidth);
        }

        value = lines.join(type === constants.Type.BLOCK_LITERAL ? '\n' : ' ');
      }

      return (0, stringify.stringifyString)({
        comment,
        type,
        value
      }, ctx, onComment, onChompKeep);
    }
  };
  exports.default = _default;
});
unwrapExports(binary);

var pairs = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.parsePairs = parsePairs;
  exports.createPairs = createPairs;
  exports.default = void 0;

  var _Map$1 = _interopRequireDefault(_Map);

  var _Pair = _interopRequireDefault(Pair_1);

  var _parseSeq = _interopRequireDefault(parseSeq_1);

  var _Seq = _interopRequireDefault(Seq);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function parsePairs(doc, cst) {
    const seq = (0, _parseSeq.default)(doc, cst);

    for (let i = 0; i < seq.items.length; ++i) {
      let item = seq.items[i];
      if (item instanceof _Pair.default) continue;else if (item instanceof _Map$1.default) {
        if (item.items.length > 1) {
          const msg = 'Each pair must have its own sequence indicator';
          throw new errors.YAMLSemanticError(cst, msg);
        }

        const pair = item.items[0] || new _Pair.default();
        if (item.commentBefore) pair.commentBefore = pair.commentBefore ? `${item.commentBefore}\n${pair.commentBefore}` : item.commentBefore;
        if (item.comment) pair.comment = pair.comment ? `${item.comment}\n${pair.comment}` : item.comment;
        item = pair;
      }
      seq.items[i] = item instanceof _Pair.default ? item : new _Pair.default(item);
    }

    return seq;
  }

  function createPairs(schema, iterable, ctx) {
    const pairs = new _Seq.default(schema);
    pairs.tag = 'tag:yaml.org,2002:pairs';

    for (const it of iterable) {
      let key, value;

      if (Array.isArray(it)) {
        if (it.length === 2) {
          key = it[0];
          value = it[1];
        } else throw new TypeError(`Expected [key, value] tuple: ${it}`);
      } else if (it && it instanceof Object) {
        const keys = Object.keys(it);

        if (keys.length === 1) {
          key = keys[0];
          value = it[key];
        } else throw new TypeError(`Expected { key: value } tuple: ${it}`);
      } else {
        key = it;
      }

      const pair = schema.createPair(key, value, ctx);
      pairs.items.push(pair);
    }

    return pairs;
  }

  var _default = {
    default: false,
    tag: 'tag:yaml.org,2002:pairs',
    resolve: parsePairs,
    createNode: createPairs
  };
  exports.default = _default;
});
unwrapExports(pairs);
var pairs_1 = pairs.parsePairs;
var pairs_2 = pairs.createPairs;

var omap = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.YAMLOMap = void 0;

  var _toJSON = _interopRequireDefault(toJSON_1);

  var _Map$1 = _interopRequireDefault(_Map);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  var _Seq = _interopRequireDefault(Seq);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  class YAMLOMap extends _Seq.default {
    constructor() {
      super();

      _defineProperty(this, "add", _Map$1.default.prototype.add.bind(this));

      _defineProperty(this, "delete", _Map$1.default.prototype.delete.bind(this));

      _defineProperty(this, "get", _Map$1.default.prototype.get.bind(this));

      _defineProperty(this, "has", _Map$1.default.prototype.has.bind(this));

      _defineProperty(this, "set", _Map$1.default.prototype.set.bind(this));

      this.tag = YAMLOMap.tag;
    }

    toJSON(_, ctx) {
      const map = new Map();
      if (ctx && ctx.onCreate) ctx.onCreate(map);

      for (const pair of this.items) {
        let key, value;

        if (pair instanceof _Pair.default) {
          key = (0, _toJSON.default)(pair.key, '', ctx);
          value = (0, _toJSON.default)(pair.value, key, ctx);
        } else {
          key = (0, _toJSON.default)(pair, '', ctx);
        }

        if (map.has(key)) throw new Error('Ordered maps must not include duplicate keys');
        map.set(key, value);
      }

      return map;
    }

  }

  exports.YAMLOMap = YAMLOMap;

  _defineProperty(YAMLOMap, "tag", 'tag:yaml.org,2002:omap');

  function parseOMap(doc, cst) {
    const pairs$1 = (0, pairs.parsePairs)(doc, cst);
    const seenKeys = [];

    for (const {
      key
    } of pairs$1.items) {
      if (key instanceof _Scalar.default) {
        if (seenKeys.includes(key.value)) {
          const msg = 'Ordered maps must not include duplicate keys';
          throw new errors.YAMLSemanticError(cst, msg);
        } else {
          seenKeys.push(key.value);
        }
      }
    }

    return Object.assign(new YAMLOMap(), pairs$1);
  }

  function createOMap(schema, iterable, ctx) {
    const pairs$1 = (0, pairs.createPairs)(schema, iterable, ctx);
    const omap = new YAMLOMap();
    omap.items = pairs$1.items;
    return omap;
  }

  var _default = {
    identify: value => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: 'tag:yaml.org,2002:omap',
    resolve: parseOMap,
    createNode: createOMap
  };
  exports.default = _default;
});
unwrapExports(omap);
var omap_1 = omap.YAMLOMap;

var set = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = exports.YAMLSet = void 0;

  var _Map$1 = _interopRequireWildcard(_Map);

  var _Pair = _interopRequireDefault(Pair_1);

  var _parseMap = _interopRequireDefault(parseMap_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  class YAMLSet extends _Map$1.default {
    constructor() {
      super();
      this.tag = YAMLSet.tag;
    }

    add(key) {
      const pair = key instanceof _Pair.default ? key : new _Pair.default(key);
      const prev = (0, _Map$1.findPair)(this.items, pair.key);
      if (!prev) this.items.push(pair);
    }

    get(key, keepPair) {
      const pair = (0, _Map$1.findPair)(this.items, key);
      return !keepPair && pair instanceof _Pair.default ? pair.key instanceof _Scalar.default ? pair.key.value : pair.key : pair;
    }

    set(key, value) {
      if (typeof value !== 'boolean') throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = (0, _Map$1.findPair)(this.items, key);

      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new _Pair.default(key));
      }
    }

    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }

    toString(ctx, onComment, onChompKeep) {
      if (!ctx) return JSON.stringify(this);
      if (this.hasAllNullValues()) return super.toString(ctx, onComment, onChompKeep);else throw new Error('Set items must all have null values');
    }

  }

  exports.YAMLSet = YAMLSet;

  _defineProperty(YAMLSet, "tag", 'tag:yaml.org,2002:set');

  function parseSet(doc, cst) {
    const map = (0, _parseMap.default)(doc, cst);
    if (!map.hasAllNullValues()) throw new errors.YAMLSemanticError(cst, 'Set items must all have null values');
    return Object.assign(new YAMLSet(), map);
  }

  function createSet(schema, iterable, ctx) {
    const set = new YAMLSet();

    for (const value of iterable) set.items.push(schema.createPair(value, null, ctx));

    return set;
  }

  var _default = {
    identify: value => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: 'tag:yaml.org,2002:set',
    resolve: parseSet,
    createNode: createSet
  };
  exports.default = _default;
});
unwrapExports(set);
var set_1 = set.YAMLSet;

var timestamp_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.timestamp = exports.floatTime = exports.intTime = void 0;

  const parseSexagesimal = (sign, parts) => {
    const n = parts.split(':').reduce((n, p) => n * 60 + Number(p), 0);
    return sign === '-' ? -n : n;
  }; // hhhh:mm:ss.sss


  const stringifySexagesimal = ({
    value
  }) => {
    if (isNaN(value) || !isFinite(value)) return (0, stringify.stringifyNumber)(value);
    let sign = '';

    if (value < 0) {
      sign = '-';
      value = Math.abs(value);
    }

    const parts = [value % 60]; // seconds, including ms

    if (value < 60) {
      parts.unshift(0); // at least one : is required
    } else {
      value = Math.round((value - parts[0]) / 60);
      parts.unshift(value % 60); // minutes

      if (value >= 60) {
        value = Math.round((value - parts[0]) / 60);
        parts.unshift(value); // hours
      }
    }

    return sign + parts.map(n => n < 10 ? '0' + String(n) : String(n)).join(':').replace(/000000\d*$/, '') // % 60 may introduce error
    ;
  };

  const intTime = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'TIME',
    test: /^([-+]?)([0-9][0-9_]*(?::[0-5]?[0-9])+)$/,
    resolve: (str, sign, parts) => parseSexagesimal(sign, parts.replace(/_/g, '')),
    stringify: stringifySexagesimal
  };
  exports.intTime = intTime;
  const floatTime = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'TIME',
    test: /^([-+]?)([0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*)$/,
    resolve: (str, sign, parts) => parseSexagesimal(sign, parts.replace(/_/g, '')),
    stringify: stringifySexagesimal
  };
  exports.floatTime = floatTime;
  const timestamp = {
    identify: value => value instanceof Date,
    default: true,
    tag: 'tag:yaml.org,2002:timestamp',
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp('^(?:' + '([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})' + // YYYY-Mm-Dd
    '(?:(?:t|T|[ \\t]+)' + // t | T | whitespace
    '([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)' + // Hh:Mm:Ss(.ss)?
    '(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?' + // Z | +5 | -03:30
    ')?' + ')$'),
    resolve: (str, year, month, day, hour, minute, second, millisec, tz) => {
      if (millisec) millisec = (millisec + '00').substr(1, 3);
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec || 0);

      if (tz && tz !== 'Z') {
        let d = parseSexagesimal(tz[0], tz.slice(1));
        if (Math.abs(d) < 30) d *= 60;
        date -= 60000 * d;
      }

      return new Date(date);
    },
    stringify: ({
      value
    }) => value.toISOString().replace(/((T00:00)?:00)?\.000Z$/, '')
  };
  exports.timestamp = timestamp;
});
unwrapExports(timestamp_1);
var timestamp_2 = timestamp_1.timestamp;
var timestamp_3 = timestamp_1.floatTime;
var timestamp_4 = timestamp_1.intTime;

var yaml1_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Scalar = _interopRequireDefault(Scalar_1);

  var _failsafe = _interopRequireDefault(failsafe);

  var _binary = _interopRequireDefault(binary);

  var _omap = _interopRequireDefault(omap);

  var _pairs = _interopRequireDefault(pairs);

  var _set = _interopRequireDefault(set);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const boolStringify = ({
    value
  }) => value ? options.boolOptions.trueStr : options.boolOptions.falseStr;

  var _default = _failsafe.default.concat([{
    identify: value => value == null,
    createNode: (schema, value, ctx) => ctx.wrapScalars ? new _Scalar.default(null) : null,
    default: true,
    tag: 'tag:yaml.org,2002:null',
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => null,
    options: options.nullOptions,
    stringify: () => options.nullOptions.nullStr
  }, {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => true,
    options: options.boolOptions,
    stringify: boolStringify
  }, {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/i,
    resolve: () => false,
    options: options.boolOptions,
    stringify: boolStringify
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'BIN',
    test: /^0b([0-1_]+)$/,
    resolve: (str, bin) => parseInt(bin.replace(/_/g, ''), 2),
    stringify: ({
      value
    }) => '0b' + value.toString(2)
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^[-+]?0([0-7_]+)$/,
    resolve: (str, oct) => parseInt(oct.replace(/_/g, ''), 8),
    stringify: ({
      value
    }) => (value < 0 ? '-0' : '0') + value.toString(8)
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: str => parseInt(str.replace(/_/g, ''), 10),
    stringify: stringify.stringifyNumber
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^0x([0-9a-fA-F_]+)$/,
    resolve: (str, hex) => parseInt(hex.replace(/_/g, ''), 16),
    stringify: ({
      value
    }) => (value < 0 ? '-0x' : '0x') + value.toString(16)
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.inf|(\.nan))$/i,
    resolve: (str, nan) => nan ? NaN : str[0] === '-' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringify.stringifyNumber
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?([0-9][0-9_]*)?(\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: str => parseFloat(str.replace(/_/g, '')),
    stringify: ({
      value
    }) => Number(value).toExponential()
  }, {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:[0-9][0-9_]*)?\.([0-9_]*)$/,

    resolve(str, frac) {
      const node = new _Scalar.default(parseFloat(str.replace(/_/g, '')));

      if (frac) {
        const f = frac.replace(/_/g, '');
        if (f[f.length - 1] === '0') node.minFractionDigits = f.length;
      }

      return node;
    },

    stringify: stringify.stringifyNumber
  }], _binary.default, _omap.default, _pairs.default, _set.default, timestamp_1.intTime, timestamp_1.floatTime, timestamp_1.timestamp);

  exports.default = _default;
});
unwrapExports(yaml1_1);

var tags_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.tags = exports.schemas = void 0;

  var _core = _interopRequireWildcard(core);

  var _failsafe = _interopRequireDefault(failsafe);

  var _json = _interopRequireDefault(json);

  var _yaml = _interopRequireDefault(yaml1_1);

  var _map = _interopRequireDefault(map);

  var _seq = _interopRequireDefault(seq);

  var _binary = _interopRequireDefault(binary);

  var _omap = _interopRequireDefault(omap);

  var _pairs = _interopRequireDefault(pairs);

  var _set = _interopRequireDefault(set);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  const schemas = {
    core: _core.default,
    failsafe: _failsafe.default,
    json: _json.default,
    yaml11: _yaml.default
  };
  exports.schemas = schemas;
  const tags = {
    binary: _binary.default,
    bool: _core.boolObj,
    float: _core.floatObj,
    floatExp: _core.expObj,
    floatNaN: _core.nanObj,
    floatTime: timestamp_1.floatTime,
    int: _core.intObj,
    intHex: _core.hexObj,
    intOct: _core.octObj,
    intTime: timestamp_1.intTime,
    map: _map.default,
    null: _core.nullObj,
    omap: _omap.default,
    pairs: _pairs.default,
    seq: _seq.default,
    set: _set.default,
    timestamp: timestamp_1.timestamp
  };
  exports.tags = tags;
});
unwrapExports(tags_1);
var tags_2 = tags_1.tags;
var tags_3 = tags_1.schemas;

var schema = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _Alias = _interopRequireDefault(Alias_1$1);

  var _Collection = _interopRequireDefault(Collection_1$1);

  var _Node = _interopRequireDefault(Node_1$1);

  var _Pair = _interopRequireDefault(Pair_1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  const isMap = ({
    type
  }) => type === constants.Type.FLOW_MAP || type === constants.Type.MAP;

  const isSeq = ({
    type
  }) => type === constants.Type.FLOW_SEQ || type === constants.Type.SEQ;

  class Schema {
    constructor({
      customTags,
      merge,
      schema,
      sortMapEntries,
      tags: deprecatedCustomTags
    }) {
      this.merge = !!merge;
      this.name = schema;
      this.sortMapEntries = sortMapEntries === true ? (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0 : sortMapEntries || null;
      this.tags = tags_1.schemas[schema.replace(/\W/g, '')]; // 'yaml-1.1' -> 'yaml11'

      if (!this.tags) {
        const keys = Object.keys(tags_1.schemas).map(key => JSON.stringify(key)).join(', ');
        throw new Error(`Unknown schema "${schema}"; use one of ${keys}`);
      }

      if (!customTags && deprecatedCustomTags) {
        customTags = deprecatedCustomTags;
        (0, warnings.warnOptionDeprecation)('tags', 'customTags');
      }

      if (Array.isArray(customTags)) {
        for (const tag of customTags) this.tags = this.tags.concat(tag);
      } else if (typeof customTags === 'function') {
        this.tags = customTags(this.tags.slice());
      }

      for (let i = 0; i < this.tags.length; ++i) {
        const tag = this.tags[i];

        if (typeof tag === 'string') {
          const tagObj = tags_1.tags[tag];

          if (!tagObj) {
            const keys = Object.keys(tags_1.tags).map(key => JSON.stringify(key)).join(', ');
            throw new Error(`Unknown custom tag "${tag}"; use one of ${keys}`);
          }

          this.tags[i] = tagObj;
        }
      }
    }

    createNode(value, wrapScalars, tag, ctx) {
      if (value instanceof _Node.default) return value;
      let tagObj;

      if (tag) {
        if (tag.startsWith('!!')) tag = Schema.defaultPrefix + tag.slice(2);
        const match = this.tags.filter(t => t.tag === tag);
        tagObj = match.find(t => !t.format) || match[0];
        if (!tagObj) throw new Error(`Tag ${tag} not found`);
      } else {
        // TODO: deprecate/remove class check
        tagObj = this.tags.find(t => (t.identify && t.identify(value) || t.class && value instanceof t.class) && !t.format);

        if (!tagObj) {
          if (typeof value.toJSON === 'function') value = value.toJSON();
          if (typeof value !== 'object') return wrapScalars ? new _Scalar.default(value) : value;
          tagObj = value instanceof Map ? tags_1.tags.map : value[Symbol.iterator] ? tags_1.tags.seq : tags_1.tags.map;
        }
      }

      if (!ctx) ctx = {
        wrapScalars
      };else ctx.wrapScalars = wrapScalars;

      if (ctx.onTagObj) {
        ctx.onTagObj(tagObj);
        delete ctx.onTagObj;
      }

      const obj = {};

      if (value && typeof value === 'object' && ctx.prevObjects) {
        const prev = ctx.prevObjects.get(value);

        if (prev) {
          const alias = new _Alias.default(prev); // leaves source dirty; must be cleaned by caller

          ctx.aliasNodes.push(alias);
          return alias;
        }

        obj.value = value;
        ctx.prevObjects.set(value, obj);
      }

      obj.node = tagObj.createNode ? tagObj.createNode(this, value, ctx) : wrapScalars ? new _Scalar.default(value) : value;
      if (tag && obj.node instanceof _Node.default) obj.node.tag = tag;
      return obj.node;
    }

    createPair(key, value, ctx) {
      const k = this.createNode(key, ctx.wrapScalars, null, ctx);
      const v = this.createNode(value, ctx.wrapScalars, null, ctx);
      return new _Pair.default(k, v);
    } // falls back to string on no match


    resolveScalar(str, tags) {
      if (!tags) tags = this.tags;

      for (let i = 0; i < tags.length; ++i) {
        const {
          format,
          test,
          resolve
        } = tags[i];

        if (test) {
          const match = str.match(test);

          if (match) {
            let res = resolve.apply(null, match);
            if (!(res instanceof _Scalar.default)) res = new _Scalar.default(res);
            if (format) res.format = format;
            return res;
          }
        }
      }

      if (this.tags.scalarFallback) str = this.tags.scalarFallback(str);
      return new _Scalar.default(str);
    } // sets node.resolved on success


    resolveNode(doc, node, tagName) {
      const tags = this.tags.filter(({
        tag
      }) => tag === tagName);
      const generic = tags.find(({
        test
      }) => !test);
      if (node.error) doc.errors.push(node.error);

      try {
        if (generic) {
          let res = generic.resolve(doc, node);
          if (!(res instanceof _Collection.default)) res = new _Scalar.default(res);
          node.resolved = res;
        } else {
          const str = (0, string.resolveString)(doc, node);

          if (typeof str === 'string' && tags.length > 0) {
            node.resolved = this.resolveScalar(str, tags);
          }
        }
      } catch (error) {
        /* istanbul ignore if */
        if (!error.source) error.source = node;
        doc.errors.push(error);
        node.resolved = null;
      }

      if (!node.resolved) return null;
      if (tagName && node.tag) node.resolved.tag = tagName;
      return node.resolved;
    }

    resolveNodeWithFallback(doc, node, tagName) {
      const res = this.resolveNode(doc, node, tagName);
      if (Object.prototype.hasOwnProperty.call(node, 'resolved')) return res;
      const fallback = isMap(node) ? Schema.defaultTags.MAP : isSeq(node) ? Schema.defaultTags.SEQ : Schema.defaultTags.STR;
      /* istanbul ignore else */

      if (fallback) {
        doc.warnings.push(new errors.YAMLWarning(node, `The tag ${tagName} is unavailable, falling back to ${fallback}`));
        const res = this.resolveNode(doc, node, fallback);
        res.tag = tagName;
        return res;
      } else {
        doc.errors.push(new errors.YAMLReferenceError(node, `The tag ${tagName} is unavailable`));
        return null;
      }
    }

    getTagObject(item) {
      if (item instanceof _Alias.default) return _Alias.default;

      if (item.tag) {
        const match = this.tags.filter(t => t.tag === item.tag);
        if (match.length > 0) return match.find(t => t.format === item.format) || match[0];
      }

      let tagObj, obj;

      if (item instanceof _Scalar.default) {
        obj = item.value; // TODO: deprecate/remove class check

        const match = this.tags.filter(t => t.identify && t.identify(obj) || t.class && obj instanceof t.class);
        tagObj = match.find(t => t.format === item.format) || match.find(t => !t.format);
      } else {
        obj = item;
        tagObj = this.tags.find(t => t.nodeClass && obj instanceof t.nodeClass);
      }

      if (!tagObj) {
        const name = obj && obj.constructor ? obj.constructor.name : typeof obj;
        throw new Error(`Tag not resolved for ${name} value`);
      }

      return tagObj;
    } // needs to be called before stringifier to allow for circular anchor refs


    stringifyProps(node, tagObj, {
      anchors,
      doc
    }) {
      const props = [];
      const anchor = doc.anchors.getName(node);

      if (anchor) {
        anchors[anchor] = node;
        props.push(`&${anchor}`);
      }

      if (node.tag) {
        props.push(doc.stringifyTag(node.tag));
      } else if (!tagObj.default) {
        props.push(doc.stringifyTag(tagObj.tag));
      }

      return props.join(' ');
    }

    stringify(item, ctx, onComment, onChompKeep) {
      let tagObj;

      if (!(item instanceof _Node.default)) {
        const createCtx = {
          aliasNodes: [],
          onTagObj: o => tagObj = o,
          prevObjects: new Map()
        };
        item = this.createNode(item, true, null, createCtx);
        const {
          anchors
        } = ctx.doc;

        for (const alias of createCtx.aliasNodes) {
          alias.source = alias.source.node;
          let name = anchors.getName(alias.source);

          if (!name) {
            name = anchors.newName();
            anchors.map[name] = alias.source;
          }
        }
      }

      ctx.tags = this;
      if (item instanceof _Pair.default) return item.toString(ctx, onComment, onChompKeep);
      if (!tagObj) tagObj = this.getTagObject(item);
      const props = this.stringifyProps(item, tagObj, ctx);
      if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart || 0) + props.length + 1;
      const str = typeof tagObj.stringify === 'function' ? tagObj.stringify(item, ctx, onComment, onChompKeep) : item instanceof _Collection.default ? item.toString(ctx, onComment, onChompKeep) : (0, stringify.stringifyString)(item, ctx, onComment, onChompKeep);
      return props ? item instanceof _Collection.default && str[0] !== '{' && str[0] !== '[' ? `${props}\n${ctx.indent}${str}` : `${props} ${str}` : str;
    }

  }

  exports.default = Schema;

  _defineProperty(Schema, "defaultPrefix", 'tag:yaml.org,2002:');

  _defineProperty(Schema, "defaultTags", {
    MAP: 'tag:yaml.org,2002:map',
    SEQ: 'tag:yaml.org,2002:seq',
    STR: 'tag:yaml.org,2002:str'
  });
});
unwrapExports(schema);

var Document_1$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _addComment = _interopRequireDefault(addComment_1);

  var _Anchors = _interopRequireDefault(Anchors_1);

  var _listTagNames = _interopRequireDefault(listTagNames);

  var _schema = _interopRequireDefault(schema);

  var _Alias = _interopRequireDefault(Alias_1$1);

  var _Collection = _interopRequireWildcard(Collection_1$1);

  var _Node = _interopRequireDefault(Node_1$1);

  var _Scalar = _interopRequireDefault(Scalar_1);

  var _toJSON = _interopRequireDefault(toJSON_1);

  function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();

    _getRequireWildcardCache = function () {
      return cache;
    };

    return cache;
  }

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    }

    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
      return {
        default: obj
      };
    }

    var cache = _getRequireWildcardCache();

    if (cache && cache.has(obj)) {
      return cache.get(obj);
    }

    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

        if (desc && (desc.get || desc.set)) {
          Object.defineProperty(newObj, key, desc);
        } else {
          newObj[key] = obj[key];
        }
      }
    }

    newObj.default = obj;

    if (cache) {
      cache.set(obj, newObj);
    }

    return newObj;
  }

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  const isCollectionItem = node => node && [constants.Type.MAP_KEY, constants.Type.MAP_VALUE, constants.Type.SEQ_ITEM].includes(node.type);

  class Document {
    constructor(options) {
      this.anchors = new _Anchors.default(options.anchorPrefix);
      this.commentBefore = null;
      this.comment = null;
      this.contents = null;
      this.directivesEndMarker = null;
      this.errors = [];
      this.options = options;
      this.schema = null;
      this.tagPrefixes = [];
      this.version = null;
      this.warnings = [];
    }

    assertCollectionContents() {
      if (this.contents instanceof _Collection.default) return true;
      throw new Error('Expected a YAML collection as document contents');
    }

    add(value) {
      this.assertCollectionContents();
      return this.contents.add(value);
    }

    addIn(path, value) {
      this.assertCollectionContents();
      this.contents.addIn(path, value);
    }

    delete(key) {
      this.assertCollectionContents();
      return this.contents.delete(key);
    }

    deleteIn(path) {
      if ((0, _Collection.isEmptyPath)(path)) {
        if (this.contents == null) return false;
        this.contents = null;
        return true;
      }

      this.assertCollectionContents();
      return this.contents.deleteIn(path);
    }

    getDefaults() {
      return Document.defaults[this.version] || Document.defaults[this.options.version] || {};
    }

    get(key, keepScalar) {
      return this.contents instanceof _Collection.default ? this.contents.get(key, keepScalar) : undefined;
    }

    getIn(path, keepScalar) {
      if ((0, _Collection.isEmptyPath)(path)) return !keepScalar && this.contents instanceof _Scalar.default ? this.contents.value : this.contents;
      return this.contents instanceof _Collection.default ? this.contents.getIn(path, keepScalar) : undefined;
    }

    has(key) {
      return this.contents instanceof _Collection.default ? this.contents.has(key) : false;
    }

    hasIn(path) {
      if ((0, _Collection.isEmptyPath)(path)) return this.contents !== undefined;
      return this.contents instanceof _Collection.default ? this.contents.hasIn(path) : false;
    }

    set(key, value) {
      this.assertCollectionContents();
      this.contents.set(key, value);
    }

    setIn(path, value) {
      if ((0, _Collection.isEmptyPath)(path)) this.contents = value;else {
        this.assertCollectionContents();
        this.contents.setIn(path, value);
      }
    }

    setSchema(id, customTags) {
      if (!id && !customTags && this.schema) return;
      if (typeof id === 'number') id = id.toFixed(1);

      if (id === '1.0' || id === '1.1' || id === '1.2') {
        if (this.version) this.version = id;else this.options.version = id;
        delete this.options.schema;
      } else if (id && typeof id === 'string') {
        this.options.schema = id;
      }

      if (Array.isArray(customTags)) this.options.customTags = customTags;
      const opt = Object.assign({}, this.getDefaults(), this.options);
      this.schema = new _schema.default(opt);
    }

    parse(node, prevDoc) {
      if (this.options.keepCstNodes) this.cstNode = node;
      if (this.options.keepNodeTypes) this.type = 'DOCUMENT';
      const {
        directives = [],
        contents = [],
        directivesEndMarker,
        error,
        valueRange
      } = node;

      if (error) {
        if (!error.source) error.source = this;
        this.errors.push(error);
      }

      this.parseDirectives(directives, prevDoc);
      if (directivesEndMarker) this.directivesEndMarker = true;
      this.range = valueRange ? [valueRange.start, valueRange.end] : null;
      this.setSchema();
      this.anchors._cstAliases = [];
      this.parseContents(contents);
      this.anchors.resolveNodes();

      if (this.options.prettyErrors) {
        for (const error of this.errors) if (error instanceof errors.YAMLError) error.makePretty();

        for (const warn of this.warnings) if (warn instanceof errors.YAMLError) warn.makePretty();
      }

      return this;
    }

    parseDirectives(directives, prevDoc) {
      const directiveComments = [];
      let hasDirectives = false;
      directives.forEach(directive => {
        const {
          comment,
          name
        } = directive;

        switch (name) {
          case 'TAG':
            this.resolveTagDirective(directive);
            hasDirectives = true;
            break;

          case 'YAML':
          case 'YAML:1.0':
            this.resolveYamlDirective(directive);
            hasDirectives = true;
            break;

          default:
            if (name) {
              const msg = `YAML only supports %TAG and %YAML directives, and not %${name}`;
              this.warnings.push(new errors.YAMLWarning(directive, msg));
            }

        }

        if (comment) directiveComments.push(comment);
      });

      if (prevDoc && !hasDirectives && '1.1' === (this.version || prevDoc.version || this.options.version)) {
        const copyTagPrefix = ({
          handle,
          prefix
        }) => ({
          handle,
          prefix
        });

        this.tagPrefixes = prevDoc.tagPrefixes.map(copyTagPrefix);
        this.version = prevDoc.version;
      }

      this.commentBefore = directiveComments.join('\n') || null;
    }

    parseContents(contents) {
      const comments = {
        before: [],
        after: []
      };
      const contentNodes = [];
      let spaceBefore = false;
      contents.forEach(node => {
        if (node.valueRange) {
          if (contentNodes.length === 1) {
            const msg = 'Document is not valid YAML (bad indentation?)';
            this.errors.push(new errors.YAMLSyntaxError(node, msg));
          }

          const res = this.resolveNode(node);

          if (spaceBefore) {
            res.spaceBefore = true;
            spaceBefore = false;
          }

          contentNodes.push(res);
        } else if (node.comment !== null) {
          const cc = contentNodes.length === 0 ? comments.before : comments.after;
          cc.push(node.comment);
        } else if (node.type === constants.Type.BLANK_LINE) {
          spaceBefore = true;

          if (contentNodes.length === 0 && comments.before.length > 0 && !this.commentBefore) {
            // space-separated comments at start are parsed as document comments
            this.commentBefore = comments.before.join('\n');
            comments.before = [];
          }
        }
      });

      switch (contentNodes.length) {
        case 0:
          this.contents = null;
          comments.after = comments.before;
          break;

        case 1:
          this.contents = contentNodes[0];

          if (this.contents) {
            const cb = comments.before.join('\n') || null;

            if (cb) {
              const cbNode = this.contents instanceof _Collection.default && this.contents.items[0] ? this.contents.items[0] : this.contents;
              cbNode.commentBefore = cbNode.commentBefore ? `${cb}\n${cbNode.commentBefore}` : cb;
            }
          } else {
            comments.after = comments.before.concat(comments.after);
          }

          break;

        default:
          this.contents = contentNodes;

          if (this.contents[0]) {
            this.contents[0].commentBefore = comments.before.join('\n') || null;
          } else {
            comments.after = comments.before.concat(comments.after);
          }

      }

      this.comment = comments.after.join('\n') || null;
    }

    resolveTagDirective(directive) {
      const [handle, prefix] = directive.parameters;

      if (handle && prefix) {
        if (this.tagPrefixes.every(p => p.handle !== handle)) {
          this.tagPrefixes.push({
            handle,
            prefix
          });
        } else {
          const msg = 'The %TAG directive must only be given at most once per handle in the same document.';
          this.errors.push(new errors.YAMLSemanticError(directive, msg));
        }
      } else {
        const msg = 'Insufficient parameters given for %TAG directive';
        this.errors.push(new errors.YAMLSemanticError(directive, msg));
      }
    }

    resolveYamlDirective(directive) {
      let [version] = directive.parameters;
      if (directive.name === 'YAML:1.0') version = '1.0';

      if (this.version) {
        const msg = 'The %YAML directive must only be given at most once per document.';
        this.errors.push(new errors.YAMLSemanticError(directive, msg));
      }

      if (!version) {
        const msg = 'Insufficient parameters given for %YAML directive';
        this.errors.push(new errors.YAMLSemanticError(directive, msg));
      } else {
        if (!Document.defaults[version]) {
          const v0 = this.version || this.options.version;
          const msg = `Document will be parsed as YAML ${v0} rather than YAML ${version}`;
          this.warnings.push(new errors.YAMLWarning(directive, msg));
        }

        this.version = version;
      }
    }

    resolveTagName(node) {
      const {
        tag,
        type
      } = node;
      let nonSpecific = false;

      if (tag) {
        const {
          handle,
          suffix,
          verbatim
        } = tag;

        if (verbatim) {
          if (verbatim !== '!' && verbatim !== '!!') return verbatim;
          const msg = `Verbatim tags aren't resolved, so ${verbatim} is invalid.`;
          this.errors.push(new errors.YAMLSemanticError(node, msg));
        } else if (handle === '!' && !suffix) {
          nonSpecific = true;
        } else {
          let prefix = this.tagPrefixes.find(p => p.handle === handle);

          if (!prefix) {
            const dtp = this.getDefaults().tagPrefixes;
            if (dtp) prefix = dtp.find(p => p.handle === handle);
          }

          if (prefix) {
            if (suffix) {
              if (handle === '!' && (this.version || this.options.version) === '1.0') {
                if (suffix[0] === '^') return suffix;

                if (/[:/]/.test(suffix)) {
                  // word/foo -> tag:word.yaml.org,2002:foo
                  const vocab = suffix.match(/^([a-z0-9-]+)\/(.*)/i);
                  return vocab ? `tag:${vocab[1]}.yaml.org,2002:${vocab[2]}` : `tag:${suffix}`;
                }
              }

              return prefix.prefix + decodeURIComponent(suffix);
            }

            this.errors.push(new errors.YAMLSemanticError(node, `The ${handle} tag has no suffix.`));
          } else {
            const msg = `The ${handle} tag handle is non-default and was not declared.`;
            this.errors.push(new errors.YAMLSemanticError(node, msg));
          }
        }
      }

      switch (type) {
        case constants.Type.BLOCK_FOLDED:
        case constants.Type.BLOCK_LITERAL:
        case constants.Type.QUOTE_DOUBLE:
        case constants.Type.QUOTE_SINGLE:
          return _schema.default.defaultTags.STR;

        case constants.Type.FLOW_MAP:
        case constants.Type.MAP:
          return _schema.default.defaultTags.MAP;

        case constants.Type.FLOW_SEQ:
        case constants.Type.SEQ:
          return _schema.default.defaultTags.SEQ;

        case constants.Type.PLAIN:
          return nonSpecific ? _schema.default.defaultTags.STR : null;

        default:
          return null;
      }
    }

    resolveNode(node) {
      if (!node) return null;
      const {
        anchors,
        errors: errors$1,
        schema
      } = this;
      let hasAnchor = false;
      let hasTag = false;
      const comments = {
        before: [],
        after: []
      };
      const props = isCollectionItem(node.context.parent) ? node.context.parent.props.concat(node.props) : node.props;

      for (const {
        start,
        end
      } of props) {
        switch (node.context.src[start]) {
          case constants.Char.COMMENT:
            {
              if (!node.commentHasRequiredWhitespace(start)) {
                const msg = 'Comments must be separated from other tokens by white space characters';
                errors$1.push(new errors.YAMLSemanticError(node, msg));
              }

              const c = node.context.src.slice(start + 1, end);
              const {
                header,
                valueRange
              } = node;

              if (valueRange && (start > valueRange.start || header && start > header.start)) {
                comments.after.push(c);
              } else {
                comments.before.push(c);
              }
            }
            break;

          case constants.Char.ANCHOR:
            if (hasAnchor) {
              const msg = 'A node can have at most one anchor';
              errors$1.push(new errors.YAMLSemanticError(node, msg));
            }

            hasAnchor = true;
            break;

          case constants.Char.TAG:
            if (hasTag) {
              const msg = 'A node can have at most one tag';
              errors$1.push(new errors.YAMLSemanticError(node, msg));
            }

            hasTag = true;
            break;
        }
      }

      if (hasAnchor) {
        const name = node.anchor;
        const prev = anchors.getNode(name); // At this point, aliases for any preceding node with the same anchor
        // name have already been resolved, so it may safely be renamed.

        if (prev) anchors.map[anchors.newName(name)] = prev; // During parsing, we need to store the CST node in anchors.map as
        // anchors need to be available during resolution to allow for
        // circular references.

        anchors.map[name] = node;
      }

      let res;

      if (node.type === constants.Type.ALIAS) {
        if (hasAnchor || hasTag) {
          const msg = 'An alias node must not specify any properties';
          errors$1.push(new errors.YAMLSemanticError(node, msg));
        }

        const name = node.rawValue;
        const src = anchors.getNode(name);

        if (!src) {
          const msg = `Aliased anchor not found: ${name}`;
          errors$1.push(new errors.YAMLReferenceError(node, msg));
          return null;
        } // Lazy resolution for circular references


        res = new _Alias.default(src);

        anchors._cstAliases.push(res);
      } else {
        const tagName = this.resolveTagName(node);

        if (tagName) {
          res = schema.resolveNodeWithFallback(this, node, tagName);
        } else {
          if (node.type !== constants.Type.PLAIN) {
            const msg = `Failed to resolve ${node.type} node here`;
            errors$1.push(new errors.YAMLSyntaxError(node, msg));
            return null;
          }

          try {
            res = schema.resolveScalar(node.strValue || '');
          } catch (error) {
            if (!error.source) error.source = node;
            errors$1.push(error);
            return null;
          }
        }
      }

      if (res) {
        res.range = [node.range.start, node.range.end];
        if (this.options.keepCstNodes) res.cstNode = node;
        if (this.options.keepNodeTypes) res.type = node.type;
        const cb = comments.before.join('\n');

        if (cb) {
          res.commentBefore = res.commentBefore ? `${res.commentBefore}\n${cb}` : cb;
        }

        const ca = comments.after.join('\n');
        if (ca) res.comment = res.comment ? `${res.comment}\n${ca}` : ca;
      }

      return node.resolved = res;
    }

    listNonDefaultTags() {
      return (0, _listTagNames.default)(this.contents).filter(t => t.indexOf(_schema.default.defaultPrefix) !== 0);
    }

    setTagPrefix(handle, prefix) {
      if (handle[0] !== '!' || handle[handle.length - 1] !== '!') throw new Error('Handle must start and end with !');

      if (prefix) {
        const prev = this.tagPrefixes.find(p => p.handle === handle);
        if (prev) prev.prefix = prefix;else this.tagPrefixes.push({
          handle,
          prefix
        });
      } else {
        this.tagPrefixes = this.tagPrefixes.filter(p => p.handle !== handle);
      }
    }

    stringifyTag(tag) {
      if ((this.version || this.options.version) === '1.0') {
        const priv = tag.match(/^tag:private\.yaml\.org,2002:([^:/]+)$/);
        if (priv) return '!' + priv[1];
        const vocab = tag.match(/^tag:([a-zA-Z0-9-]+)\.yaml\.org,2002:(.*)/);
        return vocab ? `!${vocab[1]}/${vocab[2]}` : `!${tag.replace(/^tag:/, '')}`;
      } else {
        let p = this.tagPrefixes.find(p => tag.indexOf(p.prefix) === 0);

        if (!p) {
          const dtp = this.getDefaults().tagPrefixes;
          p = dtp && dtp.find(p => tag.indexOf(p.prefix) === 0);
        }

        if (!p) return tag[0] === '!' ? tag : `!<${tag}>`;
        const suffix = tag.substr(p.prefix.length).replace(/[!,[\]{}]/g, ch => ({
          '!': '%21',
          ',': '%2C',
          '[': '%5B',
          ']': '%5D',
          '{': '%7B',
          '}': '%7D'
        })[ch]);
        return p.handle + suffix;
      }
    }

    toJSON(arg) {
      const {
        keepBlobsInJSON,
        mapAsMap,
        maxAliasCount
      } = this.options;
      const keep = keepBlobsInJSON && (typeof arg !== 'string' || !(this.contents instanceof _Scalar.default));
      const ctx = {
        doc: this,
        keep,
        mapAsMap: keep && !!mapAsMap,
        maxAliasCount
      };
      const anchorNames = Object.keys(this.anchors.map);
      if (anchorNames.length > 0) ctx.anchors = anchorNames.map(name => ({
        alias: [],
        aliasCount: 0,
        count: 1,
        node: this.anchors.map[name]
      }));
      return (0, _toJSON.default)(this.contents, arg, ctx);
    }

    toString() {
      if (this.errors.length > 0) throw new Error('Document with errors cannot be stringified');
      this.setSchema();
      const lines = [];
      let hasDirectives = false;

      if (this.version) {
        let vd = '%YAML 1.2';

        if (this.schema.name === 'yaml-1.1') {
          if (this.version === '1.0') vd = '%YAML:1.0';else if (this.version === '1.1') vd = '%YAML 1.1';
        }

        lines.push(vd);
        hasDirectives = true;
      }

      const tagNames = this.listNonDefaultTags();
      this.tagPrefixes.forEach(({
        handle,
        prefix
      }) => {
        if (tagNames.some(t => t.indexOf(prefix) === 0)) {
          lines.push(`%TAG ${handle} ${prefix}`);
          hasDirectives = true;
        }
      });
      if (hasDirectives || this.directivesEndMarker) lines.push('---');

      if (this.commentBefore) {
        if (hasDirectives || !this.directivesEndMarker) lines.unshift('');
        lines.unshift(this.commentBefore.replace(/^/gm, '#'));
      }

      const ctx = {
        anchors: {},
        doc: this,
        indent: ''
      };
      let chompKeep = false;
      let contentComment = null;

      if (this.contents) {
        if (this.contents instanceof _Node.default) {
          if (this.contents.spaceBefore && (hasDirectives || this.directivesEndMarker)) lines.push('');
          if (this.contents.commentBefore) lines.push(this.contents.commentBefore.replace(/^/gm, '#')); // top-level block scalars need to be indented if followed by a comment

          ctx.forceBlockIndent = !!this.comment;
          contentComment = this.contents.comment;
        }

        const onChompKeep = contentComment ? null : () => chompKeep = true;
        const body = this.schema.stringify(this.contents, ctx, () => contentComment = null, onChompKeep);
        lines.push((0, _addComment.default)(body, '', contentComment));
      } else if (this.contents !== undefined) {
        lines.push(this.schema.stringify(this.contents, ctx));
      }

      if (this.comment) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== '') lines.push('');
        lines.push(this.comment.replace(/^/gm, '#'));
      }

      return lines.join('\n') + '\n';
    }

  }

  exports.default = Document;

  _defineProperty(Document, "defaults", {
    '1.0': {
      schema: 'yaml-1.1',
      merge: true,
      tagPrefixes: [{
        handle: '!',
        prefix: _schema.default.defaultPrefix
      }, {
        handle: '!!',
        prefix: 'tag:private.yaml.org,2002:'
      }]
    },
    '1.1': {
      schema: 'yaml-1.1',
      merge: true,
      tagPrefixes: [{
        handle: '!',
        prefix: '!'
      }, {
        handle: '!!',
        prefix: _schema.default.defaultPrefix
      }]
    },
    '1.2': {
      schema: 'core',
      merge: false,
      tagPrefixes: [{
        handle: '!',
        prefix: '!'
      }, {
        handle: '!!',
        prefix: _schema.default.defaultPrefix
      }]
    }
  });
});
unwrapExports(Document_1$1);

var dist$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = void 0;

  var _parse = _interopRequireDefault(parse_1);

  var _Document = _interopRequireDefault(Document_1$1);

  var _schema = _interopRequireDefault(schema);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  const defaultOptions = {
    anchorPrefix: 'a',
    customTags: null,
    keepCstNodes: false,
    keepNodeTypes: true,
    keepBlobsInJSON: true,
    mapAsMap: false,
    maxAliasCount: 100,
    prettyErrors: false,
    // TODO Set true in v2
    simpleKeys: false,
    version: '1.2'
  };

  function createNode(value, wrapScalars = true, tag) {
    if (tag === undefined && typeof wrapScalars === 'string') {
      tag = wrapScalars;
      wrapScalars = true;
    }

    const options = Object.assign({}, _Document.default.defaults[defaultOptions.version], defaultOptions);
    const schema = new _schema.default(options);
    return schema.createNode(value, wrapScalars, tag);
  }

  class Document extends _Document.default {
    constructor(options) {
      super(Object.assign({}, defaultOptions, options));
    }

  }

  function parseAllDocuments(src, options) {
    const stream = [];
    let prev;

    for (const cstDoc of (0, _parse.default)(src)) {
      const doc = new Document(options);
      doc.parse(cstDoc, prev);
      stream.push(doc);
      prev = doc;
    }

    return stream;
  }

  function parseDocument(src, options) {
    const cst = (0, _parse.default)(src);
    const doc = new Document(options).parse(cst[0]);

    if (cst.length > 1) {
      const errMsg = 'Source contains multiple documents; please use YAML.parseAllDocuments()';
      doc.errors.unshift(new errors.YAMLSemanticError(cst[1], errMsg));
    }

    return doc;
  }

  function parse(src, options) {
    const doc = parseDocument(src, options);
    doc.warnings.forEach(warning => (0, warnings.warn)(warning));
    if (doc.errors.length > 0) throw doc.errors[0];
    return doc.toJSON();
  }

  function stringify(value, options) {
    const doc = new Document(options);
    doc.contents = value;
    return String(doc);
  }

  var _default = {
    createNode,
    defaultOptions,
    Document,
    parse,
    parseAllDocuments,
    parseCST: _parse.default,
    parseDocument,
    stringify
  };
  exports.default = _default;
});
unwrapExports(dist$1);

var yaml = dist$1.default;

var loaders_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.loaders = void 0;
  /* eslint-disable @typescript-eslint/no-require-imports */

  let importFresh$1;

  const loadJs = function loadJs(filepath) {
    if (importFresh$1 === undefined) {
      importFresh$1 = importFresh;
    }

    const result = importFresh$1(filepath);
    return result;
  };

  let parseJson;

  const loadJson = function loadJson(filepath, content) {
    if (parseJson === undefined) {
      parseJson = parseJson$1;
    }

    try {
      const result = parseJson(content);
      return result;
    } catch (error) {
      error.message = `JSON Error in ${filepath}:\n${error.message}`;
      throw error;
    }
  };

  let yaml$1;

  const loadYaml = function loadYaml(filepath, content) {
    if (yaml$1 === undefined) {
      yaml$1 = yaml;
    }

    try {
      const result = yaml$1.parse(content, {
        prettyErrors: true
      });
      return result;
    } catch (error) {
      error.message = `YAML Error in ${filepath}:\n${error.message}`;
      throw error;
    }
  };

  const loaders = {
    loadJs,
    loadJson,
    loadYaml
  };
  exports.loaders = loaders;
});
unwrapExports(loaders_1);
var loaders_2 = loaders_1.loaders;

var getPropertyByPath_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getPropertyByPath = getPropertyByPath; // Resolves property names or property paths defined with period-delimited
  // strings or arrays of strings. Property names that are found on the source
  // object are used directly (even if they include a period).
  // Nested property names that include periods, within a path, are only
  // understood in array paths.

  function getPropertyByPath(source, path) {
    if (typeof path === 'string' && Object.prototype.hasOwnProperty.call(source, path)) {
      return source[path];
    }

    const parsedPath = typeof path === 'string' ? path.split('.') : path; // eslint-disable-next-line @typescript-eslint/no-explicit-any

    return parsedPath.reduce((previous, key) => {
      if (previous === undefined) {
        return previous;
      }

      return previous[key];
    }, source);
  }
});
unwrapExports(getPropertyByPath_1);
var getPropertyByPath_2 = getPropertyByPath_1.getPropertyByPath;

var ExplorerBase_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getExtensionDescription = getExtensionDescription;
  exports.ExplorerBase = void 0;

  var _path = _interopRequireDefault(path);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class ExplorerBase {
    constructor(options) {
      if (options.cache === true) {
        this.loadCache = new Map();
        this.searchCache = new Map();
      }

      this.config = options;
      this.validateConfig();
    }

    clearLoadCache() {
      if (this.loadCache) {
        this.loadCache.clear();
      }
    }

    clearSearchCache() {
      if (this.searchCache) {
        this.searchCache.clear();
      }
    }

    clearCaches() {
      this.clearLoadCache();
      this.clearSearchCache();
    }

    validateConfig() {
      const config = this.config;
      config.searchPlaces.forEach(place => {
        const loaderKey = _path.default.extname(place) || 'noExt';
        const loader = config.loaders[loaderKey];

        if (!loader) {
          throw new Error(`No loader specified for ${getExtensionDescription(place)}, so searchPlaces item "${place}" is invalid`);
        }

        if (typeof loader !== 'function') {
          throw new Error(`loader for ${getExtensionDescription(place)} is not a function (type provided: "${typeof loader}"), so searchPlaces item "${place}" is invalid`);
        }
      });
    }

    shouldSearchStopWithResult(result) {
      if (result === null) return false;
      if (result.isEmpty && this.config.ignoreEmptySearchPlaces) return false;
      return true;
    }

    nextDirectoryToSearch(currentDir, currentResult) {
      if (this.shouldSearchStopWithResult(currentResult)) {
        return null;
      }

      const nextDir = nextDirUp(currentDir);

      if (nextDir === currentDir || currentDir === this.config.stopDir) {
        return null;
      }

      return nextDir;
    }

    loadPackageProp(filepath, content) {
      const parsedContent = loaders_1.loaders.loadJson(filepath, content);

      const packagePropValue = (0, getPropertyByPath_1.getPropertyByPath)(parsedContent, this.config.packageProp);
      return packagePropValue || null;
    }

    getLoaderEntryForFile(filepath) {
      if (_path.default.basename(filepath) === 'package.json') {
        const loader = this.loadPackageProp.bind(this);
        return loader;
      }

      const loaderKey = _path.default.extname(filepath) || 'noExt';
      const loader = this.config.loaders[loaderKey];

      if (!loader) {
        throw new Error(`No loader specified for ${getExtensionDescription(filepath)}`);
      }

      return loader;
    }

    loadedContentToCosmiconfigResult(filepath, loadedContent) {
      if (loadedContent === null) {
        return null;
      }

      if (loadedContent === undefined) {
        return {
          filepath,
          config: undefined,
          isEmpty: true
        };
      }

      return {
        config: loadedContent,
        filepath
      };
    }

    validateFilePath(filepath) {
      if (!filepath) {
        throw new Error('load must pass a non-empty string');
      }
    }

  }

  exports.ExplorerBase = ExplorerBase;

  function nextDirUp(dir) {
    return _path.default.dirname(dir);
  }

  function getExtensionDescription(filepath) {
    const ext = _path.default.extname(filepath);

    return ext ? `extension "${ext}"` : 'files without extensions';
  }
});
unwrapExports(ExplorerBase_1);
var ExplorerBase_2 = ExplorerBase_1.getExtensionDescription;
var ExplorerBase_3 = ExplorerBase_1.ExplorerBase;

var readFile_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.readFile = readFile;
  exports.readFileSync = readFileSync;

  var _fs = _interopRequireDefault(fs);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  async function fsReadFileAsync(pathname, encoding) {
    return new Promise((resolve, reject) => {
      _fs.default.readFile(pathname, encoding, (error, contents) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(contents);
      });
    });
  }

  async function readFile(filepath, options = {}) {
    const throwNotFound = options.throwNotFound === true;

    try {
      const content = await fsReadFileAsync(filepath, 'utf8');
      return content;
    } catch (error) {
      if (throwNotFound === false && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  function readFileSync(filepath, options = {}) {
    const throwNotFound = options.throwNotFound === true;

    try {
      const content = _fs.default.readFileSync(filepath, 'utf8');

      return content;
    } catch (error) {
      if (throwNotFound === false && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }
});
unwrapExports(readFile_1);
var readFile_2 = readFile_1.readFile;
var readFile_3 = readFile_1.readFileSync;

var cacheWrapper_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.cacheWrapper = cacheWrapper;
  exports.cacheWrapperSync = cacheWrapperSync;

  async function cacheWrapper(cache, key, fn) {
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    cache.set(key, result);
    return result;
  }

  function cacheWrapperSync(cache, key, fn) {
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn();
    cache.set(key, result);
    return result;
  }
});
unwrapExports(cacheWrapper_1);
var cacheWrapper_2 = cacheWrapper_1.cacheWrapper;
var cacheWrapper_3 = cacheWrapper_1.cacheWrapperSync;

const {
  promisify
} = util;

async function isType(fsStatType, statsMethodName, filePath) {
  if (typeof filePath !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof filePath}`);
  }

  try {
    const stats = await promisify(fs[fsStatType])(filePath);
    return stats[statsMethodName]();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function isTypeSync(fsStatType, statsMethodName, filePath) {
  if (typeof filePath !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof filePath}`);
  }

  try {
    return fs[fsStatType](filePath)[statsMethodName]();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

var isFile = isType.bind(null, 'stat', 'isFile');
var isDirectory = isType.bind(null, 'stat', 'isDirectory');
var isSymlink = isType.bind(null, 'lstat', 'isSymbolicLink');
var isFileSync = isTypeSync.bind(null, 'statSync', 'isFile');
var isDirectorySync = isTypeSync.bind(null, 'statSync', 'isDirectory');
var isSymlinkSync = isTypeSync.bind(null, 'lstatSync', 'isSymbolicLink');
var pathType = {
  isFile: isFile,
  isDirectory: isDirectory,
  isSymlink: isSymlink,
  isFileSync: isFileSync,
  isDirectorySync: isDirectorySync,
  isSymlinkSync: isSymlinkSync
};

var getDirectory_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getDirectory = getDirectory;
  exports.getDirectorySync = getDirectorySync;

  var _path = _interopRequireDefault(path);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  async function getDirectory(filepath) {
    const filePathIsDirectory = await (0, pathType.isDirectory)(filepath);

    if (filePathIsDirectory === true) {
      return filepath;
    }

    const directory = _path.default.dirname(filepath);

    return directory;
  }

  function getDirectorySync(filepath) {
    const filePathIsDirectory = (0, pathType.isDirectorySync)(filepath);

    if (filePathIsDirectory === true) {
      return filepath;
    }

    const directory = _path.default.dirname(filepath);

    return directory;
  }
});
unwrapExports(getDirectory_1);
var getDirectory_2 = getDirectory_1.getDirectory;
var getDirectory_3 = getDirectory_1.getDirectorySync;

var Explorer_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Explorer = void 0;

  var _path = _interopRequireDefault(path);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _asyncIterator(iterable) {
    var method;

    if (typeof Symbol !== "undefined") {
      if (Symbol.asyncIterator) {
        method = iterable[Symbol.asyncIterator];
        if (method != null) return method.call(iterable);
      }

      if (Symbol.iterator) {
        method = iterable[Symbol.iterator];
        if (method != null) return method.call(iterable);
      }
    }

    throw new TypeError("Object is not async iterable");
  }

  class Explorer extends ExplorerBase_1.ExplorerBase {
    constructor(options) {
      super(options);
    }

    async search(searchFrom = process.cwd()) {
      const startDirectory = await (0, getDirectory_1.getDirectory)(searchFrom);
      const result = await this.searchFromDirectory(startDirectory);
      return result;
    }

    async searchFromDirectory(dir) {
      const absoluteDir = _path.default.resolve(process.cwd(), dir);

      const run = async () => {
        const result = await this.searchDirectory(absoluteDir);
        const nextDir = this.nextDirectoryToSearch(absoluteDir, result);

        if (nextDir) {
          return this.searchFromDirectory(nextDir);
        }

        const transformResult = await this.config.transform(result);
        return transformResult;
      };

      if (this.searchCache) {
        return (0, cacheWrapper_1.cacheWrapper)(this.searchCache, absoluteDir, run);
      }

      return run();
    }

    async searchDirectory(dir) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(this.config.searchPlaces), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const place = _value;
          const placeResult = await this.loadSearchPlace(dir, place);

          if (this.shouldSearchStopWithResult(placeResult) === true) {
            return placeResult;
          }
        } // config not found

      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            await _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return null;
    }

    async loadSearchPlace(dir, place) {
      const filepath = _path.default.join(dir, place);

      const fileContents = await (0, readFile_1.readFile)(filepath);
      const result = await this.createCosmiconfigResult(filepath, fileContents);
      return result;
    }

    async loadFileContent(filepath, content) {
      if (content === null) {
        return null;
      }

      if (content.trim() === '') {
        return undefined;
      }

      const loader = this.getLoaderEntryForFile(filepath);
      const loaderResult = await loader(filepath, content);
      return loaderResult;
    }

    async createCosmiconfigResult(filepath, content) {
      const fileContent = await this.loadFileContent(filepath, content);
      const result = this.loadedContentToCosmiconfigResult(filepath, fileContent);
      return result;
    }

    async load(filepath) {
      this.validateFilePath(filepath);

      const absoluteFilePath = _path.default.resolve(process.cwd(), filepath);

      const runLoad = async () => {
        const fileContents = await (0, readFile_1.readFile)(absoluteFilePath, {
          throwNotFound: true
        });
        const result = await this.createCosmiconfigResult(absoluteFilePath, fileContents);
        const transformResult = await this.config.transform(result);
        return transformResult;
      };

      if (this.loadCache) {
        return (0, cacheWrapper_1.cacheWrapper)(this.loadCache, absoluteFilePath, runLoad);
      }

      return runLoad();
    }

  }

  exports.Explorer = Explorer;
});
unwrapExports(Explorer_1);
var Explorer_2 = Explorer_1.Explorer;

var ExplorerSync_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ExplorerSync = void 0;

  var _path = _interopRequireDefault(path);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  class ExplorerSync extends ExplorerBase_1.ExplorerBase {
    constructor(options) {
      super(options);
    }

    searchSync(searchFrom = process.cwd()) {
      const startDirectory = (0, getDirectory_1.getDirectorySync)(searchFrom);
      const result = this.searchFromDirectorySync(startDirectory);
      return result;
    }

    searchFromDirectorySync(dir) {
      const absoluteDir = _path.default.resolve(process.cwd(), dir);

      const run = () => {
        const result = this.searchDirectorySync(absoluteDir);
        const nextDir = this.nextDirectoryToSearch(absoluteDir, result);

        if (nextDir) {
          return this.searchFromDirectorySync(nextDir);
        }

        const transformResult = this.config.transform(result);
        return transformResult;
      };

      if (this.searchCache) {
        return (0, cacheWrapper_1.cacheWrapperSync)(this.searchCache, absoluteDir, run);
      }

      return run();
    }

    searchDirectorySync(dir) {
      for (const place of this.config.searchPlaces) {
        const placeResult = this.loadSearchPlaceSync(dir, place);

        if (this.shouldSearchStopWithResult(placeResult) === true) {
          return placeResult;
        }
      } // config not found


      return null;
    }

    loadSearchPlaceSync(dir, place) {
      const filepath = _path.default.join(dir, place);

      const content = (0, readFile_1.readFileSync)(filepath);
      const result = this.createCosmiconfigResultSync(filepath, content);
      return result;
    }

    loadFileContentSync(filepath, content) {
      if (content === null) {
        return null;
      }

      if (content.trim() === '') {
        return undefined;
      }

      const loader = this.getLoaderEntryForFile(filepath);
      const loaderResult = loader(filepath, content);
      return loaderResult;
    }

    createCosmiconfigResultSync(filepath, content) {
      const fileContent = this.loadFileContentSync(filepath, content);
      const result = this.loadedContentToCosmiconfigResult(filepath, fileContent);
      return result;
    }

    loadSync(filepath) {
      this.validateFilePath(filepath);

      const absoluteFilePath = _path.default.resolve(process.cwd(), filepath);

      const runLoadSync = () => {
        const content = (0, readFile_1.readFileSync)(absoluteFilePath, {
          throwNotFound: true
        });
        const cosmiconfigResult = this.createCosmiconfigResultSync(absoluteFilePath, content);
        const transformResult = this.config.transform(cosmiconfigResult);
        return transformResult;
      };

      if (this.loadCache) {
        return (0, cacheWrapper_1.cacheWrapperSync)(this.loadCache, absoluteFilePath, runLoadSync);
      }

      return runLoadSync();
    }

  }

  exports.ExplorerSync = ExplorerSync;
});
unwrapExports(ExplorerSync_1);
var ExplorerSync_2 = ExplorerSync_1.ExplorerSync;

var dist$2 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.cosmiconfig = cosmiconfig;
  exports.cosmiconfigSync = cosmiconfigSync;
  exports.defaultLoaders = void 0;

  var _os = _interopRequireDefault(os);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  } // eslint-disable-next-line @typescript-eslint/explicit-function-return-type


  function cosmiconfig(moduleName, options = {}) {
    const normalizedOptions = normalizeOptions(moduleName, options);
    const explorer = new Explorer_1.Explorer(normalizedOptions);
    return {
      search: explorer.search.bind(explorer),
      load: explorer.load.bind(explorer),
      clearLoadCache: explorer.clearLoadCache.bind(explorer),
      clearSearchCache: explorer.clearSearchCache.bind(explorer),
      clearCaches: explorer.clearCaches.bind(explorer)
    };
  } // eslint-disable-next-line @typescript-eslint/explicit-function-return-type


  function cosmiconfigSync(moduleName, options = {}) {
    const normalizedOptions = normalizeOptions(moduleName, options);
    const explorerSync = new ExplorerSync_1.ExplorerSync(normalizedOptions);
    return {
      search: explorerSync.searchSync.bind(explorerSync),
      load: explorerSync.loadSync.bind(explorerSync),
      clearLoadCache: explorerSync.clearLoadCache.bind(explorerSync),
      clearSearchCache: explorerSync.clearSearchCache.bind(explorerSync),
      clearCaches: explorerSync.clearCaches.bind(explorerSync)
    };
  } // do not allow mutation of default loaders. Make sure it is set inside options


  const defaultLoaders = Object.freeze({
    '.js': loaders_1.loaders.loadJs,
    '.json': loaders_1.loaders.loadJson,
    '.yaml': loaders_1.loaders.loadYaml,
    '.yml': loaders_1.loaders.loadYaml,
    noExt: loaders_1.loaders.loadYaml
  });
  exports.defaultLoaders = defaultLoaders;

  function normalizeOptions(moduleName, options) {
    const defaults = {
      packageProp: moduleName,
      searchPlaces: ['package.json', `.${moduleName}rc`, `.${moduleName}rc.json`, `.${moduleName}rc.yaml`, `.${moduleName}rc.yml`, `.${moduleName}rc.js`, `${moduleName}.config.js`],
      ignoreEmptySearchPlaces: true,
      stopDir: _os.default.homedir(),
      cache: true,
      transform: identity,
      loaders: defaultLoaders
    };
    const normalizedOptions = Object.assign({}, defaults, {}, options, {
      loaders: Object.assign({}, defaults.loaders, {}, options.loaders)
    });
    return normalizedOptions;
  }

  const identity = function identity(x) {
    return x;
  };
});
unwrapExports(dist$2);
var dist_1 = dist$2.cosmiconfig;
var dist_2 = dist$2.cosmiconfigSync;
var dist_3 = dist$2.defaultLoaders;

var findParentDir = createCommonjsModule(function (module, exports) {

  var exists = fs.exists || path.exists,
      existsSync = fs.existsSync || path.existsSync;

  function splitPath(path) {
    var parts = path.split(/(\/|\\)/);
    if (!parts.length) return parts; // when path starts with a slash, the first part is empty string

    return !parts[0].length ? parts.slice(1) : parts;
  }

  exports = module.exports = function (currentFullPath, clue, cb) {
    function testDir(parts) {
      if (parts.length === 0) return cb(null, null);
      var p = parts.join('');
      exists(path.join(p, clue), function (itdoes) {
        if (itdoes) return cb(null, p);
        testDir(parts.slice(0, -1));
      });
    }

    testDir(splitPath(currentFullPath));
  };

  exports.sync = function (currentFullPath, clue) {
    function testDir(parts) {
      if (parts.length === 0) return null;
      var p = parts.join('');
      var itdoes = existsSync(path.join(p, clue));
      return itdoes ? p : testDir(parts.slice(0, -1));
    }

    return testDir(splitPath(currentFullPath));
  };
});
var findParentDir_1 = findParentDir.sync;

// Returns a wrapper function that returns a wrapped callback
// The wrapper function should do some stuff, and return a
// presumably different callback function.
// This makes sure that own properties are retained, so that
// decorations and such are not lost along the way.
var wrappy_1 = wrappy;

function wrappy(fn, cb) {
  if (fn && cb) return wrappy(fn)(cb);
  if (typeof fn !== 'function') throw new TypeError('need wrapper function');
  Object.keys(fn).forEach(function (k) {
    wrapper[k] = fn[k];
  });
  return wrapper;

  function wrapper() {
    var args = new Array(arguments.length);

    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    var ret = fn.apply(this, args);
    var cb = args[args.length - 1];

    if (typeof ret === 'function' && ret !== cb) {
      Object.keys(cb).forEach(function (k) {
        ret[k] = cb[k];
      });
    }

    return ret;
  }
}

var once_1 = wrappy_1(once);
var strict = wrappy_1(onceStrict);
once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this);
    },
    configurable: true
  });
  Object.defineProperty(Function.prototype, 'onceStrict', {
    value: function () {
      return onceStrict(this);
    },
    configurable: true
  });
});

function once(fn) {
  var f = function () {
    if (f.called) return f.value;
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };

  f.called = false;
  return f;
}

function onceStrict(fn) {
  var f = function () {
    if (f.called) throw new Error(f.onceError);
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };

  var name = fn.name || 'Function wrapped with `once`';
  f.onceError = name + " shouldn't be called more than once";
  f.called = false;
  return f;
}
once_1.strict = strict;

var noop = function () {};

var isRequest = function (stream) {
  return stream.setHeader && typeof stream.abort === 'function';
};

var isChildProcess = function (stream) {
  return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3;
};

var eos = function (stream, opts, callback) {
  if (typeof opts === 'function') return eos(stream, null, opts);
  if (!opts) opts = {};
  callback = once_1(callback || noop);
  var ws = stream._writableState;
  var rs = stream._readableState;
  var readable = opts.readable || opts.readable !== false && stream.readable;
  var writable = opts.writable || opts.writable !== false && stream.writable;
  var cancelled = false;

  var onlegacyfinish = function () {
    if (!stream.writable) onfinish();
  };

  var onfinish = function () {
    writable = false;
    if (!readable) callback.call(stream);
  };

  var onend = function () {
    readable = false;
    if (!writable) callback.call(stream);
  };

  var onexit = function (exitCode) {
    callback.call(stream, exitCode ? new Error('exited with error code: ' + exitCode) : null);
  };

  var onerror = function (err) {
    callback.call(stream, err);
  };

  var onclose = function () {
    process.nextTick(onclosenexttick);
  };

  var onclosenexttick = function () {
    if (cancelled) return;
    if (readable && !(rs && rs.ended && !rs.destroyed)) return callback.call(stream, new Error('premature close'));
    if (writable && !(ws && ws.ended && !ws.destroyed)) return callback.call(stream, new Error('premature close'));
  };

  var onrequest = function () {
    stream.req.on('finish', onfinish);
  };

  if (isRequest(stream)) {
    stream.on('complete', onfinish);
    stream.on('abort', onclose);
    if (stream.req) onrequest();else stream.on('request', onrequest);
  } else if (writable && !ws) {
    // legacy streams
    stream.on('end', onlegacyfinish);
    stream.on('close', onlegacyfinish);
  }

  if (isChildProcess(stream)) stream.on('exit', onexit);
  stream.on('end', onend);
  stream.on('finish', onfinish);
  if (opts.error !== false) stream.on('error', onerror);
  stream.on('close', onclose);
  return function () {
    cancelled = true;
    stream.removeListener('complete', onfinish);
    stream.removeListener('abort', onclose);
    stream.removeListener('request', onrequest);
    if (stream.req) stream.req.removeListener('finish', onfinish);
    stream.removeListener('end', onlegacyfinish);
    stream.removeListener('close', onlegacyfinish);
    stream.removeListener('finish', onfinish);
    stream.removeListener('exit', onexit);
    stream.removeListener('end', onend);
    stream.removeListener('error', onerror);
    stream.removeListener('close', onclose);
  };
};

var endOfStream = eos;

var noop$1 = function () {};

var ancient = /^v?\.0/.test(process.version);

var isFn = function (fn) {
  return typeof fn === 'function';
};

var isFS = function (stream) {
  if (!ancient) return false; // newer node version do not need to care about fs is a special way

  if (!fs) return false; // browser

  return (stream instanceof (fs.ReadStream || noop$1) || stream instanceof (fs.WriteStream || noop$1)) && isFn(stream.close);
};

var isRequest$1 = function (stream) {
  return stream.setHeader && isFn(stream.abort);
};

var destroyer = function (stream, reading, writing, callback) {
  callback = once_1(callback);
  var closed = false;
  stream.on('close', function () {
    closed = true;
  });
  endOfStream(stream, {
    readable: reading,
    writable: writing
  }, function (err) {
    if (err) return callback(err);
    closed = true;
    callback();
  });
  var destroyed = false;
  return function (err) {
    if (closed) return;
    if (destroyed) return;
    destroyed = true;
    if (isFS(stream)) return stream.close(noop$1); // use close for fs streams to avoid fd leaks

    if (isRequest$1(stream)) return stream.abort(); // request.destroy just do .end - .abort is what we want

    if (isFn(stream.destroy)) return stream.destroy();
    callback(err || new Error('stream was destroyed'));
  };
};

var call = function (fn) {
  fn();
};

var pipe = function (from, to) {
  return from.pipe(to);
};

var pump = function () {
  var streams = Array.prototype.slice.call(arguments);
  var callback = isFn(streams[streams.length - 1] || noop$1) && streams.pop() || noop$1;
  if (Array.isArray(streams[0])) streams = streams[0];
  if (streams.length < 2) throw new Error('pump requires two streams per minimum');
  var error;
  var destroys = streams.map(function (stream, i) {
    var reading = i < streams.length - 1;
    var writing = i > 0;
    return destroyer(stream, reading, writing, function (err) {
      if (!error) error = err;
      if (err) destroys.forEach(call);
      if (reading) return;
      destroys.forEach(call);
      callback(error);
    });
  });
  return streams.reduce(pipe);
};

var pump_1 = pump;

const {
  PassThrough: PassThroughStream
} = stream;

var bufferStream = options => {
  options = Object.assign({}, options);
  const {
    array
  } = options;
  let {
    encoding
  } = options;
  const isBuffer = encoding === 'buffer';
  let objectMode = false;

  if (array) {
    objectMode = !(encoding || isBuffer);
  } else {
    encoding = encoding || 'utf8';
  }

  if (isBuffer) {
    encoding = null;
  }

  const stream = new PassThroughStream({
    objectMode
  });

  if (encoding) {
    stream.setEncoding(encoding);
  }

  let length = 0;
  const chunks = [];
  stream.on('data', chunk => {
    chunks.push(chunk);

    if (objectMode) {
      length = chunks.length;
    } else {
      length += chunk.length;
    }
  });

  stream.getBufferedValue = () => {
    if (array) {
      return chunks;
    }

    return isBuffer ? Buffer.concat(chunks, length) : chunks.join('');
  };

  stream.getBufferedLength = () => length;

  return stream;
};

class MaxBufferError extends Error {
  constructor() {
    super('maxBuffer exceeded');
    this.name = 'MaxBufferError';
  }

}

async function getStream(inputStream, options) {
  if (!inputStream) {
    return Promise.reject(new Error('Expected a stream'));
  }

  options = Object.assign({
    maxBuffer: Infinity
  }, options);
  const {
    maxBuffer
  } = options;
  let stream;
  await new Promise((resolve, reject) => {
    const rejectPromise = error => {
      if (error) {
        // A null check
        error.bufferedData = stream.getBufferedValue();
      }

      reject(error);
    };

    stream = pump_1(inputStream, bufferStream(options), error => {
      if (error) {
        rejectPromise(error);
        return;
      }

      resolve();
    });
    stream.on('data', () => {
      if (stream.getBufferedLength() > maxBuffer) {
        rejectPromise(new MaxBufferError());
      }
    });
  });
  return stream.getBufferedValue();
}

var getStream_1 = getStream; // TODO: Remove this for the next major release

var default_1 = getStream;

var buffer = (stream, options) => getStream(stream, Object.assign({}, options, {
  encoding: 'buffer'
}));

var array = (stream, options) => getStream(stream, Object.assign({}, options, {
  array: true
}));

var MaxBufferError_1 = MaxBufferError;
getStream_1.default = default_1;
getStream_1.buffer = buffer;
getStream_1.array = array;
getStream_1.MaxBufferError = MaxBufferError_1;

var vendors = [
	{
		name: "AppVeyor",
		constant: "APPVEYOR",
		env: "APPVEYOR",
		pr: "APPVEYOR_PULL_REQUEST_NUMBER"
	},
	{
		name: "Azure Pipelines",
		constant: "AZURE_PIPELINES",
		env: "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI",
		pr: "SYSTEM_PULLREQUEST_PULLREQUESTID"
	},
	{
		name: "Bamboo",
		constant: "BAMBOO",
		env: "bamboo_planKey"
	},
	{
		name: "Bitbucket Pipelines",
		constant: "BITBUCKET",
		env: "BITBUCKET_COMMIT",
		pr: "BITBUCKET_PR_ID"
	},
	{
		name: "Bitrise",
		constant: "BITRISE",
		env: "BITRISE_IO",
		pr: "BITRISE_PULL_REQUEST"
	},
	{
		name: "Buddy",
		constant: "BUDDY",
		env: "BUDDY_WORKSPACE_ID",
		pr: "BUDDY_EXECUTION_PULL_REQUEST_ID"
	},
	{
		name: "Buildkite",
		constant: "BUILDKITE",
		env: "BUILDKITE",
		pr: {
			env: "BUILDKITE_PULL_REQUEST",
			ne: "false"
		}
	},
	{
		name: "CircleCI",
		constant: "CIRCLE",
		env: "CIRCLECI",
		pr: "CIRCLE_PULL_REQUEST"
	},
	{
		name: "Cirrus CI",
		constant: "CIRRUS",
		env: "CIRRUS_CI",
		pr: "CIRRUS_PR"
	},
	{
		name: "AWS CodeBuild",
		constant: "CODEBUILD",
		env: "CODEBUILD_BUILD_ARN"
	},
	{
		name: "Codeship",
		constant: "CODESHIP",
		env: {
			CI_NAME: "codeship"
		}
	},
	{
		name: "Drone",
		constant: "DRONE",
		env: "DRONE",
		pr: {
			DRONE_BUILD_EVENT: "pull_request"
		}
	},
	{
		name: "dsari",
		constant: "DSARI",
		env: "DSARI"
	},
	{
		name: "GitHub Actions",
		constant: "GITHUB_ACTIONS",
		env: "GITHUB_ACTIONS",
		pr: {
			GITHUB_EVENT_NAME: "pull_request"
		}
	},
	{
		name: "GitLab CI",
		constant: "GITLAB",
		env: "GITLAB_CI"
	},
	{
		name: "GoCD",
		constant: "GOCD",
		env: "GO_PIPELINE_LABEL"
	},
	{
		name: "Hudson",
		constant: "HUDSON",
		env: "HUDSON_URL"
	},
	{
		name: "Jenkins",
		constant: "JENKINS",
		env: [
			"JENKINS_URL",
			"BUILD_ID"
		],
		pr: {
			any: [
				"ghprbPullId",
				"CHANGE_ID"
			]
		}
	},
	{
		name: "ZEIT Now",
		constant: "ZEIT_NOW",
		env: "NOW_BUILDER"
	},
	{
		name: "Magnum CI",
		constant: "MAGNUM",
		env: "MAGNUM"
	},
	{
		name: "Netlify CI",
		constant: "NETLIFY",
		env: "NETLIFY",
		pr: {
			env: "PULL_REQUEST",
			ne: "false"
		}
	},
	{
		name: "Nevercode",
		constant: "NEVERCODE",
		env: "NEVERCODE",
		pr: {
			env: "NEVERCODE_PULL_REQUEST",
			ne: "false"
		}
	},
	{
		name: "Render",
		constant: "RENDER",
		env: "RENDER",
		pr: {
			IS_PULL_REQUEST: "true"
		}
	},
	{
		name: "Sail CI",
		constant: "SAIL",
		env: "SAILCI",
		pr: "SAIL_PULL_REQUEST_NUMBER"
	},
	{
		name: "Semaphore",
		constant: "SEMAPHORE",
		env: "SEMAPHORE",
		pr: "PULL_REQUEST_NUMBER"
	},
	{
		name: "Shippable",
		constant: "SHIPPABLE",
		env: "SHIPPABLE",
		pr: {
			IS_PULL_REQUEST: "true"
		}
	},
	{
		name: "Solano CI",
		constant: "SOLANO",
		env: "TDDIUM",
		pr: "TDDIUM_PR_ID"
	},
	{
		name: "Strider CD",
		constant: "STRIDER",
		env: "STRIDER"
	},
	{
		name: "TaskCluster",
		constant: "TASKCLUSTER",
		env: [
			"TASK_ID",
			"RUN_ID"
		]
	},
	{
		name: "TeamCity",
		constant: "TEAMCITY",
		env: "TEAMCITY_VERSION"
	},
	{
		name: "Travis CI",
		constant: "TRAVIS",
		env: "TRAVIS",
		pr: {
			env: "TRAVIS_PULL_REQUEST",
			ne: "false"
		}
	}
];

var vendors$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': vendors
});

var vendors$2 = getCjsExportFromNamespace(vendors$1);

var ciInfo = createCommonjsModule(function (module, exports) {

  var env = process.env; // Used for testing only

  Object.defineProperty(exports, '_vendors', {
    value: vendors$2.map(function (v) {
      return v.constant;
    })
  });
  exports.name = null;
  exports.isPR = null;
  vendors$2.forEach(function (vendor) {
    var envs = Array.isArray(vendor.env) ? vendor.env : [vendor.env];
    var isCI = envs.every(function (obj) {
      return checkEnv(obj);
    });
    exports[vendor.constant] = isCI;

    if (isCI) {
      exports.name = vendor.name;

      switch (typeof vendor.pr) {
        case 'string':
          // "pr": "CIRRUS_PR"
          exports.isPR = !!env[vendor.pr];
          break;

        case 'object':
          if ('env' in vendor.pr) {
            // "pr": { "env": "BUILDKITE_PULL_REQUEST", "ne": "false" }
            exports.isPR = vendor.pr.env in env && env[vendor.pr.env] !== vendor.pr.ne;
          } else if ('any' in vendor.pr) {
            // "pr": { "any": ["ghprbPullId", "CHANGE_ID"] }
            exports.isPR = vendor.pr.any.some(function (key) {
              return !!env[key];
            });
          } else {
            // "pr": { "DRONE_BUILD_EVENT": "pull_request" }
            exports.isPR = checkEnv(vendor.pr);
          }

          break;

        default:
          // PR detection not supported for this vendor
          exports.isPR = null;
      }
    }
  });
  exports.isCI = !!(env.CI || // Travis CI, CircleCI, Cirrus CI, Gitlab CI, Appveyor, CodeShip, dsari
  env.CONTINUOUS_INTEGRATION || // Travis CI, Cirrus CI
  env.BUILD_NUMBER || // Jenkins, TeamCity
  env.RUN_ID || // TaskCluster, dsari
  exports.name || false);

  function checkEnv(obj) {
    if (typeof obj === 'string') return !!env[obj];
    return Object.keys(obj).every(function (k) {
      return env[k] === obj[k];
    });
  }
});
var ciInfo_1 = ciInfo.name;
var ciInfo_2 = ciInfo.isPR;
var ciInfo_3 = ciInfo.isCI;

var thirdParty = {
  cosmiconfig: dist$2.cosmiconfig,
  cosmiconfigSync: dist$2.cosmiconfigSync,
  findParentDir: findParentDir.sync,
  getStream: getStream_1,
  isCI: () => ciInfo.isCI
};
var thirdParty_1 = thirdParty.cosmiconfig;
var thirdParty_2 = thirdParty.cosmiconfigSync;
var thirdParty_3 = thirdParty.findParentDir;
var thirdParty_4 = thirdParty.getStream;
var thirdParty_5 = thirdParty.isCI;

exports.cosmiconfig = thirdParty_1;
exports.cosmiconfigSync = thirdParty_2;
exports.default = thirdParty;
exports.findParentDir = thirdParty_3;
exports.getStream = thirdParty_4;
exports.isCI = thirdParty_5;
