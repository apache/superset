'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _AwaitValue(value) {
  this.wrapped = value;
}

function _AsyncGenerator(gen) {
  var front, back;

  function send(key, arg) {
    return new Promise(function (resolve, reject) {
      var request = {
        key: key,
        arg: arg,
        resolve: resolve,
        reject: reject,
        next: null
      };

      if (back) {
        back = back.next = request;
      } else {
        front = back = request;
        resume(key, arg);
      }
    });
  }

  function resume(key, arg) {
    try {
      var result = gen[key](arg);
      var value = result.value;
      var wrappedAwait = value instanceof _AwaitValue;
      Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) {
        if (wrappedAwait) {
          resume("next", arg);
          return;
        }

        settle(result.done ? "return" : "normal", arg);
      }, function (err) {
        resume("throw", err);
      });
    } catch (err) {
      settle("throw", err);
    }
  }

  function settle(type, value) {
    switch (type) {
      case "return":
        front.resolve({
          value: value,
          done: true
        });
        break;

      case "throw":
        front.reject(value);
        break;

      default:
        front.resolve({
          value: value,
          done: false
        });
        break;
    }

    front = front.next;

    if (front) {
      resume(front.key, front.arg);
    } else {
      back = null;
    }
  }

  this._invoke = send;

  if (typeof gen.return !== "function") {
    this.return = undefined;
  }
}

if (typeof Symbol === "function" && Symbol.asyncIterator) {
  _AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
    return this;
  };
}

_AsyncGenerator.prototype.next = function (arg) {
  return this._invoke("next", arg);
};

_AsyncGenerator.prototype.throw = function (arg) {
  return this._invoke("throw", arg);
};

_AsyncGenerator.prototype.return = function (arg) {
  return this._invoke("return", arg);
};

function _inheritsLoose(subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  subClass.__proto__ = superClass;
}

var beforeExpr = true;
var startsExpr = true;
var isLoop = true;
var isAssign = true;
var prefix = true;
var postfix = true;
var TokenType = function TokenType(label, conf) {
  if (conf === void 0) {
    conf = {};
  }

  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.rightAssociative = !!conf.rightAssociative;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop === 0 ? 0 : conf.binop || null;
  this.updateContext = null;
};

function KeywordTokenType(keyword, options) {
  if (options === void 0) {
    options = {};
  }

  return new TokenType(keyword, Object.assign({}, options, {
    keyword: keyword
  }));
}

function BinopTokenType(name, binop) {
  return new TokenType(name, {
    beforeExpr: beforeExpr,
    binop: binop
  });
}

var types = {
  num: new TokenType("num", {
    startsExpr: startsExpr
  }),
  bigint: new TokenType("bigint", {
    startsExpr: startsExpr
  }),
  regexp: new TokenType("regexp", {
    startsExpr: startsExpr
  }),
  string: new TokenType("string", {
    startsExpr: startsExpr
  }),
  name: new TokenType("name", {
    startsExpr: startsExpr
  }),
  eof: new TokenType("eof"),
  bracketL: new TokenType("[", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  braceBarL: new TokenType("{|", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  braceR: new TokenType("}"),
  braceBarR: new TokenType("|}"),
  parenL: new TokenType("(", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  parenR: new TokenType(")"),
  comma: new TokenType(",", {
    beforeExpr: beforeExpr
  }),
  semi: new TokenType(";", {
    beforeExpr: beforeExpr
  }),
  colon: new TokenType(":", {
    beforeExpr: beforeExpr
  }),
  doubleColon: new TokenType("::", {
    beforeExpr: beforeExpr
  }),
  dot: new TokenType("."),
  question: new TokenType("?", {
    beforeExpr: beforeExpr
  }),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>", {
    beforeExpr: beforeExpr
  }),
  template: new TokenType("template"),
  ellipsis: new TokenType("...", {
    beforeExpr: beforeExpr
  }),
  backQuote: new TokenType("`", {
    startsExpr: startsExpr
  }),
  dollarBraceL: new TokenType("${", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  at: new TokenType("@"),
  hash: new TokenType("#"),
  interpreterDirective: new TokenType("#!..."),
  eq: new TokenType("=", {
    beforeExpr: beforeExpr,
    isAssign: isAssign
  }),
  assign: new TokenType("_=", {
    beforeExpr: beforeExpr,
    isAssign: isAssign
  }),
  incDec: new TokenType("++/--", {
    prefix: prefix,
    postfix: postfix,
    startsExpr: startsExpr
  }),
  bang: new TokenType("!", {
    beforeExpr: beforeExpr,
    prefix: prefix,
    startsExpr: startsExpr
  }),
  tilde: new TokenType("~", {
    beforeExpr: beforeExpr,
    prefix: prefix,
    startsExpr: startsExpr
  }),
  pipeline: new BinopTokenType("|>", 0),
  nullishCoalescing: new BinopTokenType("??", 1),
  logicalOR: new BinopTokenType("||", 1),
  logicalAND: new BinopTokenType("&&", 2),
  bitwiseOR: new BinopTokenType("|", 3),
  bitwiseXOR: new BinopTokenType("^", 4),
  bitwiseAND: new BinopTokenType("&", 5),
  equality: new BinopTokenType("==/!=", 6),
  relational: new BinopTokenType("</>", 7),
  bitShift: new BinopTokenType("<</>>", 8),
  plusMin: new TokenType("+/-", {
    beforeExpr: beforeExpr,
    binop: 9,
    prefix: prefix,
    startsExpr: startsExpr
  }),
  modulo: new BinopTokenType("%", 10),
  star: new BinopTokenType("*", 10),
  slash: new BinopTokenType("/", 10),
  exponent: new TokenType("**", {
    beforeExpr: beforeExpr,
    binop: 11,
    rightAssociative: true
  })
};
var keywords = {
  break: new KeywordTokenType("break"),
  case: new KeywordTokenType("case", {
    beforeExpr: beforeExpr
  }),
  catch: new KeywordTokenType("catch"),
  continue: new KeywordTokenType("continue"),
  debugger: new KeywordTokenType("debugger"),
  default: new KeywordTokenType("default", {
    beforeExpr: beforeExpr
  }),
  do: new KeywordTokenType("do", {
    isLoop: isLoop,
    beforeExpr: beforeExpr
  }),
  else: new KeywordTokenType("else", {
    beforeExpr: beforeExpr
  }),
  finally: new KeywordTokenType("finally"),
  for: new KeywordTokenType("for", {
    isLoop: isLoop
  }),
  function: new KeywordTokenType("function", {
    startsExpr: startsExpr
  }),
  if: new KeywordTokenType("if"),
  return: new KeywordTokenType("return", {
    beforeExpr: beforeExpr
  }),
  switch: new KeywordTokenType("switch"),
  throw: new KeywordTokenType("throw", {
    beforeExpr: beforeExpr,
    prefix: prefix,
    startsExpr: startsExpr
  }),
  try: new KeywordTokenType("try"),
  var: new KeywordTokenType("var"),
  let: new KeywordTokenType("let"),
  const: new KeywordTokenType("const"),
  while: new KeywordTokenType("while", {
    isLoop: isLoop
  }),
  with: new KeywordTokenType("with"),
  new: new KeywordTokenType("new", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  this: new KeywordTokenType("this", {
    startsExpr: startsExpr
  }),
  super: new KeywordTokenType("super", {
    startsExpr: startsExpr
  }),
  class: new KeywordTokenType("class", {
    startsExpr: startsExpr
  }),
  extends: new KeywordTokenType("extends", {
    beforeExpr: beforeExpr
  }),
  export: new KeywordTokenType("export"),
  import: new KeywordTokenType("import", {
    startsExpr: startsExpr
  }),
  yield: new KeywordTokenType("yield", {
    beforeExpr: beforeExpr,
    startsExpr: startsExpr
  }),
  null: new KeywordTokenType("null", {
    startsExpr: startsExpr
  }),
  true: new KeywordTokenType("true", {
    startsExpr: startsExpr
  }),
  false: new KeywordTokenType("false", {
    startsExpr: startsExpr
  }),
  in: new KeywordTokenType("in", {
    beforeExpr: beforeExpr,
    binop: 7
  }),
  instanceof: new KeywordTokenType("instanceof", {
    beforeExpr: beforeExpr,
    binop: 7
  }),
  typeof: new KeywordTokenType("typeof", {
    beforeExpr: beforeExpr,
    prefix: prefix,
    startsExpr: startsExpr
  }),
  void: new KeywordTokenType("void", {
    beforeExpr: beforeExpr,
    prefix: prefix,
    startsExpr: startsExpr
  }),
  delete: new KeywordTokenType("delete", {
    beforeExpr: beforeExpr,
    prefix: prefix,
    startsExpr: startsExpr
  })
};
Object.keys(keywords).forEach(function (name) {
  types["_" + name] = keywords[name];
});

function isSimpleProperty(node) {
  return node != null && node.type === "Property" && node.kind === "init" && node.method === false;
}

var estree = (function (superClass) {
  return function (_superClass) {
    _inheritsLoose(_class, _superClass);

    function _class() {
      return _superClass.apply(this, arguments) || this;
    }

    var _proto = _class.prototype;

    _proto.estreeParseRegExpLiteral = function estreeParseRegExpLiteral(_ref) {
      var pattern = _ref.pattern,
          flags = _ref.flags;
      var regex = null;

      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {}

      var node = this.estreeParseLiteral(regex);
      node.regex = {
        pattern: pattern,
        flags: flags
      };
      return node;
    };

    _proto.estreeParseLiteral = function estreeParseLiteral(value) {
      return this.parseLiteral(value, "Literal");
    };

    _proto.directiveToStmt = function directiveToStmt(directive) {
      var directiveLiteral = directive.value;
      var stmt = this.startNodeAt(directive.start, directive.loc.start);
      var expression = this.startNodeAt(directiveLiteral.start, directiveLiteral.loc.start);
      expression.value = directiveLiteral.value;
      expression.raw = directiveLiteral.extra.raw;
      stmt.expression = this.finishNodeAt(expression, "Literal", directiveLiteral.end, directiveLiteral.loc.end);
      stmt.directive = directiveLiteral.extra.raw.slice(1, -1);
      return this.finishNodeAt(stmt, "ExpressionStatement", directive.end, directive.loc.end);
    };

    _proto.initFunction = function initFunction(node, isAsync) {
      _superClass.prototype.initFunction.call(this, node, isAsync);

      node.expression = false;
    };

    _proto.checkDeclaration = function checkDeclaration(node) {
      if (isSimpleProperty(node)) {
        this.checkDeclaration(node.value);
      } else {
        _superClass.prototype.checkDeclaration.call(this, node);
      }
    };

    _proto.checkGetterSetterParams = function checkGetterSetterParams(method) {
      var prop = method;
      var paramCount = prop.kind === "get" ? 0 : 1;
      var start = prop.start;

      if (prop.value.params.length !== paramCount) {
        if (prop.kind === "get") {
          this.raise(start, "getter must not have any formal parameters");
        } else {
          this.raise(start, "setter must have exactly one formal parameter");
        }
      }

      if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
        this.raise(start, "setter function argument must not be a rest parameter");
      }
    };

    _proto.checkLVal = function checkLVal(expr, isBinding, checkClashes, contextDescription) {
      var _this = this;

      switch (expr.type) {
        case "ObjectPattern":
          expr.properties.forEach(function (prop) {
            _this.checkLVal(prop.type === "Property" ? prop.value : prop, isBinding, checkClashes, "object destructuring pattern");
          });
          break;

        default:
          _superClass.prototype.checkLVal.call(this, expr, isBinding, checkClashes, contextDescription);

      }
    };

    _proto.checkPropClash = function checkPropClash(prop, propHash) {
      if (prop.computed || !isSimpleProperty(prop)) return;
      var key = prop.key;
      var name = key.type === "Identifier" ? key.name : String(key.value);

      if (name === "__proto__") {
        if (propHash.proto) {
          this.raise(key.start, "Redefinition of __proto__ property");
        }

        propHash.proto = true;
      }
    };

    _proto.isStrictBody = function isStrictBody(node) {
      var isBlockStatement = node.body.type === "BlockStatement";

      if (isBlockStatement && node.body.body.length > 0) {
        for (var _i2 = 0, _node$body$body2 = node.body.body; _i2 < _node$body$body2.length; _i2++) {
          var directive = _node$body$body2[_i2];

          if (directive.type === "ExpressionStatement" && directive.expression.type === "Literal") {
            if (directive.expression.value === "use strict") return true;
          } else {
            break;
          }
        }
      }

      return false;
    };

    _proto.isValidDirective = function isValidDirective(stmt) {
      return stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && typeof stmt.expression.value === "string" && (!stmt.expression.extra || !stmt.expression.extra.parenthesized);
    };

    _proto.stmtToDirective = function stmtToDirective(stmt) {
      var directive = _superClass.prototype.stmtToDirective.call(this, stmt);

      var value = stmt.expression.value;
      directive.value.value = value;
      return directive;
    };

    _proto.parseBlockBody = function parseBlockBody(node, allowDirectives, topLevel, end) {
      var _this2 = this;

      _superClass.prototype.parseBlockBody.call(this, node, allowDirectives, topLevel, end);

      var directiveStatements = node.directives.map(function (d) {
        return _this2.directiveToStmt(d);
      });
      node.body = directiveStatements.concat(node.body);
      delete node.directives;
    };

    _proto.pushClassMethod = function pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor) {
      this.parseMethod(method, isGenerator, isAsync, isConstructor, "MethodDefinition");

      if (method.typeParameters) {
        method.value.typeParameters = method.typeParameters;
        delete method.typeParameters;
      }

      classBody.body.push(method);
    };

    _proto.parseExprAtom = function parseExprAtom(refShorthandDefaultPos) {
      switch (this.state.type) {
        case types.regexp:
          return this.estreeParseRegExpLiteral(this.state.value);

        case types.num:
        case types.string:
          return this.estreeParseLiteral(this.state.value);

        case types._null:
          return this.estreeParseLiteral(null);

        case types._true:
          return this.estreeParseLiteral(true);

        case types._false:
          return this.estreeParseLiteral(false);

        default:
          return _superClass.prototype.parseExprAtom.call(this, refShorthandDefaultPos);
      }
    };

    _proto.parseLiteral = function parseLiteral(value, type, startPos, startLoc) {
      var node = _superClass.prototype.parseLiteral.call(this, value, type, startPos, startLoc);

      node.raw = node.extra.raw;
      delete node.extra;
      return node;
    };

    _proto.parseFunctionBody = function parseFunctionBody(node, allowExpression) {
      _superClass.prototype.parseFunctionBody.call(this, node, allowExpression);

      node.expression = node.body.type !== "BlockStatement";
    };

    _proto.parseMethod = function parseMethod(node, isGenerator, isAsync, isConstructor, type) {
      var funcNode = this.startNode();
      funcNode.kind = node.kind;
      funcNode = _superClass.prototype.parseMethod.call(this, funcNode, isGenerator, isAsync, isConstructor, "FunctionExpression");
      delete funcNode.kind;
      node.value = funcNode;
      return this.finishNode(node, type);
    };

    _proto.parseObjectMethod = function parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) {
      var node = _superClass.prototype.parseObjectMethod.call(this, prop, isGenerator, isAsync, isPattern, containsEsc);

      if (node) {
        node.type = "Property";
        if (node.kind === "method") node.kind = "init";
        node.shorthand = false;
      }

      return node;
    };

    _proto.parseObjectProperty = function parseObjectProperty(prop, startPos, startLoc, isPattern, refShorthandDefaultPos) {
      var node = _superClass.prototype.parseObjectProperty.call(this, prop, startPos, startLoc, isPattern, refShorthandDefaultPos);

      if (node) {
        node.kind = "init";
        node.type = "Property";
      }

      return node;
    };

    _proto.toAssignable = function toAssignable(node, isBinding, contextDescription) {
      if (isSimpleProperty(node)) {
        this.toAssignable(node.value, isBinding, contextDescription);
        return node;
      }

      return _superClass.prototype.toAssignable.call(this, node, isBinding, contextDescription);
    };

    _proto.toAssignableObjectExpressionProp = function toAssignableObjectExpressionProp(prop, isBinding, isLast) {
      if (prop.kind === "get" || prop.kind === "set") {
        this.raise(prop.key.start, "Object pattern can't contain getter or setter");
      } else if (prop.method) {
        this.raise(prop.key.start, "Object pattern can't contain methods");
      } else {
        _superClass.prototype.toAssignableObjectExpressionProp.call(this, prop, isBinding, isLast);
      }
    };

    return _class;
  }(superClass);
});

var lineBreak = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak.source, "g");
function isNewLine(code) {
  switch (code) {
    case 10:
    case 13:
    case 8232:
    case 8233:
      return true;

    default:
      return false;
  }
}
var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
function isWhitespace(code) {
  switch (code) {
    case 0x0009:
    case 0x000b:
    case 0x000c:
    case 32:
    case 160:
    case 5760:
    case 0x2000:
    case 0x2001:
    case 0x2002:
    case 0x2003:
    case 0x2004:
    case 0x2005:
    case 0x2006:
    case 0x2007:
    case 0x2008:
    case 0x2009:
    case 0x200a:
    case 0x202f:
    case 0x205f:
    case 0x3000:
    case 0xfeff:
      return true;

    default:
      return false;
  }
}

var TokContext = function TokContext(token, isExpr, preserveSpace, override) {
  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
};
var types$1 = {
  braceStatement: new TokContext("{", false),
  braceExpression: new TokContext("{", true),
  templateQuasi: new TokContext("${", false),
  parenStatement: new TokContext("(", false),
  parenExpression: new TokContext("(", true),
  template: new TokContext("`", true, true, function (p) {
    return p.readTmplToken();
  }),
  functionExpression: new TokContext("function", true),
  functionStatement: new TokContext("function", false)
};

types.parenR.updateContext = types.braceR.updateContext = function () {
  if (this.state.context.length === 1) {
    this.state.exprAllowed = true;
    return;
  }

  var out = this.state.context.pop();

  if (out === types$1.braceStatement && this.curContext().token === "function") {
    out = this.state.context.pop();
  }

  this.state.exprAllowed = !out.isExpr;
};

types.name.updateContext = function (prevType) {
  var allowed = false;

  if (prevType !== types.dot) {
    if (this.state.value === "of" && !this.state.exprAllowed || this.state.value === "yield" && this.state.inGenerator) {
      allowed = true;
    }
  }

  this.state.exprAllowed = allowed;

  if (this.state.isIterator) {
    this.state.isIterator = false;
  }
};

types.braceL.updateContext = function (prevType) {
  this.state.context.push(this.braceIsBlock(prevType) ? types$1.braceStatement : types$1.braceExpression);
  this.state.exprAllowed = true;
};

types.dollarBraceL.updateContext = function () {
  this.state.context.push(types$1.templateQuasi);
  this.state.exprAllowed = true;
};

types.parenL.updateContext = function (prevType) {
  var statementParens = prevType === types._if || prevType === types._for || prevType === types._with || prevType === types._while;
  this.state.context.push(statementParens ? types$1.parenStatement : types$1.parenExpression);
  this.state.exprAllowed = true;
};

types.incDec.updateContext = function () {};

types._function.updateContext = types._class.updateContext = function (prevType) {
  if (prevType.beforeExpr && prevType !== types.semi && prevType !== types._else && !(prevType === types._return && lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start))) && !((prevType === types.colon || prevType === types.braceL) && this.curContext() === types$1.b_stat)) {
    this.state.context.push(types$1.functionExpression);
  } else {
    this.state.context.push(types$1.functionStatement);
  }

  this.state.exprAllowed = false;
};

types.backQuote.updateContext = function () {
  if (this.curContext() === types$1.template) {
    this.state.context.pop();
  } else {
    this.state.context.push(types$1.template);
  }

  this.state.exprAllowed = false;
};

function makePredicate(words) {
  var wordsArr = words.split(" ");
  return function (str) {
    return wordsArr.indexOf(str) >= 0;
  };
}

var reservedWords = {
  "6": makePredicate("enum await"),
  strict: makePredicate("implements interface let package private protected public static yield"),
  strictBind: makePredicate("eval arguments")
};
var isKeyword = makePredicate("break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this let const class extends export import yield super");
var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEF\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7B9\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F";
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 477, 28, 11, 0, 9, 21, 190, 52, 76, 44, 33, 24, 27, 35, 30, 0, 12, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 54, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 86, 26, 230, 43, 117, 63, 32, 0, 257, 0, 11, 39, 8, 0, 22, 0, 12, 39, 3, 3, 20, 0, 35, 56, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 270, 921, 103, 110, 18, 195, 2749, 1070, 4050, 582, 8634, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 68, 12, 0, 67, 12, 65, 1, 31, 6129, 15, 754, 9486, 286, 82, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 4149, 196, 60, 67, 1213, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42710, 42, 4148, 12, 221, 3, 5761, 15, 7472, 3104, 541];
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 525, 10, 176, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 4, 9, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 280, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 19306, 9, 135, 4, 60, 6, 26, 9, 1016, 45, 17, 3, 19723, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 2214, 6, 110, 6, 6, 9, 792487, 239];

function isInAstralSet(code, set) {
  var pos = 0x10000;

  for (var i = 0; i < set.length; i += 2) {
    pos += set[i];
    if (pos > code) return false;
    pos += set[i + 1];
    if (pos >= code) return true;
  }

  return false;
}

function isIdentifierStart(code) {
  if (code < 65) return code === 36;
  if (code <= 90) return true;
  if (code < 97) return code === 95;
  if (code <= 122) return true;

  if (code <= 0xffff) {
    return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }

  return isInAstralSet(code, astralIdentifierStartCodes);
}
function isIteratorStart(current, next) {
  return current === 64 && next === 64;
}
function isIdentifierChar(code) {
  if (code < 48) return code === 36;
  if (code < 58) return true;
  if (code < 65) return false;
  if (code <= 90) return true;
  if (code < 97) return code === 95;
  if (code <= 122) return true;

  if (code <= 0xffff) {
    return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
  }

  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}

var reservedTypes = ["any", "bool", "boolean", "empty", "false", "mixed", "null", "number", "static", "string", "true", "typeof", "void", "interface", "extends", "_"];

function isEsModuleType(bodyElement) {
  return bodyElement.type === "DeclareExportAllDeclaration" || bodyElement.type === "DeclareExportDeclaration" && (!bodyElement.declaration || bodyElement.declaration.type !== "TypeAlias" && bodyElement.declaration.type !== "InterfaceDeclaration");
}

function hasTypeImportKind(node) {
  return node.importKind === "type" || node.importKind === "typeof";
}

function isMaybeDefaultImport(state) {
  return (state.type === types.name || !!state.type.keyword) && state.value !== "from";
}

var exportSuggestions = {
  const: "declare export var",
  let: "declare export var",
  type: "export type",
  interface: "export interface"
};

function partition(list, test) {
  var list1 = [];
  var list2 = [];

  for (var i = 0; i < list.length; i++) {
    (test(list[i], i, list) ? list1 : list2).push(list[i]);
  }

  return [list1, list2];
}

var FLOW_PRAGMA_REGEX = /\*?\s*@((?:no)?flow)\b/;
var flow = (function (superClass) {
  return function (_superClass) {
    _inheritsLoose(_class, _superClass);

    function _class(options, input) {
      var _this;

      _this = _superClass.call(this, options, input) || this;
      _this.flowPragma = undefined;
      return _this;
    }

    var _proto = _class.prototype;

    _proto.shouldParseTypes = function shouldParseTypes() {
      return this.getPluginOption("flow", "all") || this.flowPragma === "flow";
    };

    _proto.addComment = function addComment(comment) {
      if (this.flowPragma === undefined) {
        var matches = FLOW_PRAGMA_REGEX.exec(comment.value);

        if (!matches) {
          this.flowPragma = null;
        } else if (matches[1] === "flow") {
          this.flowPragma = "flow";
        } else if (matches[1] === "noflow") {
          this.flowPragma = "noflow";
        } else {
          throw new Error("Unexpected flow pragma");
        }
      }

      return _superClass.prototype.addComment.call(this, comment);
    };

    _proto.flowParseTypeInitialiser = function flowParseTypeInitialiser(tok) {
      var oldInType = this.state.inType;
      this.state.inType = true;
      this.expect(tok || types.colon);
      var type = this.flowParseType();
      this.state.inType = oldInType;
      return type;
    };

    _proto.flowParsePredicate = function flowParsePredicate() {
      var node = this.startNode();
      var moduloLoc = this.state.startLoc;
      var moduloPos = this.state.start;
      this.expect(types.modulo);
      var checksLoc = this.state.startLoc;
      this.expectContextual("checks");

      if (moduloLoc.line !== checksLoc.line || moduloLoc.column !== checksLoc.column - 1) {
        this.raise(moduloPos, "Spaces between ´%´ and ´checks´ are not allowed here.");
      }

      if (this.eat(types.parenL)) {
        node.value = this.parseExpression();
        this.expect(types.parenR);
        return this.finishNode(node, "DeclaredPredicate");
      } else {
        return this.finishNode(node, "InferredPredicate");
      }
    };

    _proto.flowParseTypeAndPredicateInitialiser = function flowParseTypeAndPredicateInitialiser() {
      var oldInType = this.state.inType;
      this.state.inType = true;
      this.expect(types.colon);
      var type = null;
      var predicate = null;

      if (this.match(types.modulo)) {
        this.state.inType = oldInType;
        predicate = this.flowParsePredicate();
      } else {
        type = this.flowParseType();
        this.state.inType = oldInType;

        if (this.match(types.modulo)) {
          predicate = this.flowParsePredicate();
        }
      }

      return [type, predicate];
    };

    _proto.flowParseDeclareClass = function flowParseDeclareClass(node) {
      this.next();
      this.flowParseInterfaceish(node, true);
      return this.finishNode(node, "DeclareClass");
    };

    _proto.flowParseDeclareFunction = function flowParseDeclareFunction(node) {
      this.next();
      var id = node.id = this.parseIdentifier();
      var typeNode = this.startNode();
      var typeContainer = this.startNode();

      if (this.isRelational("<")) {
        typeNode.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        typeNode.typeParameters = null;
      }

      this.expect(types.parenL);
      var tmp = this.flowParseFunctionTypeParams();
      typeNode.params = tmp.params;
      typeNode.rest = tmp.rest;
      this.expect(types.parenR);

      var _this$flowParseTypeAn = this.flowParseTypeAndPredicateInitialiser();

      typeNode.returnType = _this$flowParseTypeAn[0];
      node.predicate = _this$flowParseTypeAn[1];
      typeContainer.typeAnnotation = this.finishNode(typeNode, "FunctionTypeAnnotation");
      id.typeAnnotation = this.finishNode(typeContainer, "TypeAnnotation");
      this.finishNode(id, id.type);
      this.semicolon();
      return this.finishNode(node, "DeclareFunction");
    };

    _proto.flowParseDeclare = function flowParseDeclare(node, insideModule) {
      if (this.match(types._class)) {
        return this.flowParseDeclareClass(node);
      } else if (this.match(types._function)) {
        return this.flowParseDeclareFunction(node);
      } else if (this.match(types._var)) {
        return this.flowParseDeclareVariable(node);
      } else if (this.isContextual("module")) {
        if (this.lookahead().type === types.dot) {
          return this.flowParseDeclareModuleExports(node);
        } else {
          if (insideModule) {
            this.unexpected(null, "`declare module` cannot be used inside another `declare module`");
          }

          return this.flowParseDeclareModule(node);
        }
      } else if (this.isContextual("type")) {
        return this.flowParseDeclareTypeAlias(node);
      } else if (this.isContextual("opaque")) {
        return this.flowParseDeclareOpaqueType(node);
      } else if (this.isContextual("interface")) {
        return this.flowParseDeclareInterface(node);
      } else if (this.match(types._export)) {
        return this.flowParseDeclareExportDeclaration(node, insideModule);
      } else {
        throw this.unexpected();
      }
    };

    _proto.flowParseDeclareVariable = function flowParseDeclareVariable(node) {
      this.next();
      node.id = this.flowParseTypeAnnotatableIdentifier(true);
      this.semicolon();
      return this.finishNode(node, "DeclareVariable");
    };

    _proto.flowParseDeclareModule = function flowParseDeclareModule(node) {
      var _this2 = this;

      this.next();

      if (this.match(types.string)) {
        node.id = this.parseExprAtom();
      } else {
        node.id = this.parseIdentifier();
      }

      var bodyNode = node.body = this.startNode();
      var body = bodyNode.body = [];
      this.expect(types.braceL);

      while (!this.match(types.braceR)) {
        var _bodyNode = this.startNode();

        if (this.match(types._import)) {
          var lookahead = this.lookahead();

          if (lookahead.value !== "type" && lookahead.value !== "typeof") {
            this.unexpected(null, "Imports within a `declare module` body must always be `import type` or `import typeof`");
          }

          this.next();
          this.parseImport(_bodyNode);
        } else {
          this.expectContextual("declare", "Only declares and type imports are allowed inside declare module");
          _bodyNode = this.flowParseDeclare(_bodyNode, true);
        }

        body.push(_bodyNode);
      }

      this.expect(types.braceR);
      this.finishNode(bodyNode, "BlockStatement");
      var kind = null;
      var hasModuleExport = false;
      var errorMessage = "Found both `declare module.exports` and `declare export` in the same module. " + "Modules can only have 1 since they are either an ES module or they are a CommonJS module";
      body.forEach(function (bodyElement) {
        if (isEsModuleType(bodyElement)) {
          if (kind === "CommonJS") {
            _this2.unexpected(bodyElement.start, errorMessage);
          }

          kind = "ES";
        } else if (bodyElement.type === "DeclareModuleExports") {
          if (hasModuleExport) {
            _this2.unexpected(bodyElement.start, "Duplicate `declare module.exports` statement");
          }

          if (kind === "ES") _this2.unexpected(bodyElement.start, errorMessage);
          kind = "CommonJS";
          hasModuleExport = true;
        }
      });
      node.kind = kind || "CommonJS";
      return this.finishNode(node, "DeclareModule");
    };

    _proto.flowParseDeclareExportDeclaration = function flowParseDeclareExportDeclaration(node, insideModule) {
      this.expect(types._export);

      if (this.eat(types._default)) {
        if (this.match(types._function) || this.match(types._class)) {
          node.declaration = this.flowParseDeclare(this.startNode());
        } else {
          node.declaration = this.flowParseType();
          this.semicolon();
        }

        node.default = true;
        return this.finishNode(node, "DeclareExportDeclaration");
      } else {
        if (this.match(types._const) || this.match(types._let) || (this.isContextual("type") || this.isContextual("interface")) && !insideModule) {
          var label = this.state.value;
          var suggestion = exportSuggestions[label];
          this.unexpected(this.state.start, "`declare export " + label + "` is not supported. Use `" + suggestion + "` instead");
        }

        if (this.match(types._var) || this.match(types._function) || this.match(types._class) || this.isContextual("opaque")) {
            node.declaration = this.flowParseDeclare(this.startNode());
            node.default = false;
            return this.finishNode(node, "DeclareExportDeclaration");
          } else if (this.match(types.star) || this.match(types.braceL) || this.isContextual("interface") || this.isContextual("type") || this.isContextual("opaque")) {
            node = this.parseExport(node);

            if (node.type === "ExportNamedDeclaration") {
              node.type = "ExportDeclaration";
              node.default = false;
              delete node.exportKind;
            }

            node.type = "Declare" + node.type;
            return node;
          }
      }

      throw this.unexpected();
    };

    _proto.flowParseDeclareModuleExports = function flowParseDeclareModuleExports(node) {
      this.expectContextual("module");
      this.expect(types.dot);
      this.expectContextual("exports");
      node.typeAnnotation = this.flowParseTypeAnnotation();
      this.semicolon();
      return this.finishNode(node, "DeclareModuleExports");
    };

    _proto.flowParseDeclareTypeAlias = function flowParseDeclareTypeAlias(node) {
      this.next();
      this.flowParseTypeAlias(node);
      return this.finishNode(node, "DeclareTypeAlias");
    };

    _proto.flowParseDeclareOpaqueType = function flowParseDeclareOpaqueType(node) {
      this.next();
      this.flowParseOpaqueType(node, true);
      return this.finishNode(node, "DeclareOpaqueType");
    };

    _proto.flowParseDeclareInterface = function flowParseDeclareInterface(node) {
      this.next();
      this.flowParseInterfaceish(node);
      return this.finishNode(node, "DeclareInterface");
    };

    _proto.flowParseInterfaceish = function flowParseInterfaceish(node, isClass) {
      if (isClass === void 0) {
        isClass = false;
      }

      node.id = this.flowParseRestrictedIdentifier(!isClass);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        node.typeParameters = null;
      }

      node.extends = [];
      node.implements = [];
      node.mixins = [];

      if (this.eat(types._extends)) {
        do {
          node.extends.push(this.flowParseInterfaceExtends());
        } while (!isClass && this.eat(types.comma));
      }

      if (this.isContextual("mixins")) {
        this.next();

        do {
          node.mixins.push(this.flowParseInterfaceExtends());
        } while (this.eat(types.comma));
      }

      if (this.isContextual("implements")) {
        this.next();

        do {
          node.implements.push(this.flowParseInterfaceExtends());
        } while (this.eat(types.comma));
      }

      node.body = this.flowParseObjectType({
        allowStatic: isClass,
        allowExact: false,
        allowSpread: false,
        allowProto: isClass,
        allowInexact: false
      });
    };

    _proto.flowParseInterfaceExtends = function flowParseInterfaceExtends() {
      var node = this.startNode();
      node.id = this.flowParseQualifiedTypeIdentifier();

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterInstantiation();
      } else {
        node.typeParameters = null;
      }

      return this.finishNode(node, "InterfaceExtends");
    };

    _proto.flowParseInterface = function flowParseInterface(node) {
      this.flowParseInterfaceish(node);
      return this.finishNode(node, "InterfaceDeclaration");
    };

    _proto.checkNotUnderscore = function checkNotUnderscore(word) {
      if (word === "_") {
        throw this.unexpected(null, "`_` is only allowed as a type argument to call or new");
      }
    };

    _proto.checkReservedType = function checkReservedType(word, startLoc) {
      if (reservedTypes.indexOf(word) > -1) {
        this.raise(startLoc, "Cannot overwrite reserved type " + word);
      }
    };

    _proto.flowParseRestrictedIdentifier = function flowParseRestrictedIdentifier(liberal) {
      this.checkReservedType(this.state.value, this.state.start);
      return this.parseIdentifier(liberal);
    };

    _proto.flowParseTypeAlias = function flowParseTypeAlias(node) {
      node.id = this.flowParseRestrictedIdentifier();

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        node.typeParameters = null;
      }

      node.right = this.flowParseTypeInitialiser(types.eq);
      this.semicolon();
      return this.finishNode(node, "TypeAlias");
    };

    _proto.flowParseOpaqueType = function flowParseOpaqueType(node, declare) {
      this.expectContextual("type");
      node.id = this.flowParseRestrictedIdentifier(true);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        node.typeParameters = null;
      }

      node.supertype = null;

      if (this.match(types.colon)) {
        node.supertype = this.flowParseTypeInitialiser(types.colon);
      }

      node.impltype = null;

      if (!declare) {
        node.impltype = this.flowParseTypeInitialiser(types.eq);
      }

      this.semicolon();
      return this.finishNode(node, "OpaqueType");
    };

    _proto.flowParseTypeParameter = function flowParseTypeParameter(allowDefault, requireDefault) {
      if (allowDefault === void 0) {
        allowDefault = true;
      }

      if (requireDefault === void 0) {
        requireDefault = false;
      }

      if (!allowDefault && requireDefault) {
        throw new Error("Cannot disallow a default value (`allowDefault`) while also requiring it (`requireDefault`).");
      }

      var nodeStart = this.state.start;
      var node = this.startNode();
      var variance = this.flowParseVariance();
      var ident = this.flowParseTypeAnnotatableIdentifier();
      node.name = ident.name;
      node.variance = variance;
      node.bound = ident.typeAnnotation;

      if (this.match(types.eq)) {
        if (allowDefault) {
          this.eat(types.eq);
          node.default = this.flowParseType();
        } else {
          this.unexpected();
        }
      } else {
        if (requireDefault) {
          this.unexpected(nodeStart, "Type parameter declaration needs a default, since a preceding type parameter declaration has a default.");
        }
      }

      return this.finishNode(node, "TypeParameter");
    };

    _proto.flowParseTypeParameterDeclaration = function flowParseTypeParameterDeclaration(allowDefault) {
      if (allowDefault === void 0) {
        allowDefault = true;
      }

      var oldInType = this.state.inType;
      var node = this.startNode();
      node.params = [];
      this.state.inType = true;

      if (this.isRelational("<") || this.match(types.jsxTagStart)) {
        this.next();
      } else {
        this.unexpected();
      }

      var defaultRequired = false;

      do {
        var typeParameter = this.flowParseTypeParameter(allowDefault, defaultRequired);
        node.params.push(typeParameter);

        if (typeParameter.default) {
          defaultRequired = true;
        }

        if (!this.isRelational(">")) {
          this.expect(types.comma);
        }
      } while (!this.isRelational(">"));

      this.expectRelational(">");
      this.state.inType = oldInType;
      return this.finishNode(node, "TypeParameterDeclaration");
    };

    _proto.flowParseTypeParameterInstantiation = function flowParseTypeParameterInstantiation() {
      var node = this.startNode();
      var oldInType = this.state.inType;
      node.params = [];
      this.state.inType = true;
      this.expectRelational("<");
      var oldNoAnonFunctionType = this.state.noAnonFunctionType;
      this.state.noAnonFunctionType = false;

      while (!this.isRelational(">")) {
        node.params.push(this.flowParseType());

        if (!this.isRelational(">")) {
          this.expect(types.comma);
        }
      }

      this.state.noAnonFunctionType = oldNoAnonFunctionType;
      this.expectRelational(">");
      this.state.inType = oldInType;
      return this.finishNode(node, "TypeParameterInstantiation");
    };

    _proto.flowParseTypeParameterInstantiationCallOrNew = function flowParseTypeParameterInstantiationCallOrNew() {
      var node = this.startNode();
      var oldInType = this.state.inType;
      node.params = [];
      this.state.inType = true;
      this.expectRelational("<");

      while (!this.isRelational(">")) {
        node.params.push(this.flowParseTypeOrImplicitInstantiation());

        if (!this.isRelational(">")) {
          this.expect(types.comma);
        }
      }

      this.expectRelational(">");
      this.state.inType = oldInType;
      return this.finishNode(node, "TypeParameterInstantiation");
    };

    _proto.flowParseInterfaceType = function flowParseInterfaceType() {
      var node = this.startNode();
      this.expectContextual("interface");
      node.extends = [];

      if (this.eat(types._extends)) {
        do {
          node.extends.push(this.flowParseInterfaceExtends());
        } while (this.eat(types.comma));
      }

      node.body = this.flowParseObjectType({
        allowStatic: false,
        allowExact: false,
        allowSpread: false,
        allowProto: false,
        allowInexact: false
      });
      return this.finishNode(node, "InterfaceTypeAnnotation");
    };

    _proto.flowParseObjectPropertyKey = function flowParseObjectPropertyKey() {
      return this.match(types.num) || this.match(types.string) ? this.parseExprAtom() : this.parseIdentifier(true);
    };

    _proto.flowParseObjectTypeIndexer = function flowParseObjectTypeIndexer(node, isStatic, variance) {
      node.static = isStatic;

      if (this.lookahead().type === types.colon) {
        node.id = this.flowParseObjectPropertyKey();
        node.key = this.flowParseTypeInitialiser();
      } else {
        node.id = null;
        node.key = this.flowParseType();
      }

      this.expect(types.bracketR);
      node.value = this.flowParseTypeInitialiser();
      node.variance = variance;
      return this.finishNode(node, "ObjectTypeIndexer");
    };

    _proto.flowParseObjectTypeInternalSlot = function flowParseObjectTypeInternalSlot(node, isStatic) {
      node.static = isStatic;
      node.id = this.flowParseObjectPropertyKey();
      this.expect(types.bracketR);
      this.expect(types.bracketR);

      if (this.isRelational("<") || this.match(types.parenL)) {
        node.method = true;
        node.optional = false;
        node.value = this.flowParseObjectTypeMethodish(this.startNodeAt(node.start, node.loc.start));
      } else {
        node.method = false;

        if (this.eat(types.question)) {
          node.optional = true;
        }

        node.value = this.flowParseTypeInitialiser();
      }

      return this.finishNode(node, "ObjectTypeInternalSlot");
    };

    _proto.flowParseObjectTypeMethodish = function flowParseObjectTypeMethodish(node) {
      node.params = [];
      node.rest = null;
      node.typeParameters = null;

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration(false);
      }

      this.expect(types.parenL);

      while (!this.match(types.parenR) && !this.match(types.ellipsis)) {
        node.params.push(this.flowParseFunctionTypeParam());

        if (!this.match(types.parenR)) {
          this.expect(types.comma);
        }
      }

      if (this.eat(types.ellipsis)) {
        node.rest = this.flowParseFunctionTypeParam();
      }

      this.expect(types.parenR);
      node.returnType = this.flowParseTypeInitialiser();
      return this.finishNode(node, "FunctionTypeAnnotation");
    };

    _proto.flowParseObjectTypeCallProperty = function flowParseObjectTypeCallProperty(node, isStatic) {
      var valueNode = this.startNode();
      node.static = isStatic;
      node.value = this.flowParseObjectTypeMethodish(valueNode);
      return this.finishNode(node, "ObjectTypeCallProperty");
    };

    _proto.flowParseObjectType = function flowParseObjectType(_ref) {
      var allowStatic = _ref.allowStatic,
          allowExact = _ref.allowExact,
          allowSpread = _ref.allowSpread,
          allowProto = _ref.allowProto,
          allowInexact = _ref.allowInexact;
      var oldInType = this.state.inType;
      this.state.inType = true;
      var nodeStart = this.startNode();
      nodeStart.callProperties = [];
      nodeStart.properties = [];
      nodeStart.indexers = [];
      nodeStart.internalSlots = [];
      var endDelim;
      var exact;
      var inexact = false;

      if (allowExact && this.match(types.braceBarL)) {
        this.expect(types.braceBarL);
        endDelim = types.braceBarR;
        exact = true;
      } else {
        this.expect(types.braceL);
        endDelim = types.braceR;
        exact = false;
      }

      nodeStart.exact = exact;

      while (!this.match(endDelim)) {
        var isStatic = false;
        var protoStart = null;
        var node = this.startNode();

        if (allowProto && this.isContextual("proto")) {
          var lookahead = this.lookahead();

          if (lookahead.type !== types.colon && lookahead.type !== types.question) {
            this.next();
            protoStart = this.state.start;
            allowStatic = false;
          }
        }

        if (allowStatic && this.isContextual("static")) {
          var _lookahead = this.lookahead();

          if (_lookahead.type !== types.colon && _lookahead.type !== types.question) {
            this.next();
            isStatic = true;
          }
        }

        var variance = this.flowParseVariance();

        if (this.eat(types.bracketL)) {
          if (protoStart != null) {
            this.unexpected(protoStart);
          }

          if (this.eat(types.bracketL)) {
            if (variance) {
              this.unexpected(variance.start);
            }

            nodeStart.internalSlots.push(this.flowParseObjectTypeInternalSlot(node, isStatic));
          } else {
            nodeStart.indexers.push(this.flowParseObjectTypeIndexer(node, isStatic, variance));
          }
        } else if (this.match(types.parenL) || this.isRelational("<")) {
          if (protoStart != null) {
            this.unexpected(protoStart);
          }

          if (variance) {
            this.unexpected(variance.start);
          }

          nodeStart.callProperties.push(this.flowParseObjectTypeCallProperty(node, isStatic));
        } else {
          var kind = "init";

          if (this.isContextual("get") || this.isContextual("set")) {
            var _lookahead2 = this.lookahead();

            if (_lookahead2.type === types.name || _lookahead2.type === types.string || _lookahead2.type === types.num) {
              kind = this.state.value;
              this.next();
            }
          }

          var propOrInexact = this.flowParseObjectTypeProperty(node, isStatic, protoStart, variance, kind, allowSpread, allowInexact);

          if (propOrInexact === null) {
            inexact = true;
          } else {
            nodeStart.properties.push(propOrInexact);
          }
        }

        this.flowObjectTypeSemicolon();
      }

      this.expect(endDelim);

      if (allowSpread) {
        nodeStart.inexact = inexact;
      }

      var out = this.finishNode(nodeStart, "ObjectTypeAnnotation");
      this.state.inType = oldInType;
      return out;
    };

    _proto.flowParseObjectTypeProperty = function flowParseObjectTypeProperty(node, isStatic, protoStart, variance, kind, allowSpread, allowInexact) {
      if (this.match(types.ellipsis)) {
        if (!allowSpread) {
          this.unexpected(null, "Spread operator cannot appear in class or interface definitions");
        }

        if (protoStart != null) {
          this.unexpected(protoStart);
        }

        if (variance) {
          this.unexpected(variance.start, "Spread properties cannot have variance");
        }

        this.expect(types.ellipsis);
        var isInexactToken = this.eat(types.comma) || this.eat(types.semi);

        if (this.match(types.braceR)) {
          if (allowInexact) return null;
          this.unexpected(null, "Explicit inexact syntax is only allowed inside inexact objects");
        }

        if (this.match(types.braceBarR)) {
          this.unexpected(null, "Explicit inexact syntax cannot appear inside an explicit exact object type");
        }

        if (isInexactToken) {
          this.unexpected(null, "Explicit inexact syntax must appear at the end of an inexact object");
        }

        node.argument = this.flowParseType();
        return this.finishNode(node, "ObjectTypeSpreadProperty");
      } else {
        node.key = this.flowParseObjectPropertyKey();
        node.static = isStatic;
        node.proto = protoStart != null;
        node.kind = kind;
        var optional = false;

        if (this.isRelational("<") || this.match(types.parenL)) {
          node.method = true;

          if (protoStart != null) {
            this.unexpected(protoStart);
          }

          if (variance) {
            this.unexpected(variance.start);
          }

          node.value = this.flowParseObjectTypeMethodish(this.startNodeAt(node.start, node.loc.start));

          if (kind === "get" || kind === "set") {
            this.flowCheckGetterSetterParams(node);
          }
        } else {
          if (kind !== "init") this.unexpected();
          node.method = false;

          if (this.eat(types.question)) {
            optional = true;
          }

          node.value = this.flowParseTypeInitialiser();
          node.variance = variance;
        }

        node.optional = optional;
        return this.finishNode(node, "ObjectTypeProperty");
      }
    };

    _proto.flowCheckGetterSetterParams = function flowCheckGetterSetterParams(property) {
      var paramCount = property.kind === "get" ? 0 : 1;
      var start = property.start;
      var length = property.value.params.length + (property.value.rest ? 1 : 0);

      if (length !== paramCount) {
        if (property.kind === "get") {
          this.raise(start, "getter must not have any formal parameters");
        } else {
          this.raise(start, "setter must have exactly one formal parameter");
        }
      }

      if (property.kind === "set" && property.value.rest) {
        this.raise(start, "setter function argument must not be a rest parameter");
      }
    };

    _proto.flowObjectTypeSemicolon = function flowObjectTypeSemicolon() {
      if (!this.eat(types.semi) && !this.eat(types.comma) && !this.match(types.braceR) && !this.match(types.braceBarR)) {
        this.unexpected();
      }
    };

    _proto.flowParseQualifiedTypeIdentifier = function flowParseQualifiedTypeIdentifier(startPos, startLoc, id) {
      startPos = startPos || this.state.start;
      startLoc = startLoc || this.state.startLoc;
      var node = id || this.parseIdentifier();

      while (this.eat(types.dot)) {
        var node2 = this.startNodeAt(startPos, startLoc);
        node2.qualification = node;
        node2.id = this.parseIdentifier();
        node = this.finishNode(node2, "QualifiedTypeIdentifier");
      }

      return node;
    };

    _proto.flowParseGenericType = function flowParseGenericType(startPos, startLoc, id) {
      var node = this.startNodeAt(startPos, startLoc);
      node.typeParameters = null;
      node.id = this.flowParseQualifiedTypeIdentifier(startPos, startLoc, id);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterInstantiation();
      }

      return this.finishNode(node, "GenericTypeAnnotation");
    };

    _proto.flowParseTypeofType = function flowParseTypeofType() {
      var node = this.startNode();
      this.expect(types._typeof);
      node.argument = this.flowParsePrimaryType();
      return this.finishNode(node, "TypeofTypeAnnotation");
    };

    _proto.flowParseTupleType = function flowParseTupleType() {
      var node = this.startNode();
      node.types = [];
      this.expect(types.bracketL);

      while (this.state.pos < this.input.length && !this.match(types.bracketR)) {
        node.types.push(this.flowParseType());
        if (this.match(types.bracketR)) break;
        this.expect(types.comma);
      }

      this.expect(types.bracketR);
      return this.finishNode(node, "TupleTypeAnnotation");
    };

    _proto.flowParseFunctionTypeParam = function flowParseFunctionTypeParam() {
      var name = null;
      var optional = false;
      var typeAnnotation = null;
      var node = this.startNode();
      var lh = this.lookahead();

      if (lh.type === types.colon || lh.type === types.question) {
        name = this.parseIdentifier();

        if (this.eat(types.question)) {
          optional = true;
        }

        typeAnnotation = this.flowParseTypeInitialiser();
      } else {
        typeAnnotation = this.flowParseType();
      }

      node.name = name;
      node.optional = optional;
      node.typeAnnotation = typeAnnotation;
      return this.finishNode(node, "FunctionTypeParam");
    };

    _proto.reinterpretTypeAsFunctionTypeParam = function reinterpretTypeAsFunctionTypeParam(type) {
      var node = this.startNodeAt(type.start, type.loc.start);
      node.name = null;
      node.optional = false;
      node.typeAnnotation = type;
      return this.finishNode(node, "FunctionTypeParam");
    };

    _proto.flowParseFunctionTypeParams = function flowParseFunctionTypeParams(params) {
      if (params === void 0) {
        params = [];
      }

      var rest = null;

      while (!this.match(types.parenR) && !this.match(types.ellipsis)) {
        params.push(this.flowParseFunctionTypeParam());

        if (!this.match(types.parenR)) {
          this.expect(types.comma);
        }
      }

      if (this.eat(types.ellipsis)) {
        rest = this.flowParseFunctionTypeParam();
      }

      return {
        params: params,
        rest: rest
      };
    };

    _proto.flowIdentToTypeAnnotation = function flowIdentToTypeAnnotation(startPos, startLoc, node, id) {
      switch (id.name) {
        case "any":
          return this.finishNode(node, "AnyTypeAnnotation");

        case "void":
          return this.finishNode(node, "VoidTypeAnnotation");

        case "bool":
        case "boolean":
          return this.finishNode(node, "BooleanTypeAnnotation");

        case "mixed":
          return this.finishNode(node, "MixedTypeAnnotation");

        case "empty":
          return this.finishNode(node, "EmptyTypeAnnotation");

        case "number":
          return this.finishNode(node, "NumberTypeAnnotation");

        case "string":
          return this.finishNode(node, "StringTypeAnnotation");

        default:
          this.checkNotUnderscore(id.name);
          return this.flowParseGenericType(startPos, startLoc, id);
      }
    };

    _proto.flowParsePrimaryType = function flowParsePrimaryType() {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;
      var node = this.startNode();
      var tmp;
      var type;
      var isGroupedType = false;
      var oldNoAnonFunctionType = this.state.noAnonFunctionType;

      switch (this.state.type) {
        case types.name:
          if (this.isContextual("interface")) {
            return this.flowParseInterfaceType();
          }

          return this.flowIdentToTypeAnnotation(startPos, startLoc, node, this.parseIdentifier());

        case types.braceL:
          return this.flowParseObjectType({
            allowStatic: false,
            allowExact: false,
            allowSpread: true,
            allowProto: false,
            allowInexact: true
          });

        case types.braceBarL:
          return this.flowParseObjectType({
            allowStatic: false,
            allowExact: true,
            allowSpread: true,
            allowProto: false,
            allowInexact: false
          });

        case types.bracketL:
          return this.flowParseTupleType();

        case types.relational:
          if (this.state.value === "<") {
            node.typeParameters = this.flowParseTypeParameterDeclaration(false);
            this.expect(types.parenL);
            tmp = this.flowParseFunctionTypeParams();
            node.params = tmp.params;
            node.rest = tmp.rest;
            this.expect(types.parenR);
            this.expect(types.arrow);
            node.returnType = this.flowParseType();
            return this.finishNode(node, "FunctionTypeAnnotation");
          }

          break;

        case types.parenL:
          this.next();

          if (!this.match(types.parenR) && !this.match(types.ellipsis)) {
            if (this.match(types.name)) {
              var token = this.lookahead().type;
              isGroupedType = token !== types.question && token !== types.colon;
            } else {
              isGroupedType = true;
            }
          }

          if (isGroupedType) {
            this.state.noAnonFunctionType = false;
            type = this.flowParseType();
            this.state.noAnonFunctionType = oldNoAnonFunctionType;

            if (this.state.noAnonFunctionType || !(this.match(types.comma) || this.match(types.parenR) && this.lookahead().type === types.arrow)) {
              this.expect(types.parenR);
              return type;
            } else {
              this.eat(types.comma);
            }
          }

          if (type) {
            tmp = this.flowParseFunctionTypeParams([this.reinterpretTypeAsFunctionTypeParam(type)]);
          } else {
            tmp = this.flowParseFunctionTypeParams();
          }

          node.params = tmp.params;
          node.rest = tmp.rest;
          this.expect(types.parenR);
          this.expect(types.arrow);
          node.returnType = this.flowParseType();
          node.typeParameters = null;
          return this.finishNode(node, "FunctionTypeAnnotation");

        case types.string:
          return this.parseLiteral(this.state.value, "StringLiteralTypeAnnotation");

        case types._true:
        case types._false:
          node.value = this.match(types._true);
          this.next();
          return this.finishNode(node, "BooleanLiteralTypeAnnotation");

        case types.plusMin:
          if (this.state.value === "-") {
            this.next();

            if (!this.match(types.num)) {
              this.unexpected(null, "Unexpected token, expected \"number\"");
            }

            return this.parseLiteral(-this.state.value, "NumberLiteralTypeAnnotation", node.start, node.loc.start);
          }

          this.unexpected();

        case types.num:
          return this.parseLiteral(this.state.value, "NumberLiteralTypeAnnotation");

        case types._null:
          this.next();
          return this.finishNode(node, "NullLiteralTypeAnnotation");

        case types._this:
          this.next();
          return this.finishNode(node, "ThisTypeAnnotation");

        case types.star:
          this.next();
          return this.finishNode(node, "ExistsTypeAnnotation");

        default:
          if (this.state.type.keyword === "typeof") {
            return this.flowParseTypeofType();
          }

      }

      throw this.unexpected();
    };

    _proto.flowParsePostfixType = function flowParsePostfixType() {
      var startPos = this.state.start,
          startLoc = this.state.startLoc;
      var type = this.flowParsePrimaryType();

      while (!this.canInsertSemicolon() && this.match(types.bracketL)) {
        var node = this.startNodeAt(startPos, startLoc);
        node.elementType = type;
        this.expect(types.bracketL);
        this.expect(types.bracketR);
        type = this.finishNode(node, "ArrayTypeAnnotation");
      }

      return type;
    };

    _proto.flowParsePrefixType = function flowParsePrefixType() {
      var node = this.startNode();

      if (this.eat(types.question)) {
        node.typeAnnotation = this.flowParsePrefixType();
        return this.finishNode(node, "NullableTypeAnnotation");
      } else {
        return this.flowParsePostfixType();
      }
    };

    _proto.flowParseAnonFunctionWithoutParens = function flowParseAnonFunctionWithoutParens() {
      var param = this.flowParsePrefixType();

      if (!this.state.noAnonFunctionType && this.eat(types.arrow)) {
        var node = this.startNodeAt(param.start, param.loc.start);
        node.params = [this.reinterpretTypeAsFunctionTypeParam(param)];
        node.rest = null;
        node.returnType = this.flowParseType();
        node.typeParameters = null;
        return this.finishNode(node, "FunctionTypeAnnotation");
      }

      return param;
    };

    _proto.flowParseIntersectionType = function flowParseIntersectionType() {
      var node = this.startNode();
      this.eat(types.bitwiseAND);
      var type = this.flowParseAnonFunctionWithoutParens();
      node.types = [type];

      while (this.eat(types.bitwiseAND)) {
        node.types.push(this.flowParseAnonFunctionWithoutParens());
      }

      return node.types.length === 1 ? type : this.finishNode(node, "IntersectionTypeAnnotation");
    };

    _proto.flowParseUnionType = function flowParseUnionType() {
      var node = this.startNode();
      this.eat(types.bitwiseOR);
      var type = this.flowParseIntersectionType();
      node.types = [type];

      while (this.eat(types.bitwiseOR)) {
        node.types.push(this.flowParseIntersectionType());
      }

      return node.types.length === 1 ? type : this.finishNode(node, "UnionTypeAnnotation");
    };

    _proto.flowParseType = function flowParseType() {
      var oldInType = this.state.inType;
      this.state.inType = true;
      var type = this.flowParseUnionType();
      this.state.inType = oldInType;
      this.state.exprAllowed = this.state.exprAllowed || this.state.noAnonFunctionType;
      return type;
    };

    _proto.flowParseTypeOrImplicitInstantiation = function flowParseTypeOrImplicitInstantiation() {
      if (this.state.type === types.name && this.state.value === "_") {
        var startPos = this.state.start;
        var startLoc = this.state.startLoc;
        var node = this.parseIdentifier();
        return this.flowParseGenericType(startPos, startLoc, node);
      } else {
        return this.flowParseType();
      }
    };

    _proto.flowParseTypeAnnotation = function flowParseTypeAnnotation() {
      var node = this.startNode();
      node.typeAnnotation = this.flowParseTypeInitialiser();
      return this.finishNode(node, "TypeAnnotation");
    };

    _proto.flowParseTypeAnnotatableIdentifier = function flowParseTypeAnnotatableIdentifier(allowPrimitiveOverride) {
      var ident = allowPrimitiveOverride ? this.parseIdentifier() : this.flowParseRestrictedIdentifier();

      if (this.match(types.colon)) {
        ident.typeAnnotation = this.flowParseTypeAnnotation();
        this.finishNode(ident, ident.type);
      }

      return ident;
    };

    _proto.typeCastToParameter = function typeCastToParameter(node) {
      node.expression.typeAnnotation = node.typeAnnotation;
      return this.finishNodeAt(node.expression, node.expression.type, node.typeAnnotation.end, node.typeAnnotation.loc.end);
    };

    _proto.flowParseVariance = function flowParseVariance() {
      var variance = null;

      if (this.match(types.plusMin)) {
        variance = this.startNode();

        if (this.state.value === "+") {
          variance.kind = "plus";
        } else {
          variance.kind = "minus";
        }

        this.next();
        this.finishNode(variance, "Variance");
      }

      return variance;
    };

    _proto.parseFunctionBody = function parseFunctionBody(node, allowExpressionBody) {
      var _this3 = this;

      if (allowExpressionBody) {
        return this.forwardNoArrowParamsConversionAt(node, function () {
          return _superClass.prototype.parseFunctionBody.call(_this3, node, true);
        });
      }

      return _superClass.prototype.parseFunctionBody.call(this, node, false);
    };

    _proto.parseFunctionBodyAndFinish = function parseFunctionBodyAndFinish(node, type, allowExpressionBody) {
      if (!allowExpressionBody && this.match(types.colon)) {
        var typeNode = this.startNode();

        var _this$flowParseTypeAn2 = this.flowParseTypeAndPredicateInitialiser();

        typeNode.typeAnnotation = _this$flowParseTypeAn2[0];
        node.predicate = _this$flowParseTypeAn2[1];
        node.returnType = typeNode.typeAnnotation ? this.finishNode(typeNode, "TypeAnnotation") : null;
      }

      _superClass.prototype.parseFunctionBodyAndFinish.call(this, node, type, allowExpressionBody);
    };

    _proto.parseStatement = function parseStatement(declaration, topLevel) {
      if (this.state.strict && this.match(types.name) && this.state.value === "interface") {
        var node = this.startNode();
        this.next();
        return this.flowParseInterface(node);
      } else {
        var stmt = _superClass.prototype.parseStatement.call(this, declaration, topLevel);

        if (this.flowPragma === undefined && !this.isValidDirective(stmt)) {
          this.flowPragma = null;
        }

        return stmt;
      }
    };

    _proto.parseExpressionStatement = function parseExpressionStatement(node, expr) {
      if (expr.type === "Identifier") {
        if (expr.name === "declare") {
          if (this.match(types._class) || this.match(types.name) || this.match(types._function) || this.match(types._var) || this.match(types._export)) {
            return this.flowParseDeclare(node);
          }
        } else if (this.match(types.name)) {
          if (expr.name === "interface") {
            return this.flowParseInterface(node);
          } else if (expr.name === "type") {
            return this.flowParseTypeAlias(node);
          } else if (expr.name === "opaque") {
            return this.flowParseOpaqueType(node, false);
          }
        }
      }

      return _superClass.prototype.parseExpressionStatement.call(this, node, expr);
    };

    _proto.shouldParseExportDeclaration = function shouldParseExportDeclaration() {
      return this.isContextual("type") || this.isContextual("interface") || this.isContextual("opaque") || _superClass.prototype.shouldParseExportDeclaration.call(this);
    };

    _proto.isExportDefaultSpecifier = function isExportDefaultSpecifier() {
      if (this.match(types.name) && (this.state.value === "type" || this.state.value === "interface" || this.state.value == "opaque")) {
        return false;
      }

      return _superClass.prototype.isExportDefaultSpecifier.call(this);
    };

    _proto.parseConditional = function parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos) {
      var _this4 = this;

      if (!this.match(types.question)) return expr;

      if (refNeedsArrowPos) {
        var _state = this.state.clone();

        try {
          return _superClass.prototype.parseConditional.call(this, expr, noIn, startPos, startLoc);
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = _state;
            refNeedsArrowPos.start = err.pos || this.state.start;
            return expr;
          } else {
            throw err;
          }
        }
      }

      this.expect(types.question);
      var state = this.state.clone();
      var originalNoArrowAt = this.state.noArrowAt;
      var node = this.startNodeAt(startPos, startLoc);

      var _this$tryParseConditi = this.tryParseConditionalConsequent(),
          consequent = _this$tryParseConditi.consequent,
          failed = _this$tryParseConditi.failed;

      var _this$getArrowLikeExp = this.getArrowLikeExpressions(consequent),
          valid = _this$getArrowLikeExp[0],
          invalid = _this$getArrowLikeExp[1];

      if (failed || invalid.length > 0) {
        var noArrowAt = originalNoArrowAt.concat();

        if (invalid.length > 0) {
          this.state = state;
          this.state.noArrowAt = noArrowAt;

          for (var i = 0; i < invalid.length; i++) {
            noArrowAt.push(invalid[i].start);
          }

          var _this$tryParseConditi2 = this.tryParseConditionalConsequent();

          consequent = _this$tryParseConditi2.consequent;
          failed = _this$tryParseConditi2.failed;

          var _this$getArrowLikeExp2 = this.getArrowLikeExpressions(consequent);

          valid = _this$getArrowLikeExp2[0];
          invalid = _this$getArrowLikeExp2[1];
        }

        if (failed && valid.length > 1) {
          this.raise(state.start, "Ambiguous expression: wrap the arrow functions in parentheses to disambiguate.");
        }

        if (failed && valid.length === 1) {
          this.state = state;
          this.state.noArrowAt = noArrowAt.concat(valid[0].start);

          var _this$tryParseConditi3 = this.tryParseConditionalConsequent();

          consequent = _this$tryParseConditi3.consequent;
          failed = _this$tryParseConditi3.failed;
        }

        this.getArrowLikeExpressions(consequent, true);
      }

      this.state.noArrowAt = originalNoArrowAt;
      this.expect(types.colon);
      node.test = expr;
      node.consequent = consequent;
      node.alternate = this.forwardNoArrowParamsConversionAt(node, function () {
        return _this4.parseMaybeAssign(noIn, undefined, undefined, undefined);
      });
      return this.finishNode(node, "ConditionalExpression");
    };

    _proto.tryParseConditionalConsequent = function tryParseConditionalConsequent() {
      this.state.noArrowParamsConversionAt.push(this.state.start);
      var consequent = this.parseMaybeAssign();
      var failed = !this.match(types.colon);
      this.state.noArrowParamsConversionAt.pop();
      return {
        consequent: consequent,
        failed: failed
      };
    };

    _proto.getArrowLikeExpressions = function getArrowLikeExpressions(node, disallowInvalid) {
      var _this5 = this;

      var stack = [node];
      var arrows = [];

      while (stack.length !== 0) {
        var _node = stack.pop();

        if (_node.type === "ArrowFunctionExpression") {
          if (_node.typeParameters || !_node.returnType) {
            this.toAssignableList(_node.params, true, "arrow function parameters");

            _superClass.prototype.checkFunctionNameAndParams.call(this, _node, true);
          } else {
            arrows.push(_node);
          }

          stack.push(_node.body);
        } else if (_node.type === "ConditionalExpression") {
          stack.push(_node.consequent);
          stack.push(_node.alternate);
        }
      }

      if (disallowInvalid) {
        for (var i = 0; i < arrows.length; i++) {
          this.toAssignableList(node.params, true, "arrow function parameters");
        }

        return [arrows, []];
      }

      return partition(arrows, function (node) {
        try {
          _this5.toAssignableList(node.params, true, "arrow function parameters");

          return true;
        } catch (err) {
          return false;
        }
      });
    };

    _proto.forwardNoArrowParamsConversionAt = function forwardNoArrowParamsConversionAt(node, parse) {
      var result;

      if (this.state.noArrowParamsConversionAt.indexOf(node.start) !== -1) {
        this.state.noArrowParamsConversionAt.push(this.state.start);
        result = parse();
        this.state.noArrowParamsConversionAt.pop();
      } else {
        result = parse();
      }

      return result;
    };

    _proto.parseParenItem = function parseParenItem(node, startPos, startLoc) {
      node = _superClass.prototype.parseParenItem.call(this, node, startPos, startLoc);

      if (this.eat(types.question)) {
        node.optional = true;
      }

      if (this.match(types.colon)) {
        var typeCastNode = this.startNodeAt(startPos, startLoc);
        typeCastNode.expression = node;
        typeCastNode.typeAnnotation = this.flowParseTypeAnnotation();
        return this.finishNode(typeCastNode, "TypeCastExpression");
      }

      return node;
    };

    _proto.assertModuleNodeAllowed = function assertModuleNodeAllowed(node) {
      if (node.type === "ImportDeclaration" && (node.importKind === "type" || node.importKind === "typeof") || node.type === "ExportNamedDeclaration" && node.exportKind === "type" || node.type === "ExportAllDeclaration" && node.exportKind === "type") {
        return;
      }

      _superClass.prototype.assertModuleNodeAllowed.call(this, node);
    };

    _proto.parseExport = function parseExport(node) {
      node = _superClass.prototype.parseExport.call(this, node);

      if (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") {
        node.exportKind = node.exportKind || "value";
      }

      return node;
    };

    _proto.parseExportDeclaration = function parseExportDeclaration(node) {
      if (this.isContextual("type")) {
        node.exportKind = "type";
        var declarationNode = this.startNode();
        this.next();

        if (this.match(types.braceL)) {
          node.specifiers = this.parseExportSpecifiers();
          this.parseExportFrom(node);
          return null;
        } else {
          return this.flowParseTypeAlias(declarationNode);
        }
      } else if (this.isContextual("opaque")) {
        node.exportKind = "type";

        var _declarationNode = this.startNode();

        this.next();
        return this.flowParseOpaqueType(_declarationNode, false);
      } else if (this.isContextual("interface")) {
        node.exportKind = "type";

        var _declarationNode2 = this.startNode();

        this.next();
        return this.flowParseInterface(_declarationNode2);
      } else {
        return _superClass.prototype.parseExportDeclaration.call(this, node);
      }
    };

    _proto.shouldParseExportStar = function shouldParseExportStar() {
      return _superClass.prototype.shouldParseExportStar.call(this) || this.isContextual("type") && this.lookahead().type === types.star;
    };

    _proto.parseExportStar = function parseExportStar(node) {
      if (this.eatContextual("type")) {
        node.exportKind = "type";
      }

      return _superClass.prototype.parseExportStar.call(this, node);
    };

    _proto.parseExportNamespace = function parseExportNamespace(node) {
      if (node.exportKind === "type") {
        this.unexpected();
      }

      return _superClass.prototype.parseExportNamespace.call(this, node);
    };

    _proto.parseClassId = function parseClassId(node, isStatement, optionalId) {
      _superClass.prototype.parseClassId.call(this, node, isStatement, optionalId);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      }
    };

    _proto.isKeyword = function isKeyword$$1(name) {
      if (this.state.inType && name === "void") {
        return false;
      } else {
        return _superClass.prototype.isKeyword.call(this, name);
      }
    };

    _proto.readToken = function readToken(code) {
      var next = this.input.charCodeAt(this.state.pos + 1);

      if (this.state.inType && (code === 62 || code === 60)) {
        return this.finishOp(types.relational, 1);
      } else if (isIteratorStart(code, next)) {
        this.state.isIterator = true;
        return _superClass.prototype.readWord.call(this);
      } else {
        return _superClass.prototype.readToken.call(this, code);
      }
    };

    _proto.toAssignable = function toAssignable(node, isBinding, contextDescription) {
      if (node.type === "TypeCastExpression") {
        return _superClass.prototype.toAssignable.call(this, this.typeCastToParameter(node), isBinding, contextDescription);
      } else {
        return _superClass.prototype.toAssignable.call(this, node, isBinding, contextDescription);
      }
    };

    _proto.toAssignableList = function toAssignableList(exprList, isBinding, contextDescription) {
      for (var i = 0; i < exprList.length; i++) {
        var expr = exprList[i];

        if (expr && expr.type === "TypeCastExpression") {
          exprList[i] = this.typeCastToParameter(expr);
        }
      }

      return _superClass.prototype.toAssignableList.call(this, exprList, isBinding, contextDescription);
    };

    _proto.toReferencedList = function toReferencedList(exprList, isParenthesizedExpr) {
      for (var i = 0; i < exprList.length; i++) {
        var expr = exprList[i];

        if (expr && expr.type === "TypeCastExpression" && (!expr.extra || !expr.extra.parenthesized) && (exprList.length > 1 || !isParenthesizedExpr)) {
          this.raise(expr.typeAnnotation.start, "The type cast expression is expected to be wrapped with parenthesis");
        }
      }

      return exprList;
    };

    _proto.checkLVal = function checkLVal(expr, isBinding, checkClashes, contextDescription) {
      if (expr.type !== "TypeCastExpression") {
        return _superClass.prototype.checkLVal.call(this, expr, isBinding, checkClashes, contextDescription);
      }
    };

    _proto.parseClassProperty = function parseClassProperty(node) {
      if (this.match(types.colon)) {
        node.typeAnnotation = this.flowParseTypeAnnotation();
      }

      return _superClass.prototype.parseClassProperty.call(this, node);
    };

    _proto.parseClassPrivateProperty = function parseClassPrivateProperty(node) {
      if (this.match(types.colon)) {
        node.typeAnnotation = this.flowParseTypeAnnotation();
      }

      return _superClass.prototype.parseClassPrivateProperty.call(this, node);
    };

    _proto.isClassMethod = function isClassMethod() {
      return this.isRelational("<") || _superClass.prototype.isClassMethod.call(this);
    };

    _proto.isClassProperty = function isClassProperty() {
      return this.match(types.colon) || _superClass.prototype.isClassProperty.call(this);
    };

    _proto.isNonstaticConstructor = function isNonstaticConstructor(method) {
      return !this.match(types.colon) && _superClass.prototype.isNonstaticConstructor.call(this, method);
    };

    _proto.pushClassMethod = function pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor) {
      if (method.variance) {
        this.unexpected(method.variance.start);
      }

      delete method.variance;

      if (this.isRelational("<")) {
        method.typeParameters = this.flowParseTypeParameterDeclaration(false);
      }

      _superClass.prototype.pushClassMethod.call(this, classBody, method, isGenerator, isAsync, isConstructor);
    };

    _proto.pushClassPrivateMethod = function pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
      if (method.variance) {
        this.unexpected(method.variance.start);
      }

      delete method.variance;

      if (this.isRelational("<")) {
        method.typeParameters = this.flowParseTypeParameterDeclaration();
      }

      _superClass.prototype.pushClassPrivateMethod.call(this, classBody, method, isGenerator, isAsync);
    };

    _proto.parseClassSuper = function parseClassSuper(node) {
      _superClass.prototype.parseClassSuper.call(this, node);

      if (node.superClass && this.isRelational("<")) {
        node.superTypeParameters = this.flowParseTypeParameterInstantiation();
      }

      if (this.isContextual("implements")) {
        this.next();
        var implemented = node.implements = [];

        do {
          var _node2 = this.startNode();

          _node2.id = this.flowParseRestrictedIdentifier(true);

          if (this.isRelational("<")) {
            _node2.typeParameters = this.flowParseTypeParameterInstantiation();
          } else {
            _node2.typeParameters = null;
          }

          implemented.push(this.finishNode(_node2, "ClassImplements"));
        } while (this.eat(types.comma));
      }
    };

    _proto.parsePropertyName = function parsePropertyName(node) {
      var variance = this.flowParseVariance();

      var key = _superClass.prototype.parsePropertyName.call(this, node);

      node.variance = variance;
      return key;
    };

    _proto.parseObjPropValue = function parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refShorthandDefaultPos, containsEsc) {
      if (prop.variance) {
        this.unexpected(prop.variance.start);
      }

      delete prop.variance;
      var typeParameters;

      if (this.isRelational("<")) {
        typeParameters = this.flowParseTypeParameterDeclaration(false);
        if (!this.match(types.parenL)) this.unexpected();
      }

      _superClass.prototype.parseObjPropValue.call(this, prop, startPos, startLoc, isGenerator, isAsync, isPattern, refShorthandDefaultPos, containsEsc);

      if (typeParameters) {
        (prop.value || prop).typeParameters = typeParameters;
      }
    };

    _proto.parseAssignableListItemTypes = function parseAssignableListItemTypes(param) {
      if (this.eat(types.question)) {
        if (param.type !== "Identifier") {
          throw this.raise(param.start, "A binding pattern parameter cannot be optional in an implementation signature.");
        }

        param.optional = true;
      }

      if (this.match(types.colon)) {
        param.typeAnnotation = this.flowParseTypeAnnotation();
      }

      this.finishNode(param, param.type);
      return param;
    };

    _proto.parseMaybeDefault = function parseMaybeDefault(startPos, startLoc, left) {
      var node = _superClass.prototype.parseMaybeDefault.call(this, startPos, startLoc, left);

      if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
        this.raise(node.typeAnnotation.start, "Type annotations must come before default assignments, " + "e.g. instead of `age = 25: number` use `age: number = 25`");
      }

      return node;
    };

    _proto.shouldParseDefaultImport = function shouldParseDefaultImport(node) {
      if (!hasTypeImportKind(node)) {
        return _superClass.prototype.shouldParseDefaultImport.call(this, node);
      }

      return isMaybeDefaultImport(this.state);
    };

    _proto.parseImportSpecifierLocal = function parseImportSpecifierLocal(node, specifier, type, contextDescription) {
      specifier.local = hasTypeImportKind(node) ? this.flowParseRestrictedIdentifier(true) : this.parseIdentifier();
      this.checkLVal(specifier.local, true, undefined, contextDescription);
      node.specifiers.push(this.finishNode(specifier, type));
    };

    _proto.parseImportSpecifiers = function parseImportSpecifiers(node) {
      node.importKind = "value";
      var kind = null;

      if (this.match(types._typeof)) {
        kind = "typeof";
      } else if (this.isContextual("type")) {
        kind = "type";
      }

      if (kind) {
        var lh = this.lookahead();

        if (kind === "type" && lh.type === types.star) {
          this.unexpected(lh.start);
        }

        if (isMaybeDefaultImport(lh) || lh.type === types.braceL || lh.type === types.star) {
          this.next();
          node.importKind = kind;
        }
      }

      _superClass.prototype.parseImportSpecifiers.call(this, node);
    };

    _proto.parseImportSpecifier = function parseImportSpecifier(node) {
      var specifier = this.startNode();
      var firstIdentLoc = this.state.start;
      var firstIdent = this.parseIdentifier(true);
      var specifierTypeKind = null;

      if (firstIdent.name === "type") {
        specifierTypeKind = "type";
      } else if (firstIdent.name === "typeof") {
        specifierTypeKind = "typeof";
      }

      var isBinding = false;

      if (this.isContextual("as") && !this.isLookaheadContextual("as")) {
        var as_ident = this.parseIdentifier(true);

        if (specifierTypeKind !== null && !this.match(types.name) && !this.state.type.keyword) {
          specifier.imported = as_ident;
          specifier.importKind = specifierTypeKind;
          specifier.local = as_ident.__clone();
        } else {
          specifier.imported = firstIdent;
          specifier.importKind = null;
          specifier.local = this.parseIdentifier();
        }
      } else if (specifierTypeKind !== null && (this.match(types.name) || this.state.type.keyword)) {
        specifier.imported = this.parseIdentifier(true);
        specifier.importKind = specifierTypeKind;

        if (this.eatContextual("as")) {
          specifier.local = this.parseIdentifier();
        } else {
          isBinding = true;
          specifier.local = specifier.imported.__clone();
        }
      } else {
        isBinding = true;
        specifier.imported = firstIdent;
        specifier.importKind = null;
        specifier.local = specifier.imported.__clone();
      }

      var nodeIsTypeImport = hasTypeImportKind(node);
      var specifierIsTypeImport = hasTypeImportKind(specifier);

      if (nodeIsTypeImport && specifierIsTypeImport) {
        this.raise(firstIdentLoc, "The `type` and `typeof` keywords on named imports can only be used on regular " + "`import` statements. It cannot be used with `import type` or `import typeof` statements");
      }

      if (nodeIsTypeImport || specifierIsTypeImport) {
        this.checkReservedType(specifier.local.name, specifier.local.start);
      }

      if (isBinding && !nodeIsTypeImport && !specifierIsTypeImport) {
        this.checkReservedWord(specifier.local.name, specifier.start, true, true);
      }

      this.checkLVal(specifier.local, true, undefined, "import specifier");
      node.specifiers.push(this.finishNode(specifier, "ImportSpecifier"));
    };

    _proto.parseFunctionParams = function parseFunctionParams(node) {
      var kind = node.kind;

      if (kind !== "get" && kind !== "set" && this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration(false);
      }

      _superClass.prototype.parseFunctionParams.call(this, node);
    };

    _proto.parseVarHead = function parseVarHead(decl) {
      _superClass.prototype.parseVarHead.call(this, decl);

      if (this.match(types.colon)) {
        decl.id.typeAnnotation = this.flowParseTypeAnnotation();
        this.finishNode(decl.id, decl.id.type);
      }
    };

    _proto.parseAsyncArrowFromCallExpression = function parseAsyncArrowFromCallExpression(node, call) {
      if (this.match(types.colon)) {
        var oldNoAnonFunctionType = this.state.noAnonFunctionType;
        this.state.noAnonFunctionType = true;
        node.returnType = this.flowParseTypeAnnotation();
        this.state.noAnonFunctionType = oldNoAnonFunctionType;
      }

      return _superClass.prototype.parseAsyncArrowFromCallExpression.call(this, node, call);
    };

    _proto.shouldParseAsyncArrow = function shouldParseAsyncArrow() {
      return this.match(types.colon) || _superClass.prototype.shouldParseAsyncArrow.call(this);
    };

    _proto.parseMaybeAssign = function parseMaybeAssign(noIn, refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos) {
      var _this6 = this;

      var jsxError = null;

      if (this.hasPlugin("jsx") && (this.match(types.jsxTagStart) || this.isRelational("<"))) {
        var state = this.state.clone();

        try {
          return _superClass.prototype.parseMaybeAssign.call(this, noIn, refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos);
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;
            var cLength = this.state.context.length;

            if (this.state.context[cLength - 1] === types$1.j_oTag) {
              this.state.context.length -= 2;
            }

            jsxError = err;
          } else {
            throw err;
          }
        }
      }

      if (jsxError != null || this.isRelational("<")) {
        var arrowExpression;
        var typeParameters;

        try {
          typeParameters = this.flowParseTypeParameterDeclaration();
          arrowExpression = this.forwardNoArrowParamsConversionAt(typeParameters, function () {
            return _superClass.prototype.parseMaybeAssign.call(_this6, noIn, refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos);
          });
          arrowExpression.typeParameters = typeParameters;
          this.resetStartLocationFromNode(arrowExpression, typeParameters);
        } catch (err) {
          throw jsxError || err;
        }

        if (arrowExpression.type === "ArrowFunctionExpression") {
          return arrowExpression;
        } else if (jsxError != null) {
          throw jsxError;
        } else {
          this.raise(typeParameters.start, "Expected an arrow function after this type parameter declaration");
        }
      }

      return _superClass.prototype.parseMaybeAssign.call(this, noIn, refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos);
    };

    _proto.parseArrow = function parseArrow(node) {
      if (this.match(types.colon)) {
        var state = this.state.clone();

        try {
          var oldNoAnonFunctionType = this.state.noAnonFunctionType;
          this.state.noAnonFunctionType = true;
          var typeNode = this.startNode();

          var _this$flowParseTypeAn3 = this.flowParseTypeAndPredicateInitialiser();

          typeNode.typeAnnotation = _this$flowParseTypeAn3[0];
          node.predicate = _this$flowParseTypeAn3[1];
          this.state.noAnonFunctionType = oldNoAnonFunctionType;
          if (this.canInsertSemicolon()) this.unexpected();
          if (!this.match(types.arrow)) this.unexpected();
          node.returnType = typeNode.typeAnnotation ? this.finishNode(typeNode, "TypeAnnotation") : null;
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;
          } else {
            throw err;
          }
        }
      }

      return _superClass.prototype.parseArrow.call(this, node);
    };

    _proto.shouldParseArrow = function shouldParseArrow() {
      return this.match(types.colon) || _superClass.prototype.shouldParseArrow.call(this);
    };

    _proto.setArrowFunctionParameters = function setArrowFunctionParameters(node, params) {
      if (this.state.noArrowParamsConversionAt.indexOf(node.start) !== -1) {
        node.params = params;
      } else {
        _superClass.prototype.setArrowFunctionParameters.call(this, node, params);
      }
    };

    _proto.checkFunctionNameAndParams = function checkFunctionNameAndParams(node, isArrowFunction) {
      if (isArrowFunction && this.state.noArrowParamsConversionAt.indexOf(node.start) !== -1) {
        return;
      }

      return _superClass.prototype.checkFunctionNameAndParams.call(this, node, isArrowFunction);
    };

    _proto.parseParenAndDistinguishExpression = function parseParenAndDistinguishExpression(canBeArrow) {
      return _superClass.prototype.parseParenAndDistinguishExpression.call(this, canBeArrow && this.state.noArrowAt.indexOf(this.state.start) === -1);
    };

    _proto.parseSubscripts = function parseSubscripts(base, startPos, startLoc, noCalls) {
      if (base.type === "Identifier" && base.name === "async" && this.state.noArrowAt.indexOf(startPos) !== -1) {
        this.next();
        var node = this.startNodeAt(startPos, startLoc);
        node.callee = base;
        node.arguments = this.parseCallExpressionArguments(types.parenR, false);
        base = this.finishNode(node, "CallExpression");
      } else if (base.type === "Identifier" && base.name === "async" && this.isRelational("<")) {
        var state = this.state.clone();
        var error;

        try {
          var _node3 = this.parseAsyncArrowWithTypeParameters(startPos, startLoc);

          if (_node3) return _node3;
        } catch (e) {
          error = e;
        }

        this.state = state;

        try {
          return _superClass.prototype.parseSubscripts.call(this, base, startPos, startLoc, noCalls);
        } catch (e) {
          throw error || e;
        }
      }

      return _superClass.prototype.parseSubscripts.call(this, base, startPos, startLoc, noCalls);
    };

    _proto.parseSubscript = function parseSubscript(base, startPos, startLoc, noCalls, subscriptState) {
      if (this.match(types.questionDot) && this.isLookaheadRelational("<")) {
        this.expectPlugin("optionalChaining");
        subscriptState.optionalChainMember = true;

        if (noCalls) {
          subscriptState.stop = true;
          return base;
        }

        this.next();
        var node = this.startNodeAt(startPos, startLoc);
        node.callee = base;
        node.typeArguments = this.flowParseTypeParameterInstantiation();
        this.expect(types.parenL);
        node.arguments = this.parseCallExpressionArguments(types.parenR, false);
        node.optional = true;
        return this.finishNode(node, "OptionalCallExpression");
      } else if (!noCalls && this.shouldParseTypes() && this.isRelational("<")) {
        var _node4 = this.startNodeAt(startPos, startLoc);

        _node4.callee = base;
        var state = this.state.clone();

        try {
          _node4.typeArguments = this.flowParseTypeParameterInstantiationCallOrNew();
          this.expect(types.parenL);
          _node4.arguments = this.parseCallExpressionArguments(types.parenR, false);

          if (subscriptState.optionalChainMember) {
            _node4.optional = false;
            return this.finishNode(_node4, "OptionalCallExpression");
          }

          return this.finishNode(_node4, "CallExpression");
        } catch (e) {
          if (e instanceof SyntaxError) {
            this.state = state;
          } else {
            throw e;
          }
        }
      }

      return _superClass.prototype.parseSubscript.call(this, base, startPos, startLoc, noCalls, subscriptState);
    };

    _proto.parseNewArguments = function parseNewArguments(node) {
      var targs = null;

      if (this.shouldParseTypes() && this.isRelational("<")) {
        var state = this.state.clone();

        try {
          targs = this.flowParseTypeParameterInstantiationCallOrNew();
        } catch (e) {
          if (e instanceof SyntaxError) {
            this.state = state;
          } else {
            throw e;
          }
        }
      }

      node.typeArguments = targs;

      _superClass.prototype.parseNewArguments.call(this, node);
    };

    _proto.parseAsyncArrowWithTypeParameters = function parseAsyncArrowWithTypeParameters(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);
      this.parseFunctionParams(node);
      if (!this.parseArrow(node)) return;
      return this.parseArrowExpression(node, undefined, true);
    };

    _proto.readToken_mult_modulo = function readToken_mult_modulo(code) {
      var next = this.input.charCodeAt(this.state.pos + 1);

      if (code === 42 && next === 47 && this.state.hasFlowComment) {
        this.state.hasFlowComment = false;
        this.state.pos += 2;
        this.nextToken();
        return;
      }

      _superClass.prototype.readToken_mult_modulo.call(this, code);
    };

    _proto.parseTopLevel = function parseTopLevel(file, program) {
      var fileNode = _superClass.prototype.parseTopLevel.call(this, file, program);

      if (this.state.hasFlowComment) {
        this.unexpected(null, "Unterminated flow-comment");
      }

      return fileNode;
    };

    _proto.skipBlockComment = function skipBlockComment() {
      if (this.hasPlugin("flow") && this.hasPlugin("flowComments") && this.skipFlowComment()) {
        if (this.state.hasFlowComment) {
          this.unexpected(null, "Cannot have a flow comment inside another flow comment");
        }

        this.hasFlowCommentCompletion();
        this.state.pos += this.skipFlowComment();
        this.state.hasFlowComment = true;
        return;
      }

      if (this.hasPlugin("flow") && this.state.hasFlowComment) {
        var end = this.input.indexOf("*-/", this.state.pos += 2);
        if (end === -1) this.raise(this.state.pos - 2, "Unterminated comment");
        this.state.pos = end + 3;
        return;
      }

      _superClass.prototype.skipBlockComment.call(this);
    };

    _proto.skipFlowComment = function skipFlowComment() {
      var pos = this.state.pos;
      var shiftToFirstNonWhiteSpace = 2;

      while ([32, 9].includes(this.input.charCodeAt(pos + shiftToFirstNonWhiteSpace))) {
        shiftToFirstNonWhiteSpace++;
      }

      var ch2 = this.input.charCodeAt(shiftToFirstNonWhiteSpace + pos);
      var ch3 = this.input.charCodeAt(shiftToFirstNonWhiteSpace + pos + 1);

      if (ch2 === 58 && ch3 === 58) {
        return shiftToFirstNonWhiteSpace + 2;
      }

      if (this.input.slice(shiftToFirstNonWhiteSpace + pos, shiftToFirstNonWhiteSpace + pos + 12) === "flow-include") {
        return shiftToFirstNonWhiteSpace + 12;
      }

      if (ch2 === 58 && ch3 !== 58) {
        return shiftToFirstNonWhiteSpace;
      }

      return false;
    };

    _proto.hasFlowCommentCompletion = function hasFlowCommentCompletion() {
      var end = this.input.indexOf("*/", this.state.pos);

      if (end === -1) {
        this.raise(this.state.pos, "Unterminated comment");
      }
    };

    return _class;
  }(superClass);
});

var entities = {
  quot: "\"",
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: "\xA0",
  iexcl: "\xA1",
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
  ordf: "\xAA",
  laquo: "\xAB",
  not: "\xAC",
  shy: "\xAD",
  reg: "\xAE",
  macr: "\xAF",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  acute: "\xB4",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  cedil: "\xB8",
  sup1: "\xB9",
  ordm: "\xBA",
  raquo: "\xBB",
  frac14: "\xBC",
  frac12: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  Agrave: "\xC0",
  Aacute: "\xC1",
  Acirc: "\xC2",
  Atilde: "\xC3",
  Auml: "\xC4",
  Aring: "\xC5",
  AElig: "\xC6",
  Ccedil: "\xC7",
  Egrave: "\xC8",
  Eacute: "\xC9",
  Ecirc: "\xCA",
  Euml: "\xCB",
  Igrave: "\xCC",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Iuml: "\xCF",
  ETH: "\xD0",
  Ntilde: "\xD1",
  Ograve: "\xD2",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Otilde: "\xD5",
  Ouml: "\xD6",
  times: "\xD7",
  Oslash: "\xD8",
  Ugrave: "\xD9",
  Uacute: "\xDA",
  Ucirc: "\xDB",
  Uuml: "\xDC",
  Yacute: "\xDD",
  THORN: "\xDE",
  szlig: "\xDF",
  agrave: "\xE0",
  aacute: "\xE1",
  acirc: "\xE2",
  atilde: "\xE3",
  auml: "\xE4",
  aring: "\xE5",
  aelig: "\xE6",
  ccedil: "\xE7",
  egrave: "\xE8",
  eacute: "\xE9",
  ecirc: "\xEA",
  euml: "\xEB",
  igrave: "\xEC",
  iacute: "\xED",
  icirc: "\xEE",
  iuml: "\xEF",
  eth: "\xF0",
  ntilde: "\xF1",
  ograve: "\xF2",
  oacute: "\xF3",
  ocirc: "\xF4",
  otilde: "\xF5",
  ouml: "\xF6",
  divide: "\xF7",
  oslash: "\xF8",
  ugrave: "\xF9",
  uacute: "\xFA",
  ucirc: "\xFB",
  uuml: "\xFC",
  yacute: "\xFD",
  thorn: "\xFE",
  yuml: "\xFF",
  OElig: "\u0152",
  oelig: "\u0153",
  Scaron: "\u0160",
  scaron: "\u0161",
  Yuml: "\u0178",
  fnof: "\u0192",
  circ: "\u02C6",
  tilde: "\u02DC",
  Alpha: "\u0391",
  Beta: "\u0392",
  Gamma: "\u0393",
  Delta: "\u0394",
  Epsilon: "\u0395",
  Zeta: "\u0396",
  Eta: "\u0397",
  Theta: "\u0398",
  Iota: "\u0399",
  Kappa: "\u039A",
  Lambda: "\u039B",
  Mu: "\u039C",
  Nu: "\u039D",
  Xi: "\u039E",
  Omicron: "\u039F",
  Pi: "\u03A0",
  Rho: "\u03A1",
  Sigma: "\u03A3",
  Tau: "\u03A4",
  Upsilon: "\u03A5",
  Phi: "\u03A6",
  Chi: "\u03A7",
  Psi: "\u03A8",
  Omega: "\u03A9",
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  omicron: "\u03BF",
  pi: "\u03C0",
  rho: "\u03C1",
  sigmaf: "\u03C2",
  sigma: "\u03C3",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  thetasym: "\u03D1",
  upsih: "\u03D2",
  piv: "\u03D6",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  zwnj: "\u200C",
  zwj: "\u200D",
  lrm: "\u200E",
  rlm: "\u200F",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201A",
  ldquo: "\u201C",
  rdquo: "\u201D",
  bdquo: "\u201E",
  dagger: "\u2020",
  Dagger: "\u2021",
  bull: "\u2022",
  hellip: "\u2026",
  permil: "\u2030",
  prime: "\u2032",
  Prime: "\u2033",
  lsaquo: "\u2039",
  rsaquo: "\u203A",
  oline: "\u203E",
  frasl: "\u2044",
  euro: "\u20AC",
  image: "\u2111",
  weierp: "\u2118",
  real: "\u211C",
  trade: "\u2122",
  alefsym: "\u2135",
  larr: "\u2190",
  uarr: "\u2191",
  rarr: "\u2192",
  darr: "\u2193",
  harr: "\u2194",
  crarr: "\u21B5",
  lArr: "\u21D0",
  uArr: "\u21D1",
  rArr: "\u21D2",
  dArr: "\u21D3",
  hArr: "\u21D4",
  forall: "\u2200",
  part: "\u2202",
  exist: "\u2203",
  empty: "\u2205",
  nabla: "\u2207",
  isin: "\u2208",
  notin: "\u2209",
  ni: "\u220B",
  prod: "\u220F",
  sum: "\u2211",
  minus: "\u2212",
  lowast: "\u2217",
  radic: "\u221A",
  prop: "\u221D",
  infin: "\u221E",
  ang: "\u2220",
  and: "\u2227",
  or: "\u2228",
  cap: "\u2229",
  cup: "\u222A",
  int: "\u222B",
  there4: "\u2234",
  sim: "\u223C",
  cong: "\u2245",
  asymp: "\u2248",
  ne: "\u2260",
  equiv: "\u2261",
  le: "\u2264",
  ge: "\u2265",
  sub: "\u2282",
  sup: "\u2283",
  nsub: "\u2284",
  sube: "\u2286",
  supe: "\u2287",
  oplus: "\u2295",
  otimes: "\u2297",
  perp: "\u22A5",
  sdot: "\u22C5",
  lceil: "\u2308",
  rceil: "\u2309",
  lfloor: "\u230A",
  rfloor: "\u230B",
  lang: "\u2329",
  rang: "\u232A",
  loz: "\u25CA",
  spades: "\u2660",
  clubs: "\u2663",
  hearts: "\u2665",
  diams: "\u2666"
};

var HEX_NUMBER = /^[\da-fA-F]+$/;
var DECIMAL_NUMBER = /^\d+$/;
types$1.j_oTag = new TokContext("<tag", false);
types$1.j_cTag = new TokContext("</tag", false);
types$1.j_expr = new TokContext("<tag>...</tag>", true, true);
types.jsxName = new TokenType("jsxName");
types.jsxText = new TokenType("jsxText", {
  beforeExpr: true
});
types.jsxTagStart = new TokenType("jsxTagStart", {
  startsExpr: true
});
types.jsxTagEnd = new TokenType("jsxTagEnd");

types.jsxTagStart.updateContext = function () {
  this.state.context.push(types$1.j_expr);
  this.state.context.push(types$1.j_oTag);
  this.state.exprAllowed = false;
};

types.jsxTagEnd.updateContext = function (prevType) {
  var out = this.state.context.pop();

  if (out === types$1.j_oTag && prevType === types.slash || out === types$1.j_cTag) {
    this.state.context.pop();
    this.state.exprAllowed = this.curContext() === types$1.j_expr;
  } else {
    this.state.exprAllowed = true;
  }
};

function isFragment(object) {
  return object ? object.type === "JSXOpeningFragment" || object.type === "JSXClosingFragment" : false;
}

function getQualifiedJSXName(object) {
  if (object.type === "JSXIdentifier") {
    return object.name;
  }

  if (object.type === "JSXNamespacedName") {
    return object.namespace.name + ":" + object.name.name;
  }

  if (object.type === "JSXMemberExpression") {
    return getQualifiedJSXName(object.object) + "." + getQualifiedJSXName(object.property);
  }

  throw new Error("Node had unexpected type: " + object.type);
}

var jsx = (function (superClass) {
  return function (_superClass) {
    _inheritsLoose(_class, _superClass);

    function _class() {
      return _superClass.apply(this, arguments) || this;
    }

    var _proto = _class.prototype;

    _proto.jsxReadToken = function jsxReadToken() {
      var out = "";
      var chunkStart = this.state.pos;

      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(this.state.start, "Unterminated JSX contents");
        }

        var ch = this.input.charCodeAt(this.state.pos);

        switch (ch) {
          case 60:
          case 123:
            if (this.state.pos === this.state.start) {
              if (ch === 60 && this.state.exprAllowed) {
                ++this.state.pos;
                return this.finishToken(types.jsxTagStart);
              }

              return this.getTokenFromCode(ch);
            }

            out += this.input.slice(chunkStart, this.state.pos);
            return this.finishToken(types.jsxText, out);

          case 38:
            out += this.input.slice(chunkStart, this.state.pos);
            out += this.jsxReadEntity();
            chunkStart = this.state.pos;
            break;

          default:
            if (isNewLine(ch)) {
              out += this.input.slice(chunkStart, this.state.pos);
              out += this.jsxReadNewLine(true);
              chunkStart = this.state.pos;
            } else {
              ++this.state.pos;
            }

        }
      }
    };

    _proto.jsxReadNewLine = function jsxReadNewLine(normalizeCRLF) {
      var ch = this.input.charCodeAt(this.state.pos);
      var out;
      ++this.state.pos;

      if (ch === 13 && this.input.charCodeAt(this.state.pos) === 10) {
        ++this.state.pos;
        out = normalizeCRLF ? "\n" : "\r\n";
      } else {
        out = String.fromCharCode(ch);
      }

      ++this.state.curLine;
      this.state.lineStart = this.state.pos;
      return out;
    };

    _proto.jsxReadString = function jsxReadString(quote) {
      var out = "";
      var chunkStart = ++this.state.pos;

      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(this.state.start, "Unterminated string constant");
        }

        var ch = this.input.charCodeAt(this.state.pos);
        if (ch === quote) break;

        if (ch === 38) {
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadEntity();
          chunkStart = this.state.pos;
        } else if (isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadNewLine(false);
          chunkStart = this.state.pos;
        } else {
          ++this.state.pos;
        }
      }

      out += this.input.slice(chunkStart, this.state.pos++);
      return this.finishToken(types.string, out);
    };

    _proto.jsxReadEntity = function jsxReadEntity() {
      var str = "";
      var count = 0;
      var entity;
      var ch = this.input[this.state.pos];
      var startPos = ++this.state.pos;

      while (this.state.pos < this.input.length && count++ < 10) {
        ch = this.input[this.state.pos++];

        if (ch === ";") {
          if (str[0] === "#") {
            if (str[1] === "x") {
              str = str.substr(2);

              if (HEX_NUMBER.test(str)) {
                entity = String.fromCodePoint(parseInt(str, 16));
              }
            } else {
              str = str.substr(1);

              if (DECIMAL_NUMBER.test(str)) {
                entity = String.fromCodePoint(parseInt(str, 10));
              }
            }
          } else {
            entity = entities[str];
          }

          break;
        }

        str += ch;
      }

      if (!entity) {
        this.state.pos = startPos;
        return "&";
      }

      return entity;
    };

    _proto.jsxReadWord = function jsxReadWord() {
      var ch;
      var start = this.state.pos;

      do {
        ch = this.input.charCodeAt(++this.state.pos);
      } while (isIdentifierChar(ch) || ch === 45);

      return this.finishToken(types.jsxName, this.input.slice(start, this.state.pos));
    };

    _proto.jsxParseIdentifier = function jsxParseIdentifier() {
      var node = this.startNode();

      if (this.match(types.jsxName)) {
        node.name = this.state.value;
      } else if (this.state.type.keyword) {
        node.name = this.state.type.keyword;
      } else {
        this.unexpected();
      }

      this.next();
      return this.finishNode(node, "JSXIdentifier");
    };

    _proto.jsxParseNamespacedName = function jsxParseNamespacedName() {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;
      var name = this.jsxParseIdentifier();
      if (!this.eat(types.colon)) return name;
      var node = this.startNodeAt(startPos, startLoc);
      node.namespace = name;
      node.name = this.jsxParseIdentifier();
      return this.finishNode(node, "JSXNamespacedName");
    };

    _proto.jsxParseElementName = function jsxParseElementName() {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;
      var node = this.jsxParseNamespacedName();

      while (this.eat(types.dot)) {
        var newNode = this.startNodeAt(startPos, startLoc);
        newNode.object = node;
        newNode.property = this.jsxParseIdentifier();
        node = this.finishNode(newNode, "JSXMemberExpression");
      }

      return node;
    };

    _proto.jsxParseAttributeValue = function jsxParseAttributeValue() {
      var node;

      switch (this.state.type) {
        case types.braceL:
          node = this.jsxParseExpressionContainer();

          if (node.expression.type === "JSXEmptyExpression") {
            throw this.raise(node.start, "JSX attributes must only be assigned a non-empty expression");
          } else {
            return node;
          }

        case types.jsxTagStart:
        case types.string:
          return this.parseExprAtom();

        default:
          throw this.raise(this.state.start, "JSX value should be either an expression or a quoted JSX text");
      }
    };

    _proto.jsxParseEmptyExpression = function jsxParseEmptyExpression() {
      var node = this.startNodeAt(this.state.lastTokEnd, this.state.lastTokEndLoc);
      return this.finishNodeAt(node, "JSXEmptyExpression", this.state.start, this.state.startLoc);
    };

    _proto.jsxParseSpreadChild = function jsxParseSpreadChild() {
      var node = this.startNode();
      this.expect(types.braceL);
      this.expect(types.ellipsis);
      node.expression = this.parseExpression();
      this.expect(types.braceR);
      return this.finishNode(node, "JSXSpreadChild");
    };

    _proto.jsxParseExpressionContainer = function jsxParseExpressionContainer() {
      var node = this.startNode();
      this.next();

      if (this.match(types.braceR)) {
        node.expression = this.jsxParseEmptyExpression();
      } else {
        node.expression = this.parseExpression();
      }

      this.expect(types.braceR);
      return this.finishNode(node, "JSXExpressionContainer");
    };

    _proto.jsxParseAttribute = function jsxParseAttribute() {
      var node = this.startNode();

      if (this.eat(types.braceL)) {
        this.expect(types.ellipsis);
        node.argument = this.parseMaybeAssign();
        this.expect(types.braceR);
        return this.finishNode(node, "JSXSpreadAttribute");
      }

      node.name = this.jsxParseNamespacedName();
      node.value = this.eat(types.eq) ? this.jsxParseAttributeValue() : null;
      return this.finishNode(node, "JSXAttribute");
    };

    _proto.jsxParseOpeningElementAt = function jsxParseOpeningElementAt(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);

      if (this.match(types.jsxTagEnd)) {
        this.expect(types.jsxTagEnd);
        return this.finishNode(node, "JSXOpeningFragment");
      }

      node.name = this.jsxParseElementName();
      return this.jsxParseOpeningElementAfterName(node);
    };

    _proto.jsxParseOpeningElementAfterName = function jsxParseOpeningElementAfterName(node) {
      var attributes = [];

      while (!this.match(types.slash) && !this.match(types.jsxTagEnd)) {
        attributes.push(this.jsxParseAttribute());
      }

      node.attributes = attributes;
      node.selfClosing = this.eat(types.slash);
      this.expect(types.jsxTagEnd);
      return this.finishNode(node, "JSXOpeningElement");
    };

    _proto.jsxParseClosingElementAt = function jsxParseClosingElementAt(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);

      if (this.match(types.jsxTagEnd)) {
        this.expect(types.jsxTagEnd);
        return this.finishNode(node, "JSXClosingFragment");
      }

      node.name = this.jsxParseElementName();
      this.expect(types.jsxTagEnd);
      return this.finishNode(node, "JSXClosingElement");
    };

    _proto.jsxParseElementAt = function jsxParseElementAt(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);
      var children = [];
      var openingElement = this.jsxParseOpeningElementAt(startPos, startLoc);
      var closingElement = null;

      if (!openingElement.selfClosing) {
        contents: for (;;) {
          switch (this.state.type) {
            case types.jsxTagStart:
              startPos = this.state.start;
              startLoc = this.state.startLoc;
              this.next();

              if (this.eat(types.slash)) {
                closingElement = this.jsxParseClosingElementAt(startPos, startLoc);
                break contents;
              }

              children.push(this.jsxParseElementAt(startPos, startLoc));
              break;

            case types.jsxText:
              children.push(this.parseExprAtom());
              break;

            case types.braceL:
              if (this.lookahead().type === types.ellipsis) {
                children.push(this.jsxParseSpreadChild());
              } else {
                children.push(this.jsxParseExpressionContainer());
              }

              break;

            default:
              throw this.unexpected();
          }
        }

        if (isFragment(openingElement) && !isFragment(closingElement)) {
          this.raise(closingElement.start, "Expected corresponding JSX closing tag for <>");
        } else if (!isFragment(openingElement) && isFragment(closingElement)) {
          this.raise(closingElement.start, "Expected corresponding JSX closing tag for <" + getQualifiedJSXName(openingElement.name) + ">");
        } else if (!isFragment(openingElement) && !isFragment(closingElement)) {
          if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
            this.raise(closingElement.start, "Expected corresponding JSX closing tag for <" + getQualifiedJSXName(openingElement.name) + ">");
          }
        }
      }

      if (isFragment(openingElement)) {
        node.openingFragment = openingElement;
        node.closingFragment = closingElement;
      } else {
        node.openingElement = openingElement;
        node.closingElement = closingElement;
      }

      node.children = children;

      if (this.match(types.relational) && this.state.value === "<") {
        this.raise(this.state.start, "Adjacent JSX elements must be wrapped in an enclosing tag. " + "Did you want a JSX fragment <>...</>?");
      }

      return isFragment(openingElement) ? this.finishNode(node, "JSXFragment") : this.finishNode(node, "JSXElement");
    };

    _proto.jsxParseElement = function jsxParseElement() {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;
      this.next();
      return this.jsxParseElementAt(startPos, startLoc);
    };

    _proto.parseExprAtom = function parseExprAtom(refShortHandDefaultPos) {
      if (this.match(types.jsxText)) {
        return this.parseLiteral(this.state.value, "JSXText");
      } else if (this.match(types.jsxTagStart)) {
        return this.jsxParseElement();
      } else if (this.isRelational("<") && this.state.input.charCodeAt(this.state.pos) !== 33) {
        this.finishToken(types.jsxTagStart);
        return this.jsxParseElement();
      } else {
        return _superClass.prototype.parseExprAtom.call(this, refShortHandDefaultPos);
      }
    };

    _proto.readToken = function readToken(code) {
      if (this.state.inPropertyName) return _superClass.prototype.readToken.call(this, code);
      var context = this.curContext();

      if (context === types$1.j_expr) {
        return this.jsxReadToken();
      }

      if (context === types$1.j_oTag || context === types$1.j_cTag) {
        if (isIdentifierStart(code)) {
          return this.jsxReadWord();
        }

        if (code === 62) {
          ++this.state.pos;
          return this.finishToken(types.jsxTagEnd);
        }

        if ((code === 34 || code === 39) && context === types$1.j_oTag) {
          return this.jsxReadString(code);
        }
      }

      if (code === 60 && this.state.exprAllowed && this.state.input.charCodeAt(this.state.pos + 1) !== 33) {
        ++this.state.pos;
        return this.finishToken(types.jsxTagStart);
      }

      return _superClass.prototype.readToken.call(this, code);
    };

    _proto.updateContext = function updateContext(prevType) {
      if (this.match(types.braceL)) {
        var curContext = this.curContext();

        if (curContext === types$1.j_oTag) {
          this.state.context.push(types$1.braceExpression);
        } else if (curContext === types$1.j_expr) {
          this.state.context.push(types$1.templateQuasi);
        } else {
          _superClass.prototype.updateContext.call(this, prevType);
        }

        this.state.exprAllowed = true;
      } else if (this.match(types.slash) && prevType === types.jsxTagStart) {
        this.state.context.length -= 2;
        this.state.context.push(types$1.j_cTag);
        this.state.exprAllowed = false;
      } else {
        return _superClass.prototype.updateContext.call(this, prevType);
      }
    };

    return _class;
  }(superClass);
});

var defaultOptions = {
  sourceType: "script",
  sourceFilename: undefined,
  startLine: 1,
  allowAwaitOutsideFunction: false,
  allowReturnOutsideFunction: false,
  allowImportExportEverywhere: false,
  allowSuperOutsideMethod: false,
  plugins: [],
  strictMode: null,
  ranges: false,
  tokens: false
};
function getOptions(opts) {
  var options = {};

  for (var key in defaultOptions) {
    options[key] = opts && opts[key] != null ? opts[key] : defaultOptions[key];
  }

  return options;
}

var Position = function Position(line, col) {
  this.line = line;
  this.column = col;
};
var SourceLocation = function SourceLocation(start, end) {
  this.start = start;
  this.end = end;
};
function getLineInfo(input, offset) {
  var line = 1;
  var lineStart = 0;
  var match;
  lineBreakG.lastIndex = 0;

  while ((match = lineBreakG.exec(input)) && match.index < offset) {
    line++;
    lineStart = lineBreakG.lastIndex;
  }

  return new Position(line, offset - lineStart);
}

var BaseParser = function () {
  function BaseParser() {
    this.sawUnambiguousESM = false;
  }

  var _proto = BaseParser.prototype;

  _proto.isReservedWord = function isReservedWord(word) {
    if (word === "await") {
      return this.inModule;
    } else {
      return reservedWords[6](word);
    }
  };

  _proto.hasPlugin = function hasPlugin(name) {
    return Object.hasOwnProperty.call(this.plugins, name);
  };

  _proto.getPluginOption = function getPluginOption(plugin, name) {
    if (this.hasPlugin(plugin)) return this.plugins[plugin][name];
  };

  return BaseParser;
}();

function last(stack) {
  return stack[stack.length - 1];
}

var CommentsParser = function (_BaseParser) {
  _inheritsLoose(CommentsParser, _BaseParser);

  function CommentsParser() {
    return _BaseParser.apply(this, arguments) || this;
  }

  var _proto = CommentsParser.prototype;

  _proto.addComment = function addComment(comment) {
    if (this.filename) comment.loc.filename = this.filename;
    this.state.trailingComments.push(comment);
    this.state.leadingComments.push(comment);
  };

  _proto.processComment = function processComment(node) {
    if (node.type === "Program" && node.body.length > 0) return;
    var stack = this.state.commentStack;
    var firstChild, lastChild, trailingComments, i, j;

    if (this.state.trailingComments.length > 0) {
      if (this.state.trailingComments[0].start >= node.end) {
        trailingComments = this.state.trailingComments;
        this.state.trailingComments = [];
      } else {
        this.state.trailingComments.length = 0;
      }
    } else if (stack.length > 0) {
      var lastInStack = last(stack);

      if (lastInStack.trailingComments && lastInStack.trailingComments[0].start >= node.end) {
        trailingComments = lastInStack.trailingComments;
        delete lastInStack.trailingComments;
      }
    }

    if (stack.length > 0 && last(stack).start >= node.start) {
      firstChild = stack.pop();
    }

    while (stack.length > 0 && last(stack).start >= node.start) {
      lastChild = stack.pop();
    }

    if (!lastChild && firstChild) lastChild = firstChild;

    if (firstChild && this.state.leadingComments.length > 0) {
      var lastComment = last(this.state.leadingComments);

      if (firstChild.type === "ObjectProperty") {
        if (lastComment.start >= node.start) {
          if (this.state.commentPreviousNode) {
            for (j = 0; j < this.state.leadingComments.length; j++) {
              if (this.state.leadingComments[j].end < this.state.commentPreviousNode.end) {
                this.state.leadingComments.splice(j, 1);
                j--;
              }
            }

            if (this.state.leadingComments.length > 0) {
              firstChild.trailingComments = this.state.leadingComments;
              this.state.leadingComments = [];
            }
          }
        }
      } else if (node.type === "CallExpression" && node.arguments && node.arguments.length) {
        var lastArg = last(node.arguments);

        if (lastArg && lastComment.start >= lastArg.start && lastComment.end <= node.end) {
          if (this.state.commentPreviousNode) {
            for (j = 0; j < this.state.leadingComments.length; j++) {
              if (this.state.leadingComments[j].end < this.state.commentPreviousNode.end) {
                this.state.leadingComments.splice(j, 1);
                j--;
              }
            }

            if (this.state.leadingComments.length > 0) {
              lastArg.trailingComments = this.state.leadingComments;
              this.state.leadingComments = [];
            }
          }
        }
      }
    }

    if (lastChild) {
      if (lastChild.leadingComments) {
        if (lastChild !== node && lastChild.leadingComments.length > 0 && last(lastChild.leadingComments).end <= node.start) {
          node.leadingComments = lastChild.leadingComments;
          delete lastChild.leadingComments;
        } else {
          for (i = lastChild.leadingComments.length - 2; i >= 0; --i) {
            if (lastChild.leadingComments[i].end <= node.start) {
              node.leadingComments = lastChild.leadingComments.splice(0, i + 1);
              break;
            }
          }
        }
      }
    } else if (this.state.leadingComments.length > 0) {
      if (last(this.state.leadingComments).end <= node.start) {
        if (this.state.commentPreviousNode) {
          for (j = 0; j < this.state.leadingComments.length; j++) {
            if (this.state.leadingComments[j].end < this.state.commentPreviousNode.end) {
              this.state.leadingComments.splice(j, 1);
              j--;
            }
          }
        }

        if (this.state.leadingComments.length > 0) {
          node.leadingComments = this.state.leadingComments;
          this.state.leadingComments = [];
        }
      } else {
        for (i = 0; i < this.state.leadingComments.length; i++) {
          if (this.state.leadingComments[i].end > node.start) {
            break;
          }
        }

        var leadingComments = this.state.leadingComments.slice(0, i);

        if (leadingComments.length) {
          node.leadingComments = leadingComments;
        }

        trailingComments = this.state.leadingComments.slice(i);

        if (trailingComments.length === 0) {
          trailingComments = null;
        }
      }
    }

    this.state.commentPreviousNode = node;

    if (trailingComments) {
      if (trailingComments.length && trailingComments[0].start >= node.start && last(trailingComments).end <= node.end) {
        node.innerComments = trailingComments;
      } else {
        node.trailingComments = trailingComments;
      }
    }

    stack.push(node);
  };

  return CommentsParser;
}(BaseParser);

var LocationParser = function (_CommentsParser) {
  _inheritsLoose(LocationParser, _CommentsParser);

  function LocationParser() {
    return _CommentsParser.apply(this, arguments) || this;
  }

  var _proto = LocationParser.prototype;

  _proto.raise = function raise(pos, message, _temp) {
    var _ref = _temp === void 0 ? {} : _temp,
        missingPluginNames = _ref.missingPluginNames,
        code = _ref.code;

    var loc = getLineInfo(this.input, pos);
    message += " (" + loc.line + ":" + loc.column + ")";
    var err = new SyntaxError(message);
    err.pos = pos;
    err.loc = loc;

    if (missingPluginNames) {
      err.missingPlugin = missingPluginNames;
    }

    if (code !== undefined) {
      err.code = code;
    }

    throw err;
  };

  return LocationParser;
}(CommentsParser);

var State = function () {
  function State() {}

  var _proto = State.prototype;

  _proto.init = function init(options, input) {
    this.strict = options.strictMode === false ? false : options.sourceType === "module";
    this.input = input;
    this.potentialArrowAt = -1;
    this.noArrowAt = [];
    this.noArrowParamsConversionAt = [];
    this.inMethod = false;
    this.inFunction = false;
    this.inParameters = false;
    this.maybeInArrowParameters = false;
    this.inGenerator = false;
    this.inAsync = false;
    this.inPipeline = false;
    this.inPropertyName = false;
    this.inType = false;
    this.inClassProperty = false;
    this.noAnonFunctionType = false;
    this.hasFlowComment = false;
    this.isIterator = false;
    this.topicContext = {
      maxNumOfResolvableTopics: 0,
      maxTopicIndex: null
    };
    this.classLevel = 0;
    this.labels = [];
    this.decoratorStack = [[]];
    this.yieldOrAwaitInPossibleArrowParameters = null;
    this.tokens = [];
    this.comments = [];
    this.trailingComments = [];
    this.leadingComments = [];
    this.commentStack = [];
    this.commentPreviousNode = null;
    this.pos = this.lineStart = 0;
    this.curLine = options.startLine;
    this.type = types.eof;
    this.value = null;
    this.start = this.end = this.pos;
    this.startLoc = this.endLoc = this.curPosition();
    this.lastTokEndLoc = this.lastTokStartLoc = null;
    this.lastTokStart = this.lastTokEnd = this.pos;
    this.context = [types$1.braceStatement];
    this.exprAllowed = true;
    this.containsEsc = this.containsOctal = false;
    this.octalPosition = null;
    this.invalidTemplateEscapePosition = null;
    this.exportedIdentifiers = [];
  };

  _proto.curPosition = function curPosition() {
    return new Position(this.curLine, this.pos - this.lineStart);
  };

  _proto.clone = function clone(skipArrays) {
    var _this = this;

    var state = new State();
    Object.keys(this).forEach(function (key) {
      var val = _this[key];

      if ((!skipArrays || key === "context") && Array.isArray(val)) {
        val = val.slice();
      }

      state[key] = val;
    });
    return state;
  };

  return State;
}();

var _isDigit = function isDigit(code) {
  return code >= 48 && code <= 57;
};

var VALID_REGEX_FLAGS = "gmsiyu";
var forbiddenNumericSeparatorSiblings = {
  decBinOct: [46, 66, 69, 79, 95, 98, 101, 111],
  hex: [46, 88, 95, 120]
};
var allowedNumericSeparatorSiblings = {};
allowedNumericSeparatorSiblings.bin = [48, 49];
allowedNumericSeparatorSiblings.oct = allowedNumericSeparatorSiblings.bin.concat([50, 51, 52, 53, 54, 55]);
allowedNumericSeparatorSiblings.dec = allowedNumericSeparatorSiblings.oct.concat([56, 57]);
allowedNumericSeparatorSiblings.hex = allowedNumericSeparatorSiblings.dec.concat([65, 66, 67, 68, 69, 70, 97, 98, 99, 100, 101, 102]);
var Token = function Token(state) {
  this.type = state.type;
  this.value = state.value;
  this.start = state.start;
  this.end = state.end;
  this.loc = new SourceLocation(state.startLoc, state.endLoc);
};

var Tokenizer = function (_LocationParser) {
  _inheritsLoose(Tokenizer, _LocationParser);

  function Tokenizer(options, input) {
    var _this;

    _this = _LocationParser.call(this) || this;
    _this.state = new State();

    _this.state.init(options, input);

    _this.isLookahead = false;
    return _this;
  }

  var _proto = Tokenizer.prototype;

  _proto.next = function next() {
    if (this.options.tokens && !this.isLookahead) {
      this.state.tokens.push(new Token(this.state));
    }

    this.state.lastTokEnd = this.state.end;
    this.state.lastTokStart = this.state.start;
    this.state.lastTokEndLoc = this.state.endLoc;
    this.state.lastTokStartLoc = this.state.startLoc;
    this.nextToken();
  };

  _proto.eat = function eat(type) {
    if (this.match(type)) {
      this.next();
      return true;
    } else {
      return false;
    }
  };

  _proto.match = function match(type) {
    return this.state.type === type;
  };

  _proto.isKeyword = function isKeyword$$1(word) {
    return isKeyword(word);
  };

  _proto.lookahead = function lookahead() {
    var old = this.state;
    this.state = old.clone(true);
    this.isLookahead = true;
    this.next();
    this.isLookahead = false;
    var curr = this.state;
    this.state = old;
    return curr;
  };

  _proto.setStrict = function setStrict(strict) {
    this.state.strict = strict;
    if (!this.match(types.num) && !this.match(types.string)) return;
    this.state.pos = this.state.start;

    while (this.state.pos < this.state.lineStart) {
      this.state.lineStart = this.input.lastIndexOf("\n", this.state.lineStart - 2) + 1;
      --this.state.curLine;
    }

    this.nextToken();
  };

  _proto.curContext = function curContext() {
    return this.state.context[this.state.context.length - 1];
  };

  _proto.nextToken = function nextToken() {
    var curContext = this.curContext();
    if (!curContext || !curContext.preserveSpace) this.skipSpace();
    this.state.containsOctal = false;
    this.state.octalPosition = null;
    this.state.start = this.state.pos;
    this.state.startLoc = this.state.curPosition();

    if (this.state.pos >= this.input.length) {
      this.finishToken(types.eof);
      return;
    }

    if (curContext.override) {
      curContext.override(this);
    } else {
      this.readToken(this.input.codePointAt(this.state.pos));
    }
  };

  _proto.readToken = function readToken(code) {
    if (isIdentifierStart(code) || code === 92) {
      this.readWord();
    } else {
      this.getTokenFromCode(code);
    }
  };

  _proto.pushComment = function pushComment(block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "CommentBlock" : "CommentLine",
      value: text,
      start: start,
      end: end,
      loc: new SourceLocation(startLoc, endLoc)
    };

    if (!this.isLookahead) {
      if (this.options.tokens) this.state.tokens.push(comment);
      this.state.comments.push(comment);
      this.addComment(comment);
    }
  };

  _proto.skipBlockComment = function skipBlockComment() {
    var startLoc = this.state.curPosition();
    var start = this.state.pos;
    var end = this.input.indexOf("*/", this.state.pos += 2);
    if (end === -1) this.raise(this.state.pos - 2, "Unterminated comment");
    this.state.pos = end + 2;
    lineBreakG.lastIndex = start;
    var match;

    while ((match = lineBreakG.exec(this.input)) && match.index < this.state.pos) {
      ++this.state.curLine;
      this.state.lineStart = match.index + match[0].length;
    }

    this.pushComment(true, this.input.slice(start + 2, end), start, this.state.pos, startLoc, this.state.curPosition());
  };

  _proto.skipLineComment = function skipLineComment(startSkip) {
    var start = this.state.pos;
    var startLoc = this.state.curPosition();
    var ch = this.input.charCodeAt(this.state.pos += startSkip);

    if (this.state.pos < this.input.length) {
      while (ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233 && ++this.state.pos < this.input.length) {
        ch = this.input.charCodeAt(this.state.pos);
      }
    }

    this.pushComment(false, this.input.slice(start + startSkip, this.state.pos), start, this.state.pos, startLoc, this.state.curPosition());
  };

  _proto.skipSpace = function skipSpace() {
    loop: while (this.state.pos < this.input.length) {
      var ch = this.input.charCodeAt(this.state.pos);

      switch (ch) {
        case 13:
          if (this.input.charCodeAt(this.state.pos + 1) === 10) {
            ++this.state.pos;
          }

        case 10:
        case 8232:
        case 8233:
          ++this.state.pos;
          ++this.state.curLine;
          this.state.lineStart = this.state.pos;
          break;

        case 47:
          switch (this.input.charCodeAt(this.state.pos + 1)) {
            case 42:
              this.skipBlockComment();
              break;

            case 47:
              this.skipLineComment(2);
              break;

            default:
              break loop;
          }

          break;

        default:
          if (isWhitespace(ch)) {
            ++this.state.pos;
          } else {
            break loop;
          }

      }
    }
  };

  _proto.finishToken = function finishToken(type, val) {
    this.state.end = this.state.pos;
    this.state.endLoc = this.state.curPosition();
    var prevType = this.state.type;
    this.state.type = type;
    this.state.value = val;
    this.updateContext(prevType);
  };

  _proto.readToken_numberSign = function readToken_numberSign() {
    if (this.state.pos === 0 && this.readToken_interpreter()) {
      return;
    }

    var nextPos = this.state.pos + 1;
    var next = this.input.charCodeAt(nextPos);

    if (next >= 48 && next <= 57) {
      this.raise(this.state.pos, "Unexpected digit after hash token");
    }

    if ((this.hasPlugin("classPrivateProperties") || this.hasPlugin("classPrivateMethods")) && this.state.classLevel > 0) {
      ++this.state.pos;
      this.finishToken(types.hash);
      return;
    } else if (this.getPluginOption("pipelineOperator", "proposal") === "smart") {
      this.finishOp(types.hash, 1);
    } else {
      this.raise(this.state.pos, "Unexpected character '#'");
    }
  };

  _proto.readToken_dot = function readToken_dot() {
    var next = this.input.charCodeAt(this.state.pos + 1);

    if (next >= 48 && next <= 57) {
      this.readNumber(true);
      return;
    }

    var next2 = this.input.charCodeAt(this.state.pos + 2);

    if (next === 46 && next2 === 46) {
      this.state.pos += 3;
      this.finishToken(types.ellipsis);
    } else {
      ++this.state.pos;
      this.finishToken(types.dot);
    }
  };

  _proto.readToken_slash = function readToken_slash() {
    if (this.state.exprAllowed && !this.state.inType) {
      ++this.state.pos;
      this.readRegexp();
      return;
    }

    var next = this.input.charCodeAt(this.state.pos + 1);

    if (next === 61) {
      this.finishOp(types.assign, 2);
    } else {
      this.finishOp(types.slash, 1);
    }
  };

  _proto.readToken_interpreter = function readToken_interpreter() {
    if (this.state.pos !== 0 || this.state.input.length < 2) return false;
    var start = this.state.pos;
    this.state.pos += 1;
    var ch = this.input.charCodeAt(this.state.pos);
    if (ch !== 33) return false;

    while (ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233 && ++this.state.pos < this.input.length) {
      ch = this.input.charCodeAt(this.state.pos);
    }

    var value = this.input.slice(start + 2, this.state.pos);
    this.finishToken(types.interpreterDirective, value);
    return true;
  };

  _proto.readToken_mult_modulo = function readToken_mult_modulo(code) {
    var type = code === 42 ? types.star : types.modulo;
    var width = 1;
    var next = this.input.charCodeAt(this.state.pos + 1);
    var exprAllowed = this.state.exprAllowed;

    if (code === 42 && next === 42) {
      width++;
      next = this.input.charCodeAt(this.state.pos + 2);
      type = types.exponent;
    }

    if (next === 61 && !exprAllowed) {
      width++;
      type = types.assign;
    }

    this.finishOp(type, width);
  };

  _proto.readToken_pipe_amp = function readToken_pipe_amp(code) {
    var next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      if (this.input.charCodeAt(this.state.pos + 2) === 61) {
        this.finishOp(types.assign, 3);
      } else {
        this.finishOp(code === 124 ? types.logicalOR : types.logicalAND, 2);
      }

      return;
    }

    if (code === 124) {
      if (next === 62) {
        this.finishOp(types.pipeline, 2);
        return;
      } else if (next === 125 && this.hasPlugin("flow")) {
        this.finishOp(types.braceBarR, 2);
        return;
      }
    }

    if (next === 61) {
      this.finishOp(types.assign, 2);
      return;
    }

    this.finishOp(code === 124 ? types.bitwiseOR : types.bitwiseAND, 1);
  };

  _proto.readToken_caret = function readToken_caret() {
    var next = this.input.charCodeAt(this.state.pos + 1);

    if (next === 61) {
      this.finishOp(types.assign, 2);
    } else {
      this.finishOp(types.bitwiseXOR, 1);
    }
  };

  _proto.readToken_plus_min = function readToken_plus_min(code) {
    var next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      if (next === 45 && !this.inModule && this.input.charCodeAt(this.state.pos + 2) === 62 && lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.pos))) {
        this.skipLineComment(3);
        this.skipSpace();
        this.nextToken();
        return;
      }

      this.finishOp(types.incDec, 2);
      return;
    }

    if (next === 61) {
      this.finishOp(types.assign, 2);
    } else {
      this.finishOp(types.plusMin, 1);
    }
  };

  _proto.readToken_lt_gt = function readToken_lt_gt(code) {
    var next = this.input.charCodeAt(this.state.pos + 1);
    var size = 1;

    if (next === code) {
      size = code === 62 && this.input.charCodeAt(this.state.pos + 2) === 62 ? 3 : 2;

      if (this.input.charCodeAt(this.state.pos + size) === 61) {
        this.finishOp(types.assign, size + 1);
        return;
      }

      this.finishOp(types.bitShift, size);
      return;
    }

    if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.state.pos + 2) === 45 && this.input.charCodeAt(this.state.pos + 3) === 45) {
      this.skipLineComment(4);
      this.skipSpace();
      this.nextToken();
      return;
    }

    if (next === 61) {
      size = 2;
    }

    this.finishOp(types.relational, size);
  };

  _proto.readToken_eq_excl = function readToken_eq_excl(code) {
    var next = this.input.charCodeAt(this.state.pos + 1);

    if (next === 61) {
      this.finishOp(types.equality, this.input.charCodeAt(this.state.pos + 2) === 61 ? 3 : 2);
      return;
    }

    if (code === 61 && next === 62) {
      this.state.pos += 2;
      this.finishToken(types.arrow);
      return;
    }

    this.finishOp(code === 61 ? types.eq : types.bang, 1);
  };

  _proto.readToken_question = function readToken_question() {
    var next = this.input.charCodeAt(this.state.pos + 1);
    var next2 = this.input.charCodeAt(this.state.pos + 2);

    if (next === 63 && !this.state.inType) {
      if (next2 === 61) {
        this.finishOp(types.assign, 3);
      } else {
        this.finishOp(types.nullishCoalescing, 2);
      }
    } else if (next === 46 && !(next2 >= 48 && next2 <= 57)) {
      this.state.pos += 2;
      this.finishToken(types.questionDot);
    } else {
      ++this.state.pos;
      this.finishToken(types.question);
    }
  };

  _proto.getTokenFromCode = function getTokenFromCode(code) {
    switch (code) {
      case 35:
        this.readToken_numberSign();
        return;

      case 46:
        this.readToken_dot();
        return;

      case 40:
        ++this.state.pos;
        this.finishToken(types.parenL);
        return;

      case 41:
        ++this.state.pos;
        this.finishToken(types.parenR);
        return;

      case 59:
        ++this.state.pos;
        this.finishToken(types.semi);
        return;

      case 44:
        ++this.state.pos;
        this.finishToken(types.comma);
        return;

      case 91:
        ++this.state.pos;
        this.finishToken(types.bracketL);
        return;

      case 93:
        ++this.state.pos;
        this.finishToken(types.bracketR);
        return;

      case 123:
        if (this.hasPlugin("flow") && this.input.charCodeAt(this.state.pos + 1) === 124) {
          this.finishOp(types.braceBarL, 2);
        } else {
          ++this.state.pos;
          this.finishToken(types.braceL);
        }

        return;

      case 125:
        ++this.state.pos;
        this.finishToken(types.braceR);
        return;

      case 58:
        if (this.hasPlugin("functionBind") && this.input.charCodeAt(this.state.pos + 1) === 58) {
          this.finishOp(types.doubleColon, 2);
        } else {
          ++this.state.pos;
          this.finishToken(types.colon);
        }

        return;

      case 63:
        this.readToken_question();
        return;

      case 64:
        ++this.state.pos;
        this.finishToken(types.at);
        return;

      case 96:
        ++this.state.pos;
        this.finishToken(types.backQuote);
        return;

      case 48:
        {
          var next = this.input.charCodeAt(this.state.pos + 1);

          if (next === 120 || next === 88) {
            this.readRadixNumber(16);
            return;
          }

          if (next === 111 || next === 79) {
            this.readRadixNumber(8);
            return;
          }

          if (next === 98 || next === 66) {
            this.readRadixNumber(2);
            return;
          }
        }

      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        this.readNumber(false);
        return;

      case 34:
      case 39:
        this.readString(code);
        return;

      case 47:
        this.readToken_slash();
        return;

      case 37:
      case 42:
        this.readToken_mult_modulo(code);
        return;

      case 124:
      case 38:
        this.readToken_pipe_amp(code);
        return;

      case 94:
        this.readToken_caret();
        return;

      case 43:
      case 45:
        this.readToken_plus_min(code);
        return;

      case 60:
      case 62:
        this.readToken_lt_gt(code);
        return;

      case 61:
      case 33:
        this.readToken_eq_excl(code);
        return;

      case 126:
        this.finishOp(types.tilde, 1);
        return;
    }

    this.raise(this.state.pos, "Unexpected character '" + String.fromCodePoint(code) + "'");
  };

  _proto.finishOp = function finishOp(type, size) {
    var str = this.input.slice(this.state.pos, this.state.pos + size);
    this.state.pos += size;
    this.finishToken(type, str);
  };

  _proto.readRegexp = function readRegexp() {
    var start = this.state.pos;
    var escaped, inClass;

    for (;;) {
      if (this.state.pos >= this.input.length) {
        this.raise(start, "Unterminated regular expression");
      }

      var ch = this.input.charAt(this.state.pos);

      if (lineBreak.test(ch)) {
        this.raise(start, "Unterminated regular expression");
      }

      if (escaped) {
        escaped = false;
      } else {
        if (ch === "[") {
          inClass = true;
        } else if (ch === "]" && inClass) {
          inClass = false;
        } else if (ch === "/" && !inClass) {
          break;
        }

        escaped = ch === "\\";
      }

      ++this.state.pos;
    }

    var content = this.input.slice(start, this.state.pos);
    ++this.state.pos;
    var mods = "";

    while (this.state.pos < this.input.length) {
      var char = this.input[this.state.pos];
      var charCode = this.input.codePointAt(this.state.pos);

      if (VALID_REGEX_FLAGS.indexOf(char) > -1) {
        if (mods.indexOf(char) > -1) {
          this.raise(this.state.pos + 1, "Duplicate regular expression flag");
        }

        ++this.state.pos;
        mods += char;
      } else if (isIdentifierChar(charCode) || charCode === 92) {
        this.raise(this.state.pos + 1, "Invalid regular expression flag");
      } else {
        break;
      }
    }

    this.finishToken(types.regexp, {
      pattern: content,
      flags: mods
    });
  };

  _proto.readInt = function readInt(radix, len) {
    var start = this.state.pos;
    var forbiddenSiblings = radix === 16 ? forbiddenNumericSeparatorSiblings.hex : forbiddenNumericSeparatorSiblings.decBinOct;
    var allowedSiblings = radix === 16 ? allowedNumericSeparatorSiblings.hex : radix === 10 ? allowedNumericSeparatorSiblings.dec : radix === 8 ? allowedNumericSeparatorSiblings.oct : allowedNumericSeparatorSiblings.bin;
    var total = 0;

    for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
      var code = this.input.charCodeAt(this.state.pos);
      var val = void 0;

      if (this.hasPlugin("numericSeparator")) {
        var prev = this.input.charCodeAt(this.state.pos - 1);
        var next = this.input.charCodeAt(this.state.pos + 1);

        if (code === 95) {
          if (allowedSiblings.indexOf(next) === -1) {
            this.raise(this.state.pos, "Invalid or unexpected token");
          }

          if (forbiddenSiblings.indexOf(prev) > -1 || forbiddenSiblings.indexOf(next) > -1 || Number.isNaN(next)) {
            this.raise(this.state.pos, "Invalid or unexpected token");
          }

          ++this.state.pos;
          continue;
        }
      }

      if (code >= 97) {
        val = code - 97 + 10;
      } else if (code >= 65) {
        val = code - 65 + 10;
      } else if (_isDigit(code)) {
        val = code - 48;
      } else {
        val = Infinity;
      }

      if (val >= radix) break;
      ++this.state.pos;
      total = total * radix + val;
    }

    if (this.state.pos === start || len != null && this.state.pos - start !== len) {
      return null;
    }

    return total;
  };

  _proto.readRadixNumber = function readRadixNumber(radix) {
    var start = this.state.pos;
    var isBigInt = false;
    this.state.pos += 2;
    var val = this.readInt(radix);

    if (val == null) {
      this.raise(this.state.start + 2, "Expected number in radix " + radix);
    }

    if (this.hasPlugin("bigInt")) {
      if (this.input.charCodeAt(this.state.pos) === 110) {
        ++this.state.pos;
        isBigInt = true;
      }
    }

    if (isIdentifierStart(this.input.codePointAt(this.state.pos))) {
      this.raise(this.state.pos, "Identifier directly after number");
    }

    if (isBigInt) {
      var str = this.input.slice(start, this.state.pos).replace(/[_n]/g, "");
      this.finishToken(types.bigint, str);
      return;
    }

    this.finishToken(types.num, val);
  };

  _proto.readNumber = function readNumber(startsWithDot) {
    var start = this.state.pos;
    var isFloat = false;
    var isBigInt = false;

    if (!startsWithDot && this.readInt(10) === null) {
      this.raise(start, "Invalid number");
    }

    var octal = this.state.pos - start >= 2 && this.input.charCodeAt(start) === 48;

    if (octal) {
      if (this.state.strict) {
        this.raise(start, "Legacy octal literals are not allowed in strict mode");
      }

      if (/[89]/.test(this.input.slice(start, this.state.pos))) {
        octal = false;
      }
    }

    var next = this.input.charCodeAt(this.state.pos);

    if (next === 46 && !octal) {
      ++this.state.pos;
      this.readInt(10);
      isFloat = true;
      next = this.input.charCodeAt(this.state.pos);
    }

    if ((next === 69 || next === 101) && !octal) {
      next = this.input.charCodeAt(++this.state.pos);

      if (next === 43 || next === 45) {
        ++this.state.pos;
      }

      if (this.readInt(10) === null) this.raise(start, "Invalid number");
      isFloat = true;
      next = this.input.charCodeAt(this.state.pos);
    }

    if (this.hasPlugin("bigInt")) {
      if (next === 110) {
        if (isFloat || octal) this.raise(start, "Invalid BigIntLiteral");
        ++this.state.pos;
        isBigInt = true;
      }
    }

    if (isIdentifierStart(this.input.codePointAt(this.state.pos))) {
      this.raise(this.state.pos, "Identifier directly after number");
    }

    var str = this.input.slice(start, this.state.pos).replace(/[_n]/g, "");

    if (isBigInt) {
      this.finishToken(types.bigint, str);
      return;
    }

    var val = octal ? parseInt(str, 8) : parseFloat(str);
    this.finishToken(types.num, val);
  };

  _proto.readCodePoint = function readCodePoint(throwOnInvalid) {
    var ch = this.input.charCodeAt(this.state.pos);
    var code;

    if (ch === 123) {
      var codePos = ++this.state.pos;
      code = this.readHexChar(this.input.indexOf("}", this.state.pos) - this.state.pos, throwOnInvalid);
      ++this.state.pos;

      if (code === null) {
        --this.state.invalidTemplateEscapePosition;
      } else if (code > 0x10ffff) {
        if (throwOnInvalid) {
          this.raise(codePos, "Code point out of bounds");
        } else {
          this.state.invalidTemplateEscapePosition = codePos - 2;
          return null;
        }
      }
    } else {
      code = this.readHexChar(4, throwOnInvalid);
    }

    return code;
  };

  _proto.readString = function readString(quote) {
    var out = "",
        chunkStart = ++this.state.pos;

    for (;;) {
      if (this.state.pos >= this.input.length) {
        this.raise(this.state.start, "Unterminated string constant");
      }

      var ch = this.input.charCodeAt(this.state.pos);
      if (ch === quote) break;

      if (ch === 92) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.readEscapedChar(false);
        chunkStart = this.state.pos;
      } else if (ch === 8232 || ch === 8233) {
        ++this.state.pos;
        ++this.state.curLine;
      } else if (isNewLine(ch)) {
        this.raise(this.state.start, "Unterminated string constant");
      } else {
        ++this.state.pos;
      }
    }

    out += this.input.slice(chunkStart, this.state.pos++);
    this.finishToken(types.string, out);
  };

  _proto.readTmplToken = function readTmplToken() {
    var out = "",
        chunkStart = this.state.pos,
        containsInvalid = false;

    for (;;) {
      if (this.state.pos >= this.input.length) {
        this.raise(this.state.start, "Unterminated template");
      }

      var ch = this.input.charCodeAt(this.state.pos);

      if (ch === 96 || ch === 36 && this.input.charCodeAt(this.state.pos + 1) === 123) {
        if (this.state.pos === this.state.start && this.match(types.template)) {
          if (ch === 36) {
            this.state.pos += 2;
            this.finishToken(types.dollarBraceL);
            return;
          } else {
            ++this.state.pos;
            this.finishToken(types.backQuote);
            return;
          }
        }

        out += this.input.slice(chunkStart, this.state.pos);
        this.finishToken(types.template, containsInvalid ? null : out);
        return;
      }

      if (ch === 92) {
        out += this.input.slice(chunkStart, this.state.pos);
        var escaped = this.readEscapedChar(true);

        if (escaped === null) {
          containsInvalid = true;
        } else {
          out += escaped;
        }

        chunkStart = this.state.pos;
      } else if (isNewLine(ch)) {
        out += this.input.slice(chunkStart, this.state.pos);
        ++this.state.pos;

        switch (ch) {
          case 13:
            if (this.input.charCodeAt(this.state.pos) === 10) {
              ++this.state.pos;
            }

          case 10:
            out += "\n";
            break;

          default:
            out += String.fromCharCode(ch);
            break;
        }

        ++this.state.curLine;
        this.state.lineStart = this.state.pos;
        chunkStart = this.state.pos;
      } else {
        ++this.state.pos;
      }
    }
  };

  _proto.readEscapedChar = function readEscapedChar(inTemplate) {
    var throwOnInvalid = !inTemplate;
    var ch = this.input.charCodeAt(++this.state.pos);
    ++this.state.pos;

    switch (ch) {
      case 110:
        return "\n";

      case 114:
        return "\r";

      case 120:
        {
          var code = this.readHexChar(2, throwOnInvalid);
          return code === null ? null : String.fromCharCode(code);
        }

      case 117:
        {
          var _code = this.readCodePoint(throwOnInvalid);

          return _code === null ? null : String.fromCodePoint(_code);
        }

      case 116:
        return "\t";

      case 98:
        return "\b";

      case 118:
        return "\x0B";

      case 102:
        return "\f";

      case 13:
        if (this.input.charCodeAt(this.state.pos) === 10) {
          ++this.state.pos;
        }

      case 10:
        this.state.lineStart = this.state.pos;
        ++this.state.curLine;
        return "";

      default:
        if (ch >= 48 && ch <= 55) {
          var codePos = this.state.pos - 1;
          var octalStr = this.input.substr(this.state.pos - 1, 3).match(/^[0-7]+/)[0];
          var octal = parseInt(octalStr, 8);

          if (octal > 255) {
            octalStr = octalStr.slice(0, -1);
            octal = parseInt(octalStr, 8);
          }

          if (octal > 0) {
            if (inTemplate) {
              this.state.invalidTemplateEscapePosition = codePos;
              return null;
            } else if (this.state.strict) {
              this.raise(codePos, "Octal literal in strict mode");
            } else if (!this.state.containsOctal) {
              this.state.containsOctal = true;
              this.state.octalPosition = codePos;
            }
          }

          this.state.pos += octalStr.length - 1;
          return String.fromCharCode(octal);
        }

        return String.fromCharCode(ch);
    }
  };

  _proto.readHexChar = function readHexChar(len, throwOnInvalid) {
    var codePos = this.state.pos;
    var n = this.readInt(16, len);

    if (n === null) {
      if (throwOnInvalid) {
        this.raise(codePos, "Bad character escape sequence");
      } else {
        this.state.pos = codePos - 1;
        this.state.invalidTemplateEscapePosition = codePos - 1;
      }
    }

    return n;
  };

  _proto.readWord1 = function readWord1() {
    this.state.containsEsc = false;
    var word = "",
        first = true,
        chunkStart = this.state.pos;

    while (this.state.pos < this.input.length) {
      var ch = this.input.codePointAt(this.state.pos);

      if (isIdentifierChar(ch)) {
        this.state.pos += ch <= 0xffff ? 1 : 2;
      } else if (this.state.isIterator && ch === 64) {
        this.state.pos += 1;
      } else if (ch === 92) {
        this.state.containsEsc = true;
        word += this.input.slice(chunkStart, this.state.pos);
        var escStart = this.state.pos;

        if (this.input.charCodeAt(++this.state.pos) !== 117) {
          this.raise(this.state.pos, "Expecting Unicode escape sequence \\uXXXX");
        }

        ++this.state.pos;
        var esc = this.readCodePoint(true);

        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, true)) {
          this.raise(escStart, "Invalid Unicode escape");
        }

        word += String.fromCodePoint(esc);
        chunkStart = this.state.pos;
      } else {
        break;
      }

      first = false;
    }

    return word + this.input.slice(chunkStart, this.state.pos);
  };

  _proto.isIterator = function isIterator(word) {
    return word === "@@iterator" || word === "@@asyncIterator";
  };

  _proto.readWord = function readWord() {
    var word = this.readWord1();
    var type = types.name;

    if (this.isKeyword(word)) {
      if (this.state.containsEsc) {
        this.raise(this.state.pos, "Escape sequence in keyword " + word);
      }

      type = keywords[word];
    }

    if (this.state.isIterator && (!this.isIterator(word) || !this.state.inType)) {
      this.raise(this.state.pos, "Invalid identifier " + word);
    }

    this.finishToken(type, word);
  };

  _proto.braceIsBlock = function braceIsBlock(prevType) {
    var parent = this.curContext();

    if (parent === types$1.functionExpression || parent === types$1.functionStatement) {
      return true;
    }

    if (prevType === types.colon && (parent === types$1.braceStatement || parent === types$1.braceExpression)) {
      return !parent.isExpr;
    }

    if (prevType === types._return || prevType === types._yield || prevType === types.name && this.state.exprAllowed) {
      return lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start));
    }

    if (prevType === types._else || prevType === types.semi || prevType === types.eof || prevType === types.parenR || prevType === types.arrow) {
      return true;
    }

    if (prevType === types.braceL) {
      return parent === types$1.braceStatement;
    }

    if (prevType === types._var || prevType === types._let || prevType === types._const) {
      return false;
    }

    if (prevType === types.relational) {
      return true;
    }

    return !this.state.exprAllowed;
  };

  _proto.updateContext = function updateContext(prevType) {
    var type = this.state.type;
    var update;

    if (type.keyword && (prevType === types.dot || prevType === types.questionDot)) {
      this.state.exprAllowed = false;
    } else if (update = type.updateContext) {
      update.call(this, prevType);
    } else {
      this.state.exprAllowed = type.beforeExpr;
    }
  };

  return Tokenizer;
}(LocationParser);

var UtilParser = function (_Tokenizer) {
  _inheritsLoose(UtilParser, _Tokenizer);

  function UtilParser() {
    return _Tokenizer.apply(this, arguments) || this;
  }

  var _proto = UtilParser.prototype;

  _proto.addExtra = function addExtra(node, key, val) {
    if (!node) return;
    var extra = node.extra = node.extra || {};
    extra[key] = val;
  };

  _proto.isRelational = function isRelational(op) {
    return this.match(types.relational) && this.state.value === op;
  };

  _proto.isLookaheadRelational = function isLookaheadRelational(op) {
    var l = this.lookahead();
    return l.type == types.relational && l.value == op;
  };

  _proto.expectRelational = function expectRelational(op) {
    if (this.isRelational(op)) {
      this.next();
    } else {
      this.unexpected(null, types.relational);
    }
  };

  _proto.eatRelational = function eatRelational(op) {
    if (this.isRelational(op)) {
      this.next();
      return true;
    }

    return false;
  };

  _proto.isContextual = function isContextual(name) {
    return this.match(types.name) && this.state.value === name && !this.state.containsEsc;
  };

  _proto.isLookaheadContextual = function isLookaheadContextual(name) {
    var l = this.lookahead();
    return l.type === types.name && l.value === name;
  };

  _proto.eatContextual = function eatContextual(name) {
    return this.isContextual(name) && this.eat(types.name);
  };

  _proto.expectContextual = function expectContextual(name, message) {
    if (!this.eatContextual(name)) this.unexpected(null, message);
  };

  _proto.canInsertSemicolon = function canInsertSemicolon() {
    return this.match(types.eof) || this.match(types.braceR) || this.hasPrecedingLineBreak();
  };

  _proto.hasPrecedingLineBreak = function hasPrecedingLineBreak() {
    return lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start));
  };

  _proto.isLineTerminator = function isLineTerminator() {
    return this.eat(types.semi) || this.canInsertSemicolon();
  };

  _proto.semicolon = function semicolon() {
    if (!this.isLineTerminator()) this.unexpected(null, types.semi);
  };

  _proto.expect = function expect(type, pos) {
    this.eat(type) || this.unexpected(pos, type);
  };

  _proto.unexpected = function unexpected(pos, messageOrType) {
    if (messageOrType === void 0) {
      messageOrType = "Unexpected token";
    }

    if (typeof messageOrType !== "string") {
      messageOrType = "Unexpected token, expected \"" + messageOrType.label + "\"";
    }

    throw this.raise(pos != null ? pos : this.state.start, messageOrType);
  };

  _proto.expectPlugin = function expectPlugin(name, pos) {
    if (!this.hasPlugin(name)) {
      throw this.raise(pos != null ? pos : this.state.start, "This experimental syntax requires enabling the parser plugin: '" + name + "'", {
        missingPluginNames: [name]
      });
    }

    return true;
  };

  _proto.expectOnePlugin = function expectOnePlugin(names, pos) {
    var _this = this;

    if (!names.some(function (n) {
      return _this.hasPlugin(n);
    })) {
      throw this.raise(pos != null ? pos : this.state.start, "This experimental syntax requires enabling one of the following parser plugin(s): '" + names.join(", ") + "'", {
        missingPluginNames: names
      });
    }
  };

  return UtilParser;
}(Tokenizer);

var commentKeys = ["leadingComments", "trailingComments", "innerComments"];

var Node = function () {
  function Node(parser, pos, loc) {
    this.type = "";
    this.start = pos;
    this.end = 0;
    this.loc = new SourceLocation(loc);
    if (parser && parser.options.ranges) this.range = [pos, 0];
    if (parser && parser.filename) this.loc.filename = parser.filename;
  }

  var _proto = Node.prototype;

  _proto.__clone = function __clone() {
    var _this = this;

    var node2 = new Node();
    Object.keys(this).forEach(function (key) {
      if (commentKeys.indexOf(key) < 0) {
        node2[key] = _this[key];
      }
    });
    return node2;
  };

  return Node;
}();

var NodeUtils = function (_UtilParser) {
  _inheritsLoose(NodeUtils, _UtilParser);

  function NodeUtils() {
    return _UtilParser.apply(this, arguments) || this;
  }

  var _proto2 = NodeUtils.prototype;

  _proto2.startNode = function startNode() {
    return new Node(this, this.state.start, this.state.startLoc);
  };

  _proto2.startNodeAt = function startNodeAt(pos, loc) {
    return new Node(this, pos, loc);
  };

  _proto2.startNodeAtNode = function startNodeAtNode(type) {
    return this.startNodeAt(type.start, type.loc.start);
  };

  _proto2.finishNode = function finishNode(node, type) {
    return this.finishNodeAt(node, type, this.state.lastTokEnd, this.state.lastTokEndLoc);
  };

  _proto2.finishNodeAt = function finishNodeAt(node, type, pos, loc) {
    node.type = type;
    node.end = pos;
    node.loc.end = loc;
    if (this.options.ranges) node.range[1] = pos;
    this.processComment(node);
    return node;
  };

  _proto2.resetStartLocationFromNode = function resetStartLocationFromNode(node, locationNode) {
    node.start = locationNode.start;
    node.loc.start = locationNode.loc.start;
    if (this.options.ranges) node.range[0] = locationNode.range[0];
  };

  return NodeUtils;
}(UtilParser);

var LValParser = function (_NodeUtils) {
  _inheritsLoose(LValParser, _NodeUtils);

  function LValParser() {
    return _NodeUtils.apply(this, arguments) || this;
  }

  var _proto = LValParser.prototype;

  _proto.toAssignable = function toAssignable(node, isBinding, contextDescription) {
    if (node) {
      switch (node.type) {
        case "Identifier":
        case "ObjectPattern":
        case "ArrayPattern":
        case "AssignmentPattern":
          break;

        case "ObjectExpression":
          node.type = "ObjectPattern";

          for (var index = 0; index < node.properties.length; index++) {
            var prop = node.properties[index];
            var isLast = index === node.properties.length - 1;
            this.toAssignableObjectExpressionProp(prop, isBinding, isLast);
          }

          break;

        case "ObjectProperty":
          this.toAssignable(node.value, isBinding, contextDescription);
          break;

        case "SpreadElement":
          {
            this.checkToRestConversion(node);
            node.type = "RestElement";
            var arg = node.argument;
            this.toAssignable(arg, isBinding, contextDescription);
            break;
          }

        case "ArrayExpression":
          node.type = "ArrayPattern";
          this.toAssignableList(node.elements, isBinding, contextDescription);
          break;

        case "AssignmentExpression":
          if (node.operator === "=") {
            node.type = "AssignmentPattern";
            delete node.operator;
          } else {
            this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
          }

          break;

        case "MemberExpression":
          if (!isBinding) break;

        default:
          {
            var message = "Invalid left-hand side" + (contextDescription ? " in " + contextDescription : "expression");
            this.raise(node.start, message);
          }
      }
    }

    return node;
  };

  _proto.toAssignableObjectExpressionProp = function toAssignableObjectExpressionProp(prop, isBinding, isLast) {
    if (prop.type === "ObjectMethod") {
      var error = prop.kind === "get" || prop.kind === "set" ? "Object pattern can't contain getter or setter" : "Object pattern can't contain methods";
      this.raise(prop.key.start, error);
    } else if (prop.type === "SpreadElement" && !isLast) {
      this.raise(prop.start, "The rest element has to be the last element when destructuring");
    } else {
      this.toAssignable(prop, isBinding, "object destructuring pattern");
    }
  };

  _proto.toAssignableList = function toAssignableList(exprList, isBinding, contextDescription) {
    var end = exprList.length;

    if (end) {
      var last = exprList[end - 1];

      if (last && last.type === "RestElement") {
        --end;
      } else if (last && last.type === "SpreadElement") {
        last.type = "RestElement";
        var arg = last.argument;
        this.toAssignable(arg, isBinding, contextDescription);

        if (["Identifier", "MemberExpression", "ArrayPattern", "ObjectPattern"].indexOf(arg.type) === -1) {
          this.unexpected(arg.start);
        }

        --end;
      }
    }

    for (var i = 0; i < end; i++) {
      var elt = exprList[i];

      if (elt && elt.type === "SpreadElement") {
        this.raise(elt.start, "The rest element has to be the last element when destructuring");
      }

      if (elt) this.toAssignable(elt, isBinding, contextDescription);
    }

    return exprList;
  };

  _proto.toReferencedList = function toReferencedList(exprList, isParenthesizedExpr) {
    return exprList;
  };

  _proto.toReferencedListDeep = function toReferencedListDeep(exprList, isParenthesizedExpr) {
    this.toReferencedList(exprList, isParenthesizedExpr);

    for (var _i2 = 0; _i2 < exprList.length; _i2++) {
      var expr = exprList[_i2];

      if (expr && expr.type === "ArrayExpression") {
        this.toReferencedListDeep(expr.elements);
      }
    }

    return exprList;
  };

  _proto.parseSpread = function parseSpread(refShorthandDefaultPos, refNeedsArrowPos) {
    var node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssign(false, refShorthandDefaultPos, undefined, refNeedsArrowPos);
    return this.finishNode(node, "SpreadElement");
  };

  _proto.parseRest = function parseRest() {
    var node = this.startNode();
    this.next();
    node.argument = this.parseBindingAtom();
    return this.finishNode(node, "RestElement");
  };

  _proto.shouldAllowYieldIdentifier = function shouldAllowYieldIdentifier() {
    return this.match(types._yield) && !this.state.strict && !this.state.inGenerator;
  };

  _proto.parseBindingIdentifier = function parseBindingIdentifier() {
    return this.parseIdentifier(this.shouldAllowYieldIdentifier());
  };

  _proto.parseBindingAtom = function parseBindingAtom() {
    switch (this.state.type) {
      case types._yield:
      case types.name:
        return this.parseBindingIdentifier();

      case types.bracketL:
        {
          var node = this.startNode();
          this.next();
          node.elements = this.parseBindingList(types.bracketR, true);
          return this.finishNode(node, "ArrayPattern");
        }

      case types.braceL:
        return this.parseObj(true);

      default:
        throw this.unexpected();
    }
  };

  _proto.parseBindingList = function parseBindingList(close, allowEmpty, allowModifiers) {
    var elts = [];
    var first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(types.comma);
      }

      if (allowEmpty && this.match(types.comma)) {
        elts.push(null);
      } else if (this.eat(close)) {
        break;
      } else if (this.match(types.ellipsis)) {
        elts.push(this.parseAssignableListItemTypes(this.parseRest()));

        if (this.state.inFunction && this.state.inParameters && this.match(types.comma)) {
          var nextTokenType = this.lookahead().type;
          var errorMessage = nextTokenType === types.parenR ? "A trailing comma is not permitted after the rest element" : "Rest parameter must be last formal parameter";
          this.raise(this.state.start, errorMessage);
        } else {
          this.expect(close);
        }

        break;
      } else {
        var decorators = [];

        if (this.match(types.at) && this.hasPlugin("decorators")) {
          this.raise(this.state.start, "Stage 2 decorators cannot be used to decorate parameters");
        }

        while (this.match(types.at)) {
          decorators.push(this.parseDecorator());
        }

        elts.push(this.parseAssignableListItem(allowModifiers, decorators));
      }
    }

    return elts;
  };

  _proto.parseAssignableListItem = function parseAssignableListItem(allowModifiers, decorators) {
    var left = this.parseMaybeDefault();
    this.parseAssignableListItemTypes(left);
    var elt = this.parseMaybeDefault(left.start, left.loc.start, left);

    if (decorators.length) {
      left.decorators = decorators;
    }

    return elt;
  };

  _proto.parseAssignableListItemTypes = function parseAssignableListItemTypes(param) {
    return param;
  };

  _proto.parseMaybeDefault = function parseMaybeDefault(startPos, startLoc, left) {
    startLoc = startLoc || this.state.startLoc;
    startPos = startPos || this.state.start;
    left = left || this.parseBindingAtom();
    if (!this.eat(types.eq)) return left;
    var node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssign();
    return this.finishNode(node, "AssignmentPattern");
  };

  _proto.checkLVal = function checkLVal(expr, isBinding, checkClashes, contextDescription) {
    switch (expr.type) {
      case "Identifier":
        this.checkReservedWord(expr.name, expr.start, false, true);

        if (checkClashes) {
          var _key = "_" + expr.name;

          if (checkClashes[_key]) {
            this.raise(expr.start, "Argument name clash in strict mode");
          } else {
            checkClashes[_key] = true;
          }
        }

        break;

      case "MemberExpression":
        if (isBinding) this.raise(expr.start, "Binding member expression");
        break;

      case "ObjectPattern":
        for (var _i4 = 0, _expr$properties2 = expr.properties; _i4 < _expr$properties2.length; _i4++) {
          var prop = _expr$properties2[_i4];
          if (prop.type === "ObjectProperty") prop = prop.value;
          this.checkLVal(prop, isBinding, checkClashes, "object destructuring pattern");
        }

        break;

      case "ArrayPattern":
        for (var _i6 = 0, _expr$elements2 = expr.elements; _i6 < _expr$elements2.length; _i6++) {
          var elem = _expr$elements2[_i6];

          if (elem) {
            this.checkLVal(elem, isBinding, checkClashes, "array destructuring pattern");
          }
        }

        break;

      case "AssignmentPattern":
        this.checkLVal(expr.left, isBinding, checkClashes, "assignment pattern");
        break;

      case "RestElement":
        this.checkLVal(expr.argument, isBinding, checkClashes, "rest element");
        break;

      default:
        {
          var message = (isBinding ? "Binding invalid" : "Invalid") + " left-hand side" + (contextDescription ? " in " + contextDescription : "expression");
          this.raise(expr.start, message);
        }
    }
  };

  _proto.checkToRestConversion = function checkToRestConversion(node) {
    var validArgumentTypes = ["Identifier", "MemberExpression"];

    if (validArgumentTypes.indexOf(node.argument.type) !== -1) {
      return;
    }

    this.raise(node.argument.start, "Invalid rest operator's argument");
  };

  return LValParser;
}(NodeUtils);

var ExpressionParser = function (_LValParser) {
  _inheritsLoose(ExpressionParser, _LValParser);

  function ExpressionParser() {
    return _LValParser.apply(this, arguments) || this;
  }

  var _proto = ExpressionParser.prototype;

  _proto.checkPropClash = function checkPropClash(prop, propHash) {
    if (prop.computed || prop.kind) return;
    var key = prop.key;
    var name = key.type === "Identifier" ? key.name : String(key.value);

    if (name === "__proto__") {
      if (propHash.proto) {
        this.raise(key.start, "Redefinition of __proto__ property");
      }

      propHash.proto = true;
    }
  };

  _proto.getExpression = function getExpression() {
    this.nextToken();
    var expr = this.parseExpression();

    if (!this.match(types.eof)) {
      this.unexpected();
    }

    expr.comments = this.state.comments;
    return expr;
  };

  _proto.parseExpression = function parseExpression(noIn, refShorthandDefaultPos) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    var expr = this.parseMaybeAssign(noIn, refShorthandDefaultPos);

    if (this.match(types.comma)) {
      var _node = this.startNodeAt(startPos, startLoc);

      _node.expressions = [expr];

      while (this.eat(types.comma)) {
        _node.expressions.push(this.parseMaybeAssign(noIn, refShorthandDefaultPos));
      }

      this.toReferencedList(_node.expressions);
      return this.finishNode(_node, "SequenceExpression");
    }

    return expr;
  };

  _proto.parseMaybeAssign = function parseMaybeAssign(noIn, refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;

    if (this.match(types._yield) && this.state.inGenerator) {
      var _left = this.parseYield();

      if (afterLeftParse) {
        _left = afterLeftParse.call(this, _left, startPos, startLoc);
      }

      return _left;
    }

    var failOnShorthandAssign;

    if (refShorthandDefaultPos) {
      failOnShorthandAssign = false;
    } else {
      refShorthandDefaultPos = {
        start: 0
      };
      failOnShorthandAssign = true;
    }

    if (this.match(types.parenL) || this.match(types.name) || this.match(types._yield)) {
      this.state.potentialArrowAt = this.state.start;
    }

    var left = this.parseMaybeConditional(noIn, refShorthandDefaultPos, refNeedsArrowPos);

    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }

    if (this.state.type.isAssign) {
      var _node2 = this.startNodeAt(startPos, startLoc);

      var operator = this.state.value;
      _node2.operator = operator;

      if (operator === "??=") {
        this.expectPlugin("nullishCoalescingOperator");
        this.expectPlugin("logicalAssignment");
      }

      if (operator === "||=" || operator === "&&=") {
        this.expectPlugin("logicalAssignment");
      }

      _node2.left = this.match(types.eq) ? this.toAssignable(left, undefined, "assignment expression") : left;
      refShorthandDefaultPos.start = 0;
      this.checkLVal(left, undefined, undefined, "assignment expression");

      if (left.extra && left.extra.parenthesized) {
        var errorMsg;

        if (left.type === "ObjectPattern") {
          errorMsg = "`({a}) = 0` use `({a} = 0)`";
        } else if (left.type === "ArrayPattern") {
          errorMsg = "`([a]) = 0` use `([a] = 0)`";
        }

        if (errorMsg) {
          this.raise(left.start, "You're trying to assign to a parenthesized expression, eg. instead of " + errorMsg);
        }
      }

      this.next();
      _node2.right = this.parseMaybeAssign(noIn);
      return this.finishNode(_node2, "AssignmentExpression");
    } else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }

    return left;
  };

  _proto.parseMaybeConditional = function parseMaybeConditional(noIn, refShorthandDefaultPos, refNeedsArrowPos) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    var potentialArrowAt = this.state.potentialArrowAt;
    var expr = this.parseExprOps(noIn, refShorthandDefaultPos);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
    return this.parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos);
  };

  _proto.parseConditional = function parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos) {
    if (this.eat(types.question)) {
      var _node3 = this.startNodeAt(startPos, startLoc);

      _node3.test = expr;
      _node3.consequent = this.parseMaybeAssign();
      this.expect(types.colon);
      _node3.alternate = this.parseMaybeAssign(noIn);
      return this.finishNode(_node3, "ConditionalExpression");
    }

    return expr;
  };

  _proto.parseExprOps = function parseExprOps(noIn, refShorthandDefaultPos) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    var potentialArrowAt = this.state.potentialArrowAt;
    var expr = this.parseMaybeUnary(refShorthandDefaultPos);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return expr;
    }

    return this.parseExprOp(expr, startPos, startLoc, -1, noIn);
  };

  _proto.parseExprOp = function parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn) {
    var prec = this.state.type.binop;

    if (prec != null && (!noIn || !this.match(types._in))) {
      if (prec > minPrec) {
        var _node4 = this.startNodeAt(leftStartPos, leftStartLoc);

        var operator = this.state.value;
        _node4.left = left;
        _node4.operator = operator;

        if (operator === "**" && left.type === "UnaryExpression" && !(left.extra && left.extra.parenthesized)) {
          this.raise(left.argument.start, "Illegal expression. Wrap left hand side or entire exponentiation in parentheses.");
        }

        var op = this.state.type;

        if (op === types.pipeline) {
          this.expectPlugin("pipelineOperator");
          this.state.inPipeline = true;
          this.checkPipelineAtInfixOperator(left, leftStartPos);
        } else if (op === types.nullishCoalescing) {
          this.expectPlugin("nullishCoalescingOperator");
        }

        this.next();

        if (op === types.pipeline && this.getPluginOption("pipelineOperator", "proposal") === "minimal") {
          if (this.match(types.name) && this.state.value === "await" && this.state.inAsync) {
            throw this.raise(this.state.start, "Unexpected \"await\" after pipeline body; await must have parentheses in minimal proposal");
          }
        }

        _node4.right = this.parseExprOpRightExpr(op, prec, noIn);
        this.finishNode(_node4, op === types.logicalOR || op === types.logicalAND || op === types.nullishCoalescing ? "LogicalExpression" : "BinaryExpression");
        return this.parseExprOp(_node4, leftStartPos, leftStartLoc, minPrec, noIn);
      }
    }

    return left;
  };

  _proto.parseExprOpRightExpr = function parseExprOpRightExpr(op, prec, noIn) {
    var _this = this;

    switch (op) {
      case types.pipeline:
        if (this.getPluginOption("pipelineOperator", "proposal") === "smart") {
          var startPos = this.state.start;
          var startLoc = this.state.startLoc;
          return this.withTopicPermittingContext(function () {
            return _this.parseSmartPipelineBody(_this.parseExprOpBaseRightExpr(op, prec, noIn), startPos, startLoc);
          });
        }

      default:
        return this.parseExprOpBaseRightExpr(op, prec, noIn);
    }
  };

  _proto.parseExprOpBaseRightExpr = function parseExprOpBaseRightExpr(op, prec, noIn) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    return this.parseExprOp(this.parseMaybeUnary(), startPos, startLoc, op.rightAssociative ? prec - 1 : prec, noIn);
  };

  _proto.parseMaybeUnary = function parseMaybeUnary(refShorthandDefaultPos) {
    if (this.state.type.prefix) {
      var _node5 = this.startNode();

      var update = this.match(types.incDec);
      _node5.operator = this.state.value;
      _node5.prefix = true;

      if (_node5.operator === "throw") {
        this.expectPlugin("throwExpressions");
      }

      this.next();
      _node5.argument = this.parseMaybeUnary();

      if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
        this.unexpected(refShorthandDefaultPos.start);
      }

      if (update) {
        this.checkLVal(_node5.argument, undefined, undefined, "prefix operation");
      } else if (this.state.strict && _node5.operator === "delete") {
        var arg = _node5.argument;

        if (arg.type === "Identifier") {
          this.raise(_node5.start, "Deleting local variable in strict mode");
        } else if (arg.type === "MemberExpression" && arg.property.type === "PrivateName") {
          this.raise(_node5.start, "Deleting a private field is not allowed");
        }
      }

      return this.finishNode(_node5, update ? "UpdateExpression" : "UnaryExpression");
    }

    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    var expr = this.parseExprSubscripts(refShorthandDefaultPos);
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;

    while (this.state.type.postfix && !this.canInsertSemicolon()) {
      var _node6 = this.startNodeAt(startPos, startLoc);

      _node6.operator = this.state.value;
      _node6.prefix = false;
      _node6.argument = expr;
      this.checkLVal(expr, undefined, undefined, "postfix operation");
      this.next();
      expr = this.finishNode(_node6, "UpdateExpression");
    }

    return expr;
  };

  _proto.parseExprSubscripts = function parseExprSubscripts(refShorthandDefaultPos) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    var potentialArrowAt = this.state.potentialArrowAt;
    var expr = this.parseExprAtom(refShorthandDefaultPos);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return expr;
    }

    return this.parseSubscripts(expr, startPos, startLoc);
  };

  _proto.parseSubscripts = function parseSubscripts(base, startPos, startLoc, noCalls) {
    var state = {
      optionalChainMember: false,
      stop: false
    };

    do {
      base = this.parseSubscript(base, startPos, startLoc, noCalls, state);
    } while (!state.stop);

    return base;
  };

  _proto.parseSubscript = function parseSubscript(base, startPos, startLoc, noCalls, state) {
    if (!noCalls && this.eat(types.doubleColon)) {
      var _node7 = this.startNodeAt(startPos, startLoc);

      _node7.object = base;
      _node7.callee = this.parseNoCallExpr();
      state.stop = true;
      return this.parseSubscripts(this.finishNode(_node7, "BindExpression"), startPos, startLoc, noCalls);
    } else if (this.match(types.questionDot)) {
      this.expectPlugin("optionalChaining");
      state.optionalChainMember = true;

      if (noCalls && this.lookahead().type == types.parenL) {
        state.stop = true;
        return base;
      }

      this.next();

      var _node8 = this.startNodeAt(startPos, startLoc);

      if (this.eat(types.bracketL)) {
        _node8.object = base;
        _node8.property = this.parseExpression();
        _node8.computed = true;
        _node8.optional = true;
        this.expect(types.bracketR);
        return this.finishNode(_node8, "OptionalMemberExpression");
      } else if (this.eat(types.parenL)) {
        var possibleAsync = this.atPossibleAsync(base);
        _node8.callee = base;
        _node8.arguments = this.parseCallExpressionArguments(types.parenR, possibleAsync);
        _node8.optional = true;
        return this.finishNode(_node8, "OptionalCallExpression");
      } else {
        _node8.object = base;
        _node8.property = this.parseIdentifier(true);
        _node8.computed = false;
        _node8.optional = true;
        return this.finishNode(_node8, "OptionalMemberExpression");
      }
    } else if (this.eat(types.dot)) {
      var _node9 = this.startNodeAt(startPos, startLoc);

      _node9.object = base;
      _node9.property = this.parseMaybePrivateName();
      _node9.computed = false;

      if (state.optionalChainMember) {
        _node9.optional = false;
        return this.finishNode(_node9, "OptionalMemberExpression");
      }

      return this.finishNode(_node9, "MemberExpression");
    } else if (this.eat(types.bracketL)) {
      var _node10 = this.startNodeAt(startPos, startLoc);

      _node10.object = base;
      _node10.property = this.parseExpression();
      _node10.computed = true;
      this.expect(types.bracketR);

      if (state.optionalChainMember) {
        _node10.optional = false;
        return this.finishNode(_node10, "OptionalMemberExpression");
      }

      return this.finishNode(_node10, "MemberExpression");
    } else if (!noCalls && this.match(types.parenL)) {
      var oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
      var oldYOAIPAP = this.state.yieldOrAwaitInPossibleArrowParameters;
      this.state.maybeInArrowParameters = true;
      this.state.yieldOrAwaitInPossibleArrowParameters = null;

      var _possibleAsync = this.atPossibleAsync(base);

      this.next();

      var _node11 = this.startNodeAt(startPos, startLoc);

      _node11.callee = base;
      var refTrailingCommaPos = {
        start: -1
      };
      _node11.arguments = this.parseCallExpressionArguments(types.parenR, _possibleAsync, refTrailingCommaPos);

      if (!state.optionalChainMember) {
        this.finishCallExpression(_node11);
      } else {
        this.finishOptionalCallExpression(_node11);
      }

      if (_possibleAsync && this.shouldParseAsyncArrow()) {
        state.stop = true;

        if (refTrailingCommaPos.start > -1) {
          this.raise(refTrailingCommaPos.start, "A trailing comma is not permitted after the rest element");
        }

        _node11 = this.parseAsyncArrowFromCallExpression(this.startNodeAt(startPos, startLoc), _node11);
        this.state.yieldOrAwaitInPossibleArrowParameters = oldYOAIPAP;
      } else {
        this.toReferencedListDeep(_node11.arguments);
        this.state.yieldOrAwaitInPossibleArrowParameters = this.state.yieldOrAwaitInPossibleArrowParameters || oldYOAIPAP;
      }

      this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
      return _node11;
    } else if (this.match(types.backQuote)) {
      return this.parseTaggedTemplateExpression(startPos, startLoc, base, state);
    } else {
      state.stop = true;
      return base;
    }
  };

  _proto.parseTaggedTemplateExpression = function parseTaggedTemplateExpression(startPos, startLoc, base, state, typeArguments) {
    var node = this.startNodeAt(startPos, startLoc);
    node.tag = base;
    node.quasi = this.parseTemplate(true);
    if (typeArguments) node.typeParameters = typeArguments;

    if (state.optionalChainMember) {
      this.raise(startPos, "Tagged Template Literals are not allowed in optionalChain");
    }

    return this.finishNode(node, "TaggedTemplateExpression");
  };

  _proto.atPossibleAsync = function atPossibleAsync(base) {
    return !this.state.containsEsc && this.state.potentialArrowAt === base.start && base.type === "Identifier" && base.name === "async" && !this.canInsertSemicolon();
  };

  _proto.finishCallExpression = function finishCallExpression(node) {
    if (node.callee.type === "Import") {
      if (node.arguments.length !== 1) {
        this.raise(node.start, "import() requires exactly one argument");
      }

      var importArg = node.arguments[0];

      if (importArg && importArg.type === "SpreadElement") {
        this.raise(importArg.start, "... is not allowed in import()");
      }
    }

    return this.finishNode(node, "CallExpression");
  };

  _proto.finishOptionalCallExpression = function finishOptionalCallExpression(node) {
    if (node.callee.type === "Import") {
      if (node.arguments.length !== 1) {
        this.raise(node.start, "import() requires exactly one argument");
      }

      var importArg = node.arguments[0];

      if (importArg && importArg.type === "SpreadElement") {
        this.raise(importArg.start, "... is not allowed in import()");
      }
    }

    return this.finishNode(node, "OptionalCallExpression");
  };

  _proto.parseCallExpressionArguments = function parseCallExpressionArguments(close, possibleAsyncArrow, refTrailingCommaPos) {
    var elts = [];
    var innerParenStart;
    var first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(types.comma);
        if (this.eat(close)) break;
      }

      if (this.match(types.parenL) && !innerParenStart) {
        innerParenStart = this.state.start;
      }

      elts.push(this.parseExprListItem(false, possibleAsyncArrow ? {
        start: 0
      } : undefined, possibleAsyncArrow ? {
        start: 0
      } : undefined, possibleAsyncArrow ? refTrailingCommaPos : undefined));
    }

    if (possibleAsyncArrow && innerParenStart && this.shouldParseAsyncArrow()) {
      this.unexpected();
    }

    return elts;
  };

  _proto.shouldParseAsyncArrow = function shouldParseAsyncArrow() {
    return this.match(types.arrow);
  };

  _proto.parseAsyncArrowFromCallExpression = function parseAsyncArrowFromCallExpression(node, call) {
    this.expect(types.arrow);
    this.parseArrowExpression(node, call.arguments, true);
    return node;
  };

  _proto.parseNoCallExpr = function parseNoCallExpr() {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    return this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  };

  _proto.parseExprAtom = function parseExprAtom(refShorthandDefaultPos) {
    if (this.state.type === types.slash) this.readRegexp();
    var canBeArrow = this.state.potentialArrowAt === this.state.start;
    var node;

    switch (this.state.type) {
      case types._super:
        if (!this.state.inMethod && !this.state.inClassProperty && !this.options.allowSuperOutsideMethod) {
          this.raise(this.state.start, "super is only allowed in object methods and classes");
        }

        node = this.startNode();
        this.next();

        if (!this.match(types.parenL) && !this.match(types.bracketL) && !this.match(types.dot)) {
          this.unexpected();
        }

        if (this.match(types.parenL) && this.state.inMethod !== "constructor" && !this.options.allowSuperOutsideMethod) {
          this.raise(node.start, "super() is only valid inside a class constructor. " + "Make sure the method name is spelled exactly as 'constructor'.");
        }

        return this.finishNode(node, "Super");

      case types._import:
        if (this.lookahead().type === types.dot) {
          return this.parseImportMetaProperty();
        }

        this.expectPlugin("dynamicImport");
        node = this.startNode();
        this.next();

        if (!this.match(types.parenL)) {
          this.unexpected(null, types.parenL);
        }

        return this.finishNode(node, "Import");

      case types._this:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "ThisExpression");

      case types._yield:
        if (this.state.inGenerator) this.unexpected();

      case types.name:
        {
          node = this.startNode();
          var allowAwait = this.state.value === "await" && (this.state.inAsync || !this.state.inFunction && this.options.allowAwaitOutsideFunction);
          var containsEsc = this.state.containsEsc;
          var allowYield = this.shouldAllowYieldIdentifier();
          var id = this.parseIdentifier(allowAwait || allowYield);

          if (id.name === "await") {
            if (this.state.inAsync || this.inModule || !this.state.inFunction && this.options.allowAwaitOutsideFunction) {
              return this.parseAwait(node);
            }
          } else if (!containsEsc && id.name === "async" && this.match(types._function) && !this.canInsertSemicolon()) {
            this.next();
            return this.parseFunction(node, false, false, true);
          } else if (canBeArrow && !this.canInsertSemicolon() && id.name === "async" && this.match(types.name)) {
            var oldYOAIPAP = this.state.yieldOrAwaitInPossibleArrowParameters;
            var oldInAsync = this.state.inAsync;
            this.state.yieldOrAwaitInPossibleArrowParameters = null;
            this.state.inAsync = true;
            var params = [this.parseIdentifier()];
            this.expect(types.arrow);
            this.parseArrowExpression(node, params, true);
            this.state.yieldOrAwaitInPossibleArrowParameters = oldYOAIPAP;
            this.state.inAsync = oldInAsync;
            return node;
          }

          if (canBeArrow && !this.canInsertSemicolon() && this.eat(types.arrow)) {
            var _oldYOAIPAP = this.state.yieldOrAwaitInPossibleArrowParameters;
            this.state.yieldOrAwaitInPossibleArrowParameters = null;
            this.parseArrowExpression(node, [id]);
            this.state.yieldOrAwaitInPossibleArrowParameters = _oldYOAIPAP;
            return node;
          }

          return id;
        }

      case types._do:
        {
          this.expectPlugin("doExpressions");

          var _node12 = this.startNode();

          this.next();
          var oldInFunction = this.state.inFunction;
          var oldLabels = this.state.labels;
          this.state.labels = [];
          this.state.inFunction = false;
          _node12.body = this.parseBlock(false);
          this.state.inFunction = oldInFunction;
          this.state.labels = oldLabels;
          return this.finishNode(_node12, "DoExpression");
        }

      case types.regexp:
        {
          var value = this.state.value;
          node = this.parseLiteral(value.value, "RegExpLiteral");
          node.pattern = value.pattern;
          node.flags = value.flags;
          return node;
        }

      case types.num:
        return this.parseLiteral(this.state.value, "NumericLiteral");

      case types.bigint:
        return this.parseLiteral(this.state.value, "BigIntLiteral");

      case types.string:
        return this.parseLiteral(this.state.value, "StringLiteral");

      case types._null:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "NullLiteral");

      case types._true:
      case types._false:
        return this.parseBooleanLiteral();

      case types.parenL:
        return this.parseParenAndDistinguishExpression(canBeArrow);

      case types.bracketL:
        node = this.startNode();
        this.next();
        node.elements = this.parseExprList(types.bracketR, true, refShorthandDefaultPos);

        if (!this.state.maybeInArrowParameters) {
          this.toReferencedList(node.elements);
        }

        return this.finishNode(node, "ArrayExpression");

      case types.braceL:
        return this.parseObj(false, refShorthandDefaultPos);

      case types._function:
        return this.parseFunctionExpression();

      case types.at:
        this.parseDecorators();

      case types._class:
        node = this.startNode();
        this.takeDecorators(node);
        return this.parseClass(node, false);

      case types._new:
        return this.parseNew();

      case types.backQuote:
        return this.parseTemplate(false);

      case types.doubleColon:
        {
          node = this.startNode();
          this.next();
          node.object = null;
          var callee = node.callee = this.parseNoCallExpr();

          if (callee.type === "MemberExpression") {
            return this.finishNode(node, "BindExpression");
          } else {
            throw this.raise(callee.start, "Binding should be performed on object property.");
          }
        }

      case types.hash:
        {
          if (this.state.inPipeline) {
            node = this.startNode();

            if (this.getPluginOption("pipelineOperator", "proposal") !== "smart") {
              this.raise(node.start, "Primary Topic Reference found but pipelineOperator not passed 'smart' for 'proposal' option.");
            }

            this.next();

            if (this.primaryTopicReferenceIsAllowedInCurrentTopicContext()) {
              this.registerTopicReference();
              return this.finishNode(node, "PipelinePrimaryTopicReference");
            } else {
              throw this.raise(node.start, "Topic reference was used in a lexical context without topic binding");
            }
          }
        }

      default:
        throw this.unexpected();
    }
  };

  _proto.parseBooleanLiteral = function parseBooleanLiteral() {
    var node = this.startNode();
    node.value = this.match(types._true);
    this.next();
    return this.finishNode(node, "BooleanLiteral");
  };

  _proto.parseMaybePrivateName = function parseMaybePrivateName() {
    var isPrivate = this.match(types.hash);

    if (isPrivate) {
      this.expectOnePlugin(["classPrivateProperties", "classPrivateMethods"]);

      var _node13 = this.startNode();

      var columnHashEnd = this.state.end;
      this.next();
      var columnIdentifierStart = this.state.start;
      var spacesBetweenHashAndIdentifier = columnIdentifierStart - columnHashEnd;

      if (spacesBetweenHashAndIdentifier != 0) {
        this.raise(columnIdentifierStart, "Unexpected space between # and identifier");
      }

      _node13.id = this.parseIdentifier(true);
      return this.finishNode(_node13, "PrivateName");
    } else {
      return this.parseIdentifier(true);
    }
  };

  _proto.parseFunctionExpression = function parseFunctionExpression() {
    var node = this.startNode();
    var meta = this.startNode();
    this.next();
    meta = this.createIdentifier(meta, "function");

    if (this.state.inGenerator && this.eat(types.dot)) {
      return this.parseMetaProperty(node, meta, "sent");
    }

    return this.parseFunction(node, false);
  };

  _proto.parseMetaProperty = function parseMetaProperty(node, meta, propertyName) {
    node.meta = meta;

    if (meta.name === "function" && propertyName === "sent") {
      if (this.isContextual(propertyName)) {
        this.expectPlugin("functionSent");
      } else if (!this.hasPlugin("functionSent")) {
        this.unexpected();
      }
    }

    var containsEsc = this.state.containsEsc;
    node.property = this.parseIdentifier(true);

    if (node.property.name !== propertyName || containsEsc) {
      this.raise(node.property.start, "The only valid meta property for " + meta.name + " is " + meta.name + "." + propertyName);
    }

    return this.finishNode(node, "MetaProperty");
  };

  _proto.parseImportMetaProperty = function parseImportMetaProperty() {
    var node = this.startNode();
    var id = this.parseIdentifier(true);
    this.expect(types.dot);

    if (id.name === "import") {
      if (this.isContextual("meta")) {
        this.expectPlugin("importMeta");
      } else if (!this.hasPlugin("importMeta")) {
        this.raise(id.start, "Dynamic imports require a parameter: import('a.js')");
      }
    }

    if (!this.inModule) {
      this.raise(id.start, "import.meta may appear only with 'sourceType: \"module\"'", {
        code: "BABEL_PARSER_SOURCETYPE_MODULE_REQUIRED"
      });
    }

    this.sawUnambiguousESM = true;
    return this.parseMetaProperty(node, id, "meta");
  };

  _proto.parseLiteral = function parseLiteral(value, type, startPos, startLoc) {
    startPos = startPos || this.state.start;
    startLoc = startLoc || this.state.startLoc;
    var node = this.startNodeAt(startPos, startLoc);
    this.addExtra(node, "rawValue", value);
    this.addExtra(node, "raw", this.input.slice(startPos, this.state.end));
    node.value = value;
    this.next();
    return this.finishNode(node, type);
  };

  _proto.parseParenExpression = function parseParenExpression() {
    this.expect(types.parenL);
    var val = this.parseExpression();
    this.expect(types.parenR);
    return val;
  };

  _proto.parseParenAndDistinguishExpression = function parseParenAndDistinguishExpression(canBeArrow) {
    var startPos = this.state.start;
    var startLoc = this.state.startLoc;
    var val;
    this.expect(types.parenL);
    var oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    var oldYOAIPAP = this.state.yieldOrAwaitInPossibleArrowParameters;
    this.state.maybeInArrowParameters = true;
    this.state.yieldOrAwaitInPossibleArrowParameters = null;
    var innerStartPos = this.state.start;
    var innerStartLoc = this.state.startLoc;
    var exprList = [];
    var refShorthandDefaultPos = {
      start: 0
    };
    var refNeedsArrowPos = {
      start: 0
    };
    var first = true;
    var spreadStart;
    var optionalCommaStart;

    while (!this.match(types.parenR)) {
      if (first) {
        first = false;
      } else {
        this.expect(types.comma, refNeedsArrowPos.start || null);

        if (this.match(types.parenR)) {
          optionalCommaStart = this.state.start;
          break;
        }
      }

      if (this.match(types.ellipsis)) {
        var spreadNodeStartPos = this.state.start;
        var spreadNodeStartLoc = this.state.startLoc;
        spreadStart = this.state.start;
        exprList.push(this.parseParenItem(this.parseRest(), spreadNodeStartPos, spreadNodeStartLoc));

        if (this.match(types.comma)) {
          var nextTokenType = this.lookahead().type;
          var errorMessage = nextTokenType === types.parenR ? "A trailing comma is not permitted after the rest element" : "Rest parameter must be last formal parameter";
          this.raise(this.state.start, errorMessage);
        }

        break;
      } else {
        exprList.push(this.parseMaybeAssign(false, refShorthandDefaultPos, this.parseParenItem, refNeedsArrowPos));
      }
    }

    var innerEndPos = this.state.start;
    var innerEndLoc = this.state.startLoc;
    this.expect(types.parenR);
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    var arrowNode = this.startNodeAt(startPos, startLoc);

    if (canBeArrow && this.shouldParseArrow() && (arrowNode = this.parseArrow(arrowNode))) {
      for (var _i2 = 0; _i2 < exprList.length; _i2++) {
        var param = exprList[_i2];

        if (param.extra && param.extra.parenthesized) {
          this.unexpected(param.extra.parenStart);
        }
      }

      this.parseArrowExpression(arrowNode, exprList);
      this.state.yieldOrAwaitInPossibleArrowParameters = oldYOAIPAP;
      return arrowNode;
    }

    this.state.yieldOrAwaitInPossibleArrowParameters = this.state.yieldOrAwaitInPossibleArrowParameters || oldYOAIPAP;

    if (!exprList.length) {
      this.unexpected(this.state.lastTokStart);
    }

    if (optionalCommaStart) this.unexpected(optionalCommaStart);
    if (spreadStart) this.unexpected(spreadStart);

    if (refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }

    if (refNeedsArrowPos.start) this.unexpected(refNeedsArrowPos.start);
    this.toReferencedListDeep(exprList, true);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }

    this.addExtra(val, "parenthesized", true);
    this.addExtra(val, "parenStart", startPos);
    return val;
  };

  _proto.shouldParseArrow = function shouldParseArrow() {
    return !this.canInsertSemicolon();
  };

  _proto.parseArrow = function parseArrow(node) {
    if (this.eat(types.arrow)) {
      return node;
    }
  };

  _proto.parseParenItem = function parseParenItem(node, startPos, startLoc) {
    return node;
  };

  _proto.parseNew = function parseNew() {
    var node = this.startNode();
    var meta = this.parseIdentifier(true);

    if (this.eat(types.dot)) {
      var metaProp = this.parseMetaProperty(node, meta, "target");

      if (!this.state.inFunction && !this.state.inClassProperty) {
        var error = "new.target can only be used in functions";

        if (this.hasPlugin("classProperties")) {
          error += " or class properties";
        }

        this.raise(metaProp.start, error);
      }

      return metaProp;
    }

    node.callee = this.parseNoCallExpr();

    if (node.callee.type === "OptionalMemberExpression" || node.callee.type === "OptionalCallExpression") {
      this.raise(this.state.lastTokEnd, "constructors in/after an Optional Chain are not allowed");
    }

    if (this.eat(types.questionDot)) {
      this.raise(this.state.start, "constructors in/after an Optional Chain are not allowed");
    }

    this.parseNewArguments(node);
    return this.finishNode(node, "NewExpression");
  };

  _proto.parseNewArguments = function parseNewArguments(node) {
    if (this.eat(types.parenL)) {
      var args = this.parseExprList(types.parenR);
      this.toReferencedList(args);
      node.arguments = args;
    } else {
      node.arguments = [];
    }
  };

  _proto.parseTemplateElement = function parseTemplateElement(isTagged) {
    var elem = this.startNode();

    if (this.state.value === null) {
      if (!isTagged) {
        this.raise(this.state.invalidTemplateEscapePosition || 0, "Invalid escape sequence in template");
      } else {
        this.state.invalidTemplateEscapePosition = null;
      }
    }

    elem.value = {
      raw: this.input.slice(this.state.start, this.state.end).replace(/\r\n?/g, "\n"),
      cooked: this.state.value
    };
    this.next();
    elem.tail = this.match(types.backQuote);
    return this.finishNode(elem, "TemplateElement");
  };

  _proto.parseTemplate = function parseTemplate(isTagged) {
    var node = this.startNode();
    this.next();
    node.expressions = [];
    var curElt = this.parseTemplateElement(isTagged);
    node.quasis = [curElt];

    while (!curElt.tail) {
      this.expect(types.dollarBraceL);
      node.expressions.push(this.parseExpression());
      this.expect(types.braceR);
      node.quasis.push(curElt = this.parseTemplateElement(isTagged));
    }

    this.next();
    return this.finishNode(node, "TemplateLiteral");
  };

  _proto.parseObj = function parseObj(isPattern, refShorthandDefaultPos) {
    var decorators = [];
    var propHash = Object.create(null);
    var first = true;
    var node = this.startNode();
    node.properties = [];
    this.next();
    var firstRestLocation = null;

    while (!this.eat(types.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(types.comma);
        if (this.eat(types.braceR)) break;
      }

      if (this.match(types.at)) {
        if (this.hasPlugin("decorators")) {
          this.raise(this.state.start, "Stage 2 decorators disallow object literal property decorators");
        } else {
          while (this.match(types.at)) {
            decorators.push(this.parseDecorator());
          }
        }
      }

      var prop = this.startNode(),
          isGenerator = false,
          _isAsync = false,
          startPos = void 0,
          startLoc = void 0;

      if (decorators.length) {
        prop.decorators = decorators;
        decorators = [];
      }

      if (this.match(types.ellipsis)) {
        prop = this.parseSpread(isPattern ? {
          start: 0
        } : undefined);

        if (isPattern) {
          this.toAssignable(prop, true, "object pattern");
        }

        node.properties.push(prop);

        if (isPattern) {
          var position = this.state.start;

          if (firstRestLocation !== null) {
            this.unexpected(firstRestLocation, "Cannot have multiple rest elements when destructuring");
          } else if (this.eat(types.braceR)) {
            break;
          } else if (this.match(types.comma) && this.lookahead().type === types.braceR) {
            this.unexpected(position, "A trailing comma is not permitted after the rest element");
          } else {
            firstRestLocation = position;
            continue;
          }
        } else {
          continue;
        }
      }

      prop.method = false;

      if (isPattern || refShorthandDefaultPos) {
        startPos = this.state.start;
        startLoc = this.state.startLoc;
      }

      if (!isPattern) {
        isGenerator = this.eat(types.star);
      }

      var containsEsc = this.state.containsEsc;

      if (!isPattern && this.isContextual("async")) {
        if (isGenerator) this.unexpected();
        var asyncId = this.parseIdentifier();

        if (this.match(types.colon) || this.match(types.parenL) || this.match(types.braceR) || this.match(types.eq) || this.match(types.comma)) {
          prop.key = asyncId;
          prop.computed = false;
        } else {
          _isAsync = true;
          isGenerator = this.eat(types.star);
          this.parsePropertyName(prop);
        }
      } else {
        this.parsePropertyName(prop);
      }

      this.parseObjPropValue(prop, startPos, startLoc, isGenerator, _isAsync, isPattern, refShorthandDefaultPos, containsEsc);
      this.checkPropClash(prop, propHash);

      if (prop.shorthand) {
        this.addExtra(prop, "shorthand", true);
      }

      node.properties.push(prop);
    }

    if (firstRestLocation !== null) {
      this.unexpected(firstRestLocation, "The rest element has to be the last element when destructuring");
    }

    if (decorators.length) {
      this.raise(this.state.start, "You have trailing decorators with no property");
    }

    return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
  };

  _proto.isGetterOrSetterMethod = function isGetterOrSetterMethod(prop, isPattern) {
    return !isPattern && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.match(types.string) || this.match(types.num) || this.match(types.bracketL) || this.match(types.name) || !!this.state.type.keyword);
  };

  _proto.checkGetterSetterParams = function checkGetterSetterParams(method) {
    var paramCount = method.kind === "get" ? 0 : 1;
    var start = method.start;

    if (method.params.length !== paramCount) {
      if (method.kind === "get") {
        this.raise(start, "getter must not have any formal parameters");
      } else {
        this.raise(start, "setter must have exactly one formal parameter");
      }
    }

    if (method.kind === "set" && method.params[0].type === "RestElement") {
      this.raise(start, "setter function argument must not be a rest parameter");
    }
  };

  _proto.parseObjectMethod = function parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) {
    if (isAsync || isGenerator || this.match(types.parenL)) {
      if (isPattern) this.unexpected();
      prop.kind = "method";
      prop.method = true;
      return this.parseMethod(prop, isGenerator, isAsync, false, "ObjectMethod");
    }

    if (!containsEsc && this.isGetterOrSetterMethod(prop, isPattern)) {
      if (isGenerator || isAsync) this.unexpected();
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      this.parseMethod(prop, false, false, false, "ObjectMethod");
      this.checkGetterSetterParams(prop);
      return prop;
    }
  };

  _proto.parseObjectProperty = function parseObjectProperty(prop, startPos, startLoc, isPattern, refShorthandDefaultPos) {
    prop.shorthand = false;

    if (this.eat(types.colon)) {
      prop.value = isPattern ? this.parseMaybeDefault(this.state.start, this.state.startLoc) : this.parseMaybeAssign(false, refShorthandDefaultPos);
      return this.finishNode(prop, "ObjectProperty");
    }

    if (!prop.computed && prop.key.type === "Identifier") {
      this.checkReservedWord(prop.key.name, prop.key.start, true, true);

      if (isPattern) {
        prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key.__clone());
      } else if (this.match(types.eq) && refShorthandDefaultPos) {
        if (!refShorthandDefaultPos.start) {
          refShorthandDefaultPos.start = this.state.start;
        }

        prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key.__clone());
      } else {
        prop.value = prop.key.__clone();
      }

      prop.shorthand = true;
      return this.finishNode(prop, "ObjectProperty");
    }
  };

  _proto.parseObjPropValue = function parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refShorthandDefaultPos, containsEsc) {
    var node = this.parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) || this.parseObjectProperty(prop, startPos, startLoc, isPattern, refShorthandDefaultPos);
    if (!node) this.unexpected();
    return node;
  };

  _proto.parsePropertyName = function parsePropertyName(prop) {
    if (this.eat(types.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(types.bracketR);
    } else {
      var oldInPropertyName = this.state.inPropertyName;
      this.state.inPropertyName = true;
      prop.key = this.match(types.num) || this.match(types.string) ? this.parseExprAtom() : this.parseMaybePrivateName();

      if (prop.key.type !== "PrivateName") {
        prop.computed = false;
      }

      this.state.inPropertyName = oldInPropertyName;
    }

    return prop.key;
  };

  _proto.initFunction = function initFunction(node, isAsync) {
    node.id = null;
    node.generator = false;
    node.async = !!isAsync;
  };

  _proto.parseMethod = function parseMethod(node, isGenerator, isAsync, isConstructor, type) {
    var oldInFunc = this.state.inFunction;
    var oldInMethod = this.state.inMethod;
    var oldInAsync = this.state.inAsync;
    var oldInGenerator = this.state.inGenerator;
    this.state.inFunction = true;
    this.state.inMethod = node.kind || true;
    this.state.inAsync = isAsync;
    this.state.inGenerator = isGenerator;
    this.initFunction(node, isAsync);
    node.generator = !!isGenerator;
    var allowModifiers = isConstructor;
    this.parseFunctionParams(node, allowModifiers);
    this.parseFunctionBodyAndFinish(node, type);
    this.state.inFunction = oldInFunc;
    this.state.inMethod = oldInMethod;
    this.state.inAsync = oldInAsync;
    this.state.inGenerator = oldInGenerator;
    return node;
  };

  _proto.parseArrowExpression = function parseArrowExpression(node, params, isAsync) {
    if (isAsync === void 0) {
      isAsync = false;
    }

    var yOAIPAP = this.state.yieldOrAwaitInPossibleArrowParameters;

    if (yOAIPAP) {
      if (yOAIPAP.type === "YieldExpression") {
        this.raise(yOAIPAP.start, "yield is not allowed in the parameters of an arrow function" + " inside a generator");
      } else {
        this.raise(yOAIPAP.start, "await is not allowed in the parameters of an arrow function" + " inside an async function");
      }
    }

    var oldInFunc = this.state.inFunction;
    this.state.inFunction = true;
    this.initFunction(node, isAsync);
    if (params) this.setArrowFunctionParameters(node, params);
    var oldInAsync = this.state.inAsync;
    var oldInGenerator = this.state.inGenerator;
    var oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    this.state.inAsync = isAsync;
    this.state.inGenerator = false;
    this.state.maybeInArrowParameters = false;
    this.parseFunctionBody(node, true);
    this.state.inAsync = oldInAsync;
    this.state.inGenerator = oldInGenerator;
    this.state.inFunction = oldInFunc;
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    return this.finishNode(node, "ArrowFunctionExpression");
  };

  _proto.setArrowFunctionParameters = function setArrowFunctionParameters(node, params) {
    node.params = this.toAssignableList(params, true, "arrow function parameters");
  };

  _proto.isStrictBody = function isStrictBody(node) {
    var isBlockStatement = node.body.type === "BlockStatement";

    if (isBlockStatement && node.body.directives.length) {
      for (var _i4 = 0, _node$body$directives2 = node.body.directives; _i4 < _node$body$directives2.length; _i4++) {
        var directive = _node$body$directives2[_i4];

        if (directive.value.value === "use strict") {
          return true;
        }
      }
    }

    return false;
  };

  _proto.parseFunctionBodyAndFinish = function parseFunctionBodyAndFinish(node, type, allowExpressionBody) {
    this.parseFunctionBody(node, allowExpressionBody);
    this.finishNode(node, type);
  };

  _proto.parseFunctionBody = function parseFunctionBody(node, allowExpression) {
    var isExpression = allowExpression && !this.match(types.braceL);
    var oldInParameters = this.state.inParameters;
    this.state.inParameters = false;

    if (isExpression) {
      node.body = this.parseMaybeAssign();
    } else {
      var oldInGen = this.state.inGenerator;
      var oldInFunc = this.state.inFunction;
      var oldLabels = this.state.labels;
      this.state.inGenerator = node.generator;
      this.state.inFunction = true;
      this.state.labels = [];
      node.body = this.parseBlock(true);
      this.state.inFunction = oldInFunc;
      this.state.inGenerator = oldInGen;
      this.state.labels = oldLabels;
    }

    this.checkFunctionNameAndParams(node, allowExpression);
    this.state.inParameters = oldInParameters;
  };

  _proto.checkFunctionNameAndParams = function checkFunctionNameAndParams(node, isArrowFunction) {
    var isStrict = this.isStrictBody(node);
    var checkLVal = this.state.strict || isStrict || isArrowFunction;
    var oldStrict = this.state.strict;
    if (isStrict) this.state.strict = isStrict;

    if (checkLVal) {
      var nameHash = Object.create(null);

      if (node.id) {
        this.checkLVal(node.id, true, undefined, "function name");
      }

      for (var _i6 = 0, _node$params2 = node.params; _i6 < _node$params2.length; _i6++) {
        var param = _node$params2[_i6];

        if (isStrict && param.type !== "Identifier") {
          this.raise(param.start, "Non-simple parameter in strict mode");
        }

        this.checkLVal(param, true, nameHash, "function parameter list");
      }
    }

    this.state.strict = oldStrict;
  };

  _proto.parseExprList = function parseExprList(close, allowEmpty, refShorthandDefaultPos) {
    var elts = [];
    var first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(types.comma);
        if (this.eat(close)) break;
      }

      elts.push(this.parseExprListItem(allowEmpty, refShorthandDefaultPos));
    }

    return elts;
  };

  _proto.parseExprListItem = function parseExprListItem(allowEmpty, refShorthandDefaultPos, refNeedsArrowPos, refTrailingCommaPos) {
    var elt;

    if (allowEmpty && this.match(types.comma)) {
      elt = null;
    } else if (this.match(types.ellipsis)) {
      var spreadNodeStartPos = this.state.start;
      var spreadNodeStartLoc = this.state.startLoc;
      elt = this.parseParenItem(this.parseSpread(refShorthandDefaultPos, refNeedsArrowPos), spreadNodeStartPos, spreadNodeStartLoc);

      if (refTrailingCommaPos && this.match(types.comma)) {
        refTrailingCommaPos.start = this.state.start;
      }
    } else {
      elt = this.parseMaybeAssign(false, refShorthandDefaultPos, this.parseParenItem, refNeedsArrowPos);
    }

    return elt;
  };

  _proto.parseIdentifier = function parseIdentifier(liberal) {
    var node = this.startNode();
    var name = this.parseIdentifierName(node.start, liberal);
    return this.createIdentifier(node, name);
  };

  _proto.createIdentifier = function createIdentifier(node, name) {
    node.name = name;
    node.loc.identifierName = name;
    return this.finishNode(node, "Identifier");
  };

  _proto.parseIdentifierName = function parseIdentifierName(pos, liberal) {
    if (!liberal) {
      this.checkReservedWord(this.state.value, this.state.start, !!this.state.type.keyword, false);
    }

    var name;

    if (this.match(types.name)) {
      name = this.state.value;
    } else if (this.state.type.keyword) {
      name = this.state.type.keyword;

      if ((name === "class" || name === "function") && (this.state.lastTokEnd !== this.state.lastTokStart + 1 || this.input.charCodeAt(this.state.lastTokStart) !== 46)) {
        this.state.context.pop();
      }
    } else {
      throw this.unexpected();
    }

    if (!liberal && name === "await" && this.state.inAsync) {
      this.raise(pos, "invalid use of await inside of an async function");
    }

    this.next();
    return name;
  };

  _proto.checkReservedWord = function checkReservedWord(word, startLoc, checkKeywords, isBinding) {
    if (this.state.strict && (reservedWords.strict(word) || isBinding && reservedWords.strictBind(word))) {
      this.raise(startLoc, word + " is a reserved word in strict mode");
    }

    if (this.state.inGenerator && word === "yield") {
      this.raise(startLoc, "yield is a reserved word inside generator functions");
    }

    if (this.state.inClassProperty && word === "arguments") {
      this.raise(startLoc, "'arguments' is not allowed in class field initializer");
    }

    if (this.isReservedWord(word) || checkKeywords && this.isKeyword(word)) {
      this.raise(startLoc, word + " is a reserved word");
    }
  };

  _proto.parseAwait = function parseAwait(node) {
    if (!this.state.inAsync && (this.state.inFunction || !this.options.allowAwaitOutsideFunction)) {
      this.unexpected();
    }

    if (this.state.inParameters) {
      this.raise(node.start, "await is not allowed in async function parameters");
    }

    if (this.match(types.star)) {
      this.raise(node.start, "await* has been removed from the async functions proposal. Use Promise.all() instead.");
    }

    if (this.state.maybeInArrowParameters && !this.state.yieldOrAwaitInPossibleArrowParameters) {
      this.state.yieldOrAwaitInPossibleArrowParameters = node;
    }

    node.argument = this.parseMaybeUnary();
    return this.finishNode(node, "AwaitExpression");
  };

  _proto.parseYield = function parseYield() {
    var node = this.startNode();

    if (this.state.inParameters) {
      this.raise(node.start, "yield is not allowed in generator parameters");
    }

    if (this.state.maybeInArrowParameters && !this.state.yieldOrAwaitInPossibleArrowParameters) {
      this.state.yieldOrAwaitInPossibleArrowParameters = node;
    }

    this.next();

    if (this.match(types.semi) || this.canInsertSemicolon() || !this.match(types.star) && !this.state.type.startsExpr) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = this.eat(types.star);
      node.argument = this.parseMaybeAssign();
    }

    return this.finishNode(node, "YieldExpression");
  };

  _proto.checkPipelineAtInfixOperator = function checkPipelineAtInfixOperator(left, leftStartPos) {
    if (this.getPluginOption("pipelineOperator", "proposal") === "smart") {
      if (left.type === "SequenceExpression") {
        throw this.raise(leftStartPos, "Pipeline head should not be a comma-separated sequence expression");
      }
    }
  };

  _proto.parseSmartPipelineBody = function parseSmartPipelineBody(childExpression, startPos, startLoc) {
    var pipelineStyle = this.checkSmartPipelineBodyStyle(childExpression);
    this.checkSmartPipelineBodyEarlyErrors(childExpression, pipelineStyle, startPos);
    return this.parseSmartPipelineBodyInStyle(childExpression, pipelineStyle, startPos, startLoc);
  };

  _proto.checkSmartPipelineBodyEarlyErrors = function checkSmartPipelineBodyEarlyErrors(childExpression, pipelineStyle, startPos) {
    if (this.match(types.arrow)) {
      throw this.raise(this.state.start, "Unexpected arrow \"=>\" after pipeline body; arrow function in pipeline body must be parenthesized");
    } else if (pipelineStyle === "PipelineTopicExpression" && childExpression.type === "SequenceExpression") {
      throw this.raise(startPos, "Pipeline body may not be a comma-separated sequence expression");
    }
  };

  _proto.parseSmartPipelineBodyInStyle = function parseSmartPipelineBodyInStyle(childExpression, pipelineStyle, startPos, startLoc) {
    var bodyNode = this.startNodeAt(startPos, startLoc);

    switch (pipelineStyle) {
      case "PipelineBareFunction":
        bodyNode.callee = childExpression;
        break;

      case "PipelineBareConstructor":
        bodyNode.callee = childExpression.callee;
        break;

      case "PipelineBareAwaitedFunction":
        bodyNode.callee = childExpression.argument;
        break;

      case "PipelineTopicExpression":
        if (!this.topicReferenceWasUsedInCurrentTopicContext()) {
          throw this.raise(startPos, "Pipeline is in topic style but does not use topic reference");
        }

        bodyNode.expression = childExpression;
        break;

      default:
        throw this.raise(startPos, "Unknown pipeline style " + pipelineStyle);
    }

    return this.finishNode(bodyNode, pipelineStyle);
  };

  _proto.checkSmartPipelineBodyStyle = function checkSmartPipelineBodyStyle(expression) {
    switch (expression.type) {
      default:
        return this.isSimpleReference(expression) ? "PipelineBareFunction" : "PipelineTopicExpression";
    }
  };

  _proto.isSimpleReference = function isSimpleReference(expression) {
    switch (expression.type) {
      case "MemberExpression":
        return !expression.computed && this.isSimpleReference(expression.object);

      case "Identifier":
        return true;

      default:
        return false;
    }
  };

  _proto.withTopicPermittingContext = function withTopicPermittingContext(callback) {
    var outerContextTopicState = this.state.topicContext;
    this.state.topicContext = {
      maxNumOfResolvableTopics: 1,
      maxTopicIndex: null
    };

    try {
      return callback();
    } finally {
      this.state.topicContext = outerContextTopicState;
    }
  };

  _proto.withTopicForbiddingContext = function withTopicForbiddingContext(callback) {
    var outerContextTopicState = this.state.topicContext;
    this.state.topicContext = {
      maxNumOfResolvableTopics: 0,
      maxTopicIndex: null
    };

    try {
      return callback();
    } finally {
      this.state.topicContext = outerContextTopicState;
    }
  };

  _proto.registerTopicReference = function registerTopicReference() {
    this.state.topicContext.maxTopicIndex = 0;
  };

  _proto.primaryTopicReferenceIsAllowedInCurrentTopicContext = function primaryTopicReferenceIsAllowedInCurrentTopicContext() {
    return this.state.topicContext.maxNumOfResolvableTopics >= 1;
  };

  _proto.topicReferenceWasUsedInCurrentTopicContext = function topicReferenceWasUsedInCurrentTopicContext() {
    return this.state.topicContext.maxTopicIndex != null && this.state.topicContext.maxTopicIndex >= 0;
  };

  return ExpressionParser;
}(LValParser);

var empty = [];
var loopLabel = {
  kind: "loop"
};
var switchLabel = {
  kind: "switch"
};

var StatementParser = function (_ExpressionParser) {
  _inheritsLoose(StatementParser, _ExpressionParser);

  function StatementParser() {
    return _ExpressionParser.apply(this, arguments) || this;
  }

  var _proto = StatementParser.prototype;

  _proto.parseTopLevel = function parseTopLevel(file, program) {
    program.sourceType = this.options.sourceType;
    program.interpreter = this.parseInterpreterDirective();
    this.parseBlockBody(program, true, true, types.eof);
    file.program = this.finishNode(program, "Program");
    file.comments = this.state.comments;
    if (this.options.tokens) file.tokens = this.state.tokens;
    return this.finishNode(file, "File");
  };

  _proto.stmtToDirective = function stmtToDirective(stmt) {
    var expr = stmt.expression;
    var directiveLiteral = this.startNodeAt(expr.start, expr.loc.start);
    var directive = this.startNodeAt(stmt.start, stmt.loc.start);
    var raw = this.input.slice(expr.start, expr.end);
    var val = directiveLiteral.value = raw.slice(1, -1);
    this.addExtra(directiveLiteral, "raw", raw);
    this.addExtra(directiveLiteral, "rawValue", val);
    directive.value = this.finishNodeAt(directiveLiteral, "DirectiveLiteral", expr.end, expr.loc.end);
    return this.finishNodeAt(directive, "Directive", stmt.end, stmt.loc.end);
  };

  _proto.parseInterpreterDirective = function parseInterpreterDirective() {
    if (!this.match(types.interpreterDirective)) {
      return null;
    }

    var node = this.startNode();
    node.value = this.state.value;
    this.next();
    return this.finishNode(node, "InterpreterDirective");
  };

  _proto.parseStatement = function parseStatement(declaration, topLevel) {
    if (this.match(types.at)) {
      this.parseDecorators(true);
    }

    return this.parseStatementContent(declaration, topLevel);
  };

  _proto.parseStatementContent = function parseStatementContent(declaration, topLevel) {
    var starttype = this.state.type;
    var node = this.startNode();

    switch (starttype) {
      case types._break:
      case types._continue:
        return this.parseBreakContinueStatement(node, starttype.keyword);

      case types._debugger:
        return this.parseDebuggerStatement(node);

      case types._do:
        return this.parseDoStatement(node);

      case types._for:
        return this.parseForStatement(node);

      case types._function:
        if (this.lookahead().type === types.dot) break;
        if (!declaration) this.unexpected();
        return this.parseFunctionStatement(node);

      case types._class:
        if (!declaration) this.unexpected();
        return this.parseClass(node, true);

      case types._if:
        return this.parseIfStatement(node);

      case types._return:
        return this.parseReturnStatement(node);

      case types._switch:
        return this.parseSwitchStatement(node);

      case types._throw:
        return this.parseThrowStatement(node);

      case types._try:
        return this.parseTryStatement(node);

      case types._let:
      case types._const:
        if (!declaration) this.unexpected();

      case types._var:
        return this.parseVarStatement(node, starttype);

      case types._while:
        return this.parseWhileStatement(node);

      case types._with:
        return this.parseWithStatement(node);

      case types.braceL:
        return this.parseBlock();

      case types.semi:
        return this.parseEmptyStatement(node);

      case types._export:
      case types._import:
        {
          var nextToken = this.lookahead();

          if (nextToken.type === types.parenL || nextToken.type === types.dot) {
            break;
          }

          if (!this.options.allowImportExportEverywhere && !topLevel) {
            this.raise(this.state.start, "'import' and 'export' may only appear at the top level");
          }

          this.next();
          var result;

          if (starttype == types._import) {
            result = this.parseImport(node);

            if (result.type === "ImportDeclaration" && (!result.importKind || result.importKind === "value")) {
              this.sawUnambiguousESM = true;
            }
          } else {
            result = this.parseExport(node);

            if (result.type === "ExportNamedDeclaration" && (!result.exportKind || result.exportKind === "value") || result.type === "ExportAllDeclaration" && (!result.exportKind || result.exportKind === "value") || result.type === "ExportDefaultDeclaration") {
              this.sawUnambiguousESM = true;
            }
          }

          this.assertModuleNodeAllowed(node);
          return result;
        }

      case types.name:
        if (this.isContextual("async")) {
          var state = this.state.clone();
          this.next();

          if (this.match(types._function) && !this.canInsertSemicolon()) {
            this.expect(types._function);
            return this.parseFunction(node, true, false, true);
          } else {
            this.state = state;
          }
        }

    }

    var maybeName = this.state.value;
    var expr = this.parseExpression();

    if (starttype === types.name && expr.type === "Identifier" && this.eat(types.colon)) {
      return this.parseLabeledStatement(node, maybeName, expr);
    } else {
      return this.parseExpressionStatement(node, expr);
    }
  };

  _proto.assertModuleNodeAllowed = function assertModuleNodeAllowed(node) {
    if (!this.options.allowImportExportEverywhere && !this.inModule) {
      this.raise(node.start, "'import' and 'export' may appear only with 'sourceType: \"module\"'", {
        code: "BABEL_PARSER_SOURCETYPE_MODULE_REQUIRED"
      });
    }
  };

  _proto.takeDecorators = function takeDecorators(node) {
    var decorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    if (decorators.length) {
      node.decorators = decorators;
      this.resetStartLocationFromNode(node, decorators[0]);
      this.state.decoratorStack[this.state.decoratorStack.length - 1] = [];
    }
  };

  _proto.canHaveLeadingDecorator = function canHaveLeadingDecorator() {
    return this.match(types._class);
  };

  _proto.parseDecorators = function parseDecorators(allowExport) {
    var currentContextDecorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    while (this.match(types.at)) {
      var decorator = this.parseDecorator();
      currentContextDecorators.push(decorator);
    }

    if (this.match(types._export)) {
      if (!allowExport) {
        this.unexpected();
      }

      if (this.hasPlugin("decorators") && !this.getPluginOption("decorators", "decoratorsBeforeExport")) {
        this.raise(this.state.start, "Using the export keyword between a decorator and a class is not allowed. " + "Please use `export @dec class` instead.");
      }
    } else if (!this.canHaveLeadingDecorator()) {
      this.raise(this.state.start, "Leading decorators must be attached to a class declaration");
    }
  };

  _proto.parseDecorator = function parseDecorator() {
    this.expectOnePlugin(["decorators-legacy", "decorators"]);
    var node = this.startNode();
    this.next();

    if (this.hasPlugin("decorators")) {
      this.state.decoratorStack.push([]);
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;
      var expr;

      if (this.eat(types.parenL)) {
        expr = this.parseExpression();
        this.expect(types.parenR);
      } else {
        expr = this.parseIdentifier(false);

        while (this.eat(types.dot)) {
          var _node = this.startNodeAt(startPos, startLoc);

          _node.object = expr;
          _node.property = this.parseIdentifier(true);
          _node.computed = false;
          expr = this.finishNode(_node, "MemberExpression");
        }
      }

      node.expression = this.parseMaybeDecoratorArguments(expr);
      this.state.decoratorStack.pop();
    } else {
      node.expression = this.parseMaybeAssign();
    }

    return this.finishNode(node, "Decorator");
  };

  _proto.parseMaybeDecoratorArguments = function parseMaybeDecoratorArguments(expr) {
    if (this.eat(types.parenL)) {
      var node = this.startNodeAtNode(expr);
      node.callee = expr;
      node.arguments = this.parseCallExpressionArguments(types.parenR, false);
      this.toReferencedList(node.arguments);
      return this.finishNode(node, "CallExpression");
    }

    return expr;
  };

  _proto.parseBreakContinueStatement = function parseBreakContinueStatement(node, keyword) {
    var isBreak = keyword === "break";
    this.next();

    if (this.isLineTerminator()) {
      node.label = null;
    } else if (!this.match(types.name)) {
      this.unexpected();
    } else {
      node.label = this.parseIdentifier();
      this.semicolon();
    }

    var i;

    for (i = 0; i < this.state.labels.length; ++i) {
      var lab = this.state.labels[i];

      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
        if (node.label && isBreak) break;
      }
    }

    if (i === this.state.labels.length) {
      this.raise(node.start, "Unsyntactic " + keyword);
    }

    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
  };

  _proto.parseDebuggerStatement = function parseDebuggerStatement(node) {
    this.next();
    this.semicolon();
    return this.finishNode(node, "DebuggerStatement");
  };

  _proto.parseDoStatement = function parseDoStatement(node) {
    var _this = this;

    this.next();
    this.state.labels.push(loopLabel);
    node.body = this.withTopicForbiddingContext(function () {
      return _this.parseStatement(false);
    });
    this.state.labels.pop();
    this.expect(types._while);
    node.test = this.parseParenExpression();
    this.eat(types.semi);
    return this.finishNode(node, "DoWhileStatement");
  };

  _proto.parseForStatement = function parseForStatement(node) {
    this.next();
    this.state.labels.push(loopLabel);
    var forAwait = false;

    if (this.state.inAsync && this.isContextual("await")) {
      forAwait = true;
      this.next();
    }

    this.expect(types.parenL);

    if (this.match(types.semi)) {
      if (forAwait) {
        this.unexpected();
      }

      return this.parseFor(node, null);
    }

    if (this.match(types._var) || this.match(types._let) || this.match(types._const)) {
      var _init = this.startNode();

      var varKind = this.state.type;
      this.next();
      this.parseVar(_init, true, varKind);
      this.finishNode(_init, "VariableDeclaration");

      if (this.match(types._in) || this.isContextual("of")) {
        if (_init.declarations.length === 1) {
          var declaration = _init.declarations[0];
          var isForInInitializer = varKind === types._var && declaration.init && declaration.id.type != "ObjectPattern" && declaration.id.type != "ArrayPattern" && !this.isContextual("of");

          if (this.state.strict && isForInInitializer) {
            this.raise(this.state.start, "for-in initializer in strict mode");
          } else if (isForInInitializer || !declaration.init) {
            return this.parseForIn(node, _init, forAwait);
          }
        }
      }

      if (forAwait) {
        this.unexpected();
      }

      return this.parseFor(node, _init);
    }

    var refShorthandDefaultPos = {
      start: 0
    };
    var init = this.parseExpression(true, refShorthandDefaultPos);

    if (this.match(types._in) || this.isContextual("of")) {
      var description = this.isContextual("of") ? "for-of statement" : "for-in statement";
      this.toAssignable(init, undefined, description);
      this.checkLVal(init, undefined, undefined, description);
      return this.parseForIn(node, init, forAwait);
    } else if (refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }

    if (forAwait) {
      this.unexpected();
    }

    return this.parseFor(node, init);
  };

  _proto.parseFunctionStatement = function parseFunctionStatement(node) {
    this.next();
    return this.parseFunction(node, true);
  };

  _proto.parseIfStatement = function parseIfStatement(node) {
    this.next();
    node.test = this.parseParenExpression();
    node.consequent = this.parseStatement(false);
    node.alternate = this.eat(types._else) ? this.parseStatement(false) : null;
    return this.finishNode(node, "IfStatement");
  };

  _proto.parseReturnStatement = function parseReturnStatement(node) {
    if (!this.state.inFunction && !this.options.allowReturnOutsideFunction) {
      this.raise(this.state.start, "'return' outside of function");
    }

    this.next();

    if (this.isLineTerminator()) {
      node.argument = null;
    } else {
      node.argument = this.parseExpression();
      this.semicolon();
    }

    return this.finishNode(node, "ReturnStatement");
  };

  _proto.parseSwitchStatement = function parseSwitchStatement(node) {
    this.next();
    node.discriminant = this.parseParenExpression();
    var cases = node.cases = [];
    this.expect(types.braceL);
    this.state.labels.push(switchLabel);
    var cur;

    for (var sawDefault; !this.match(types.braceR);) {
      if (this.match(types._case) || this.match(types._default)) {
        var isCase = this.match(types._case);
        if (cur) this.finishNode(cur, "SwitchCase");
        cases.push(cur = this.startNode());
        cur.consequent = [];
        this.next();

        if (isCase) {
          cur.test = this.parseExpression();
        } else {
          if (sawDefault) {
            this.raise(this.state.lastTokStart, "Multiple default clauses");
          }

          sawDefault = true;
          cur.test = null;
        }

        this.expect(types.colon);
      } else {
        if (cur) {
          cur.consequent.push(this.parseStatement(true));
        } else {
          this.unexpected();
        }
      }
    }

    if (cur) this.finishNode(cur, "SwitchCase");
    this.next();
    this.state.labels.pop();
    return this.finishNode(node, "SwitchStatement");
  };

  _proto.parseThrowStatement = function parseThrowStatement(node) {
    this.next();

    if (lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start))) {
      this.raise(this.state.lastTokEnd, "Illegal newline after throw");
    }

    node.argument = this.parseExpression();
    this.semicolon();
    return this.finishNode(node, "ThrowStatement");
  };

  _proto.parseTryStatement = function parseTryStatement(node) {
    var _this2 = this;

    this.next();
    node.block = this.parseBlock();
    node.handler = null;

    if (this.match(types._catch)) {
      var clause = this.startNode();
      this.next();

      if (this.match(types.parenL)) {
        this.expect(types.parenL);
        clause.param = this.parseBindingAtom();
        var clashes = Object.create(null);
        this.checkLVal(clause.param, true, clashes, "catch clause");
        this.expect(types.parenR);
      } else {
        clause.param = null;
      }

      clause.body = this.withTopicForbiddingContext(function () {
        return _this2.parseBlock(false);
      });
      node.handler = this.finishNode(clause, "CatchClause");
    }

    node.guardedHandlers = empty;
    node.finalizer = this.eat(types._finally) ? this.parseBlock() : null;

    if (!node.handler && !node.finalizer) {
      this.raise(node.start, "Missing catch or finally clause");
    }

    return this.finishNode(node, "TryStatement");
  };

  _proto.parseVarStatement = function parseVarStatement(node, kind) {
    this.next();
    this.parseVar(node, false, kind);
    this.semicolon();
    return this.finishNode(node, "VariableDeclaration");
  };

  _proto.parseWhileStatement = function parseWhileStatement(node) {
    var _this3 = this;

    this.next();
    node.test = this.parseParenExpression();
    this.state.labels.push(loopLabel);
    node.body = this.withTopicForbiddingContext(function () {
      return _this3.parseStatement(false);
    });
    this.state.labels.pop();
    return this.finishNode(node, "WhileStatement");
  };

  _proto.parseWithStatement = function parseWithStatement(node) {
    var _this4 = this;

    if (this.state.strict) {
      this.raise(this.state.start, "'with' in strict mode");
    }

    this.next();
    node.object = this.parseParenExpression();
    node.body = this.withTopicForbiddingContext(function () {
      return _this4.parseStatement(false);
    });
    return this.finishNode(node, "WithStatement");
  };

  _proto.parseEmptyStatement = function parseEmptyStatement(node) {
    this.next();
    return this.finishNode(node, "EmptyStatement");
  };

  _proto.parseLabeledStatement = function parseLabeledStatement(node, maybeName, expr) {
    for (var _i2 = 0, _this$state$labels2 = this.state.labels; _i2 < _this$state$labels2.length; _i2++) {
      var label = _this$state$labels2[_i2];

      if (label.name === maybeName) {
        this.raise(expr.start, "Label '" + maybeName + "' is already declared");
      }
    }

    var kind = this.state.type.isLoop ? "loop" : this.match(types._switch) ? "switch" : null;

    for (var i = this.state.labels.length - 1; i >= 0; i--) {
      var _label = this.state.labels[i];

      if (_label.statementStart === node.start) {
        _label.statementStart = this.state.start;
        _label.kind = kind;
      } else {
        break;
      }
    }

    this.state.labels.push({
      name: maybeName,
      kind: kind,
      statementStart: this.state.start
    });
    node.body = this.parseStatement(true);

    if (node.body.type == "ClassDeclaration" || node.body.type == "VariableDeclaration" && node.body.kind !== "var" || node.body.type == "FunctionDeclaration" && (this.state.strict || node.body.generator || node.body.async)) {
      this.raise(node.body.start, "Invalid labeled declaration");
    }

    this.state.labels.pop();
    node.label = expr;
    return this.finishNode(node, "LabeledStatement");
  };

  _proto.parseExpressionStatement = function parseExpressionStatement(node, expr) {
    node.expression = expr;
    this.semicolon();
    return this.finishNode(node, "ExpressionStatement");
  };

  _proto.parseBlock = function parseBlock(allowDirectives) {
    var node = this.startNode();
    this.expect(types.braceL);
    this.parseBlockBody(node, allowDirectives, false, types.braceR);
    return this.finishNode(node, "BlockStatement");
  };

  _proto.isValidDirective = function isValidDirective(stmt) {
    return stmt.type === "ExpressionStatement" && stmt.expression.type === "StringLiteral" && !stmt.expression.extra.parenthesized;
  };

  _proto.parseBlockBody = function parseBlockBody(node, allowDirectives, topLevel, end) {
    var body = node.body = [];
    var directives = node.directives = [];
    this.parseBlockOrModuleBlockBody(body, allowDirectives ? directives : undefined, topLevel, end);
  };

  _proto.parseBlockOrModuleBlockBody = function parseBlockOrModuleBlockBody(body, directives, topLevel, end) {
    var parsedNonDirective = false;
    var oldStrict;
    var octalPosition;

    while (!this.eat(end)) {
      if (!parsedNonDirective && this.state.containsOctal && !octalPosition) {
        octalPosition = this.state.octalPosition;
      }

      var stmt = this.parseStatement(true, topLevel);

      if (directives && !parsedNonDirective && this.isValidDirective(stmt)) {
        var directive = this.stmtToDirective(stmt);
        directives.push(directive);

        if (oldStrict === undefined && directive.value.value === "use strict") {
          oldStrict = this.state.strict;
          this.setStrict(true);

          if (octalPosition) {
            this.raise(octalPosition, "Octal literal in strict mode");
          }
        }

        continue;
      }

      parsedNonDirective = true;
      body.push(stmt);
    }

    if (oldStrict === false) {
      this.setStrict(false);
    }
  };

  _proto.parseFor = function parseFor(node, init) {
    var _this5 = this;

    node.init = init;
    this.expect(types.semi);
    node.test = this.match(types.semi) ? null : this.parseExpression();
    this.expect(types.semi);
    node.update = this.match(types.parenR) ? null : this.parseExpression();
    this.expect(types.parenR);
    node.body = this.withTopicForbiddingContext(function () {
      return _this5.parseStatement(false);
    });
    this.state.labels.pop();
    return this.finishNode(node, "ForStatement");
  };

  _proto.parseForIn = function parseForIn(node, init, forAwait) {
    var _this6 = this;

    var type = this.match(types._in) ? "ForInStatement" : "ForOfStatement";

    if (forAwait) {
      this.eatContextual("of");
    } else {
      this.next();
    }

    if (type === "ForOfStatement") {
      node.await = !!forAwait;
    }

    node.left = init;
    node.right = this.parseExpression();
    this.expect(types.parenR);
    node.body = this.withTopicForbiddingContext(function () {
      return _this6.parseStatement(false);
    });
    this.state.labels.pop();
    return this.finishNode(node, type);
  };

  _proto.parseVar = function parseVar(node, isFor, kind) {
    var declarations = node.declarations = [];
    node.kind = kind.keyword;

    for (;;) {
      var decl = this.startNode();
      this.parseVarHead(decl);

      if (this.eat(types.eq)) {
        decl.init = this.parseMaybeAssign(isFor);
      } else {
        if (kind === types._const && !(this.match(types._in) || this.isContextual("of"))) {
          if (!this.hasPlugin("typescript")) {
            this.unexpected();
          }
        } else if (decl.id.type !== "Identifier" && !(isFor && (this.match(types._in) || this.isContextual("of")))) {
          this.raise(this.state.lastTokEnd, "Complex binding patterns require an initialization value");
        }

        decl.init = null;
      }

      declarations.push(this.finishNode(decl, "VariableDeclarator"));
      if (!this.eat(types.comma)) break;
    }

    return node;
  };

  _proto.parseVarHead = function parseVarHead(decl) {
    decl.id = this.parseBindingAtom();
    this.checkLVal(decl.id, true, undefined, "variable declaration");
  };

  _proto.parseFunction = function parseFunction(node, isStatement, allowExpressionBody, isAsync, optionalId) {
    var _this7 = this;

    if (allowExpressionBody === void 0) {
      allowExpressionBody = false;
    }

    if (isAsync === void 0) {
      isAsync = false;
    }

    if (optionalId === void 0) {
      optionalId = false;
    }

    var oldInFunc = this.state.inFunction;
    var oldInMethod = this.state.inMethod;
    var oldInAsync = this.state.inAsync;
    var oldInGenerator = this.state.inGenerator;
    var oldInClassProperty = this.state.inClassProperty;
    this.state.inFunction = true;
    this.state.inMethod = false;
    this.state.inClassProperty = false;
    this.initFunction(node, isAsync);

    if (this.match(types.star)) {
      node.generator = true;
      this.next();
    }

    if (isStatement && !optionalId && !this.match(types.name) && !this.match(types._yield)) {
      this.unexpected();
    }

    if (!isStatement) {
      this.state.inAsync = isAsync;
      this.state.inGenerator = node.generator;
    }

    if (this.match(types.name) || this.match(types._yield)) {
      node.id = this.parseBindingIdentifier();
    }

    if (isStatement) {
      this.state.inAsync = isAsync;
      this.state.inGenerator = node.generator;
    }

    this.parseFunctionParams(node);
    this.withTopicForbiddingContext(function () {
      _this7.parseFunctionBodyAndFinish(node, isStatement ? "FunctionDeclaration" : "FunctionExpression", allowExpressionBody);
    });
    this.state.inFunction = oldInFunc;
    this.state.inMethod = oldInMethod;
    this.state.inAsync = oldInAsync;
    this.state.inGenerator = oldInGenerator;
    this.state.inClassProperty = oldInClassProperty;
    return node;
  };

  _proto.parseFunctionParams = function parseFunctionParams(node, allowModifiers) {
    var oldInParameters = this.state.inParameters;
    this.state.inParameters = true;
    this.expect(types.parenL);
    node.params = this.parseBindingList(types.parenR, false, allowModifiers);
    this.state.inParameters = oldInParameters;
  };

  _proto.parseClass = function parseClass(node, isStatement, optionalId) {
    this.next();
    this.takeDecorators(node);
    this.parseClassId(node, isStatement, optionalId);
    this.parseClassSuper(node);
    this.parseClassBody(node);
    return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
  };

  _proto.isClassProperty = function isClassProperty() {
    return this.match(types.eq) || this.match(types.semi) || this.match(types.braceR);
  };

  _proto.isClassMethod = function isClassMethod() {
    return this.match(types.parenL);
  };

  _proto.isNonstaticConstructor = function isNonstaticConstructor(method) {
    return !method.computed && !method.static && (method.key.name === "constructor" || method.key.value === "constructor");
  };

  _proto.parseClassBody = function parseClassBody(node) {
    var _this8 = this;

    var oldStrict = this.state.strict;
    this.state.strict = true;
    this.state.classLevel++;
    var state = {
      hadConstructor: false
    };
    var decorators = [];
    var classBody = this.startNode();
    classBody.body = [];
    this.expect(types.braceL);
    this.withTopicForbiddingContext(function () {
      while (!_this8.eat(types.braceR)) {
        if (_this8.eat(types.semi)) {
          if (decorators.length > 0) {
            _this8.raise(_this8.state.lastTokEnd, "Decorators must not be followed by a semicolon");
          }

          continue;
        }

        if (_this8.match(types.at)) {
          decorators.push(_this8.parseDecorator());
          continue;
        }

        var member = _this8.startNode();

        if (decorators.length) {
          member.decorators = decorators;

          _this8.resetStartLocationFromNode(member, decorators[0]);

          decorators = [];
        }

        _this8.parseClassMember(classBody, member, state);

        if (member.kind === "constructor" && member.decorators && member.decorators.length > 0) {
          _this8.raise(member.start, "Decorators can't be used with a constructor. Did you mean '@dec class { ... }'?");
        }
      }
    });

    if (decorators.length) {
      this.raise(this.state.start, "You have trailing decorators with no method");
    }

    node.body = this.finishNode(classBody, "ClassBody");
    this.state.classLevel--;
    this.state.strict = oldStrict;
  };

  _proto.parseClassMember = function parseClassMember(classBody, member, state) {
    var isStatic = false;
    var containsEsc = this.state.containsEsc;

    if (this.match(types.name) && this.state.value === "static") {
      var key = this.parseIdentifier(true);

      if (this.isClassMethod()) {
        var method = member;
        method.kind = "method";
        method.computed = false;
        method.key = key;
        method.static = false;
        this.pushClassMethod(classBody, method, false, false, false);
        return;
      } else if (this.isClassProperty()) {
        var prop = member;
        prop.computed = false;
        prop.key = key;
        prop.static = false;
        classBody.body.push(this.parseClassProperty(prop));
        return;
      } else if (containsEsc) {
        throw this.unexpected();
      }

      isStatic = true;
    }

    this.parseClassMemberWithIsStatic(classBody, member, state, isStatic);
  };

  _proto.parseClassMemberWithIsStatic = function parseClassMemberWithIsStatic(classBody, member, state, isStatic) {
    var publicMethod = member;
    var privateMethod = member;
    var publicProp = member;
    var privateProp = member;
    var method = publicMethod;
    var publicMember = publicMethod;
    member.static = isStatic;

    if (this.eat(types.star)) {
      method.kind = "method";
      this.parseClassPropertyName(method);

      if (method.key.type === "PrivateName") {
        this.pushClassPrivateMethod(classBody, privateMethod, true, false);
        return;
      }

      if (this.isNonstaticConstructor(publicMethod)) {
        this.raise(publicMethod.key.start, "Constructor can't be a generator");
      }

      this.pushClassMethod(classBody, publicMethod, true, false, false);
      return;
    }

    var key = this.parseClassPropertyName(member);
    var isPrivate = key.type === "PrivateName";
    var isSimple = key.type === "Identifier";
    this.parsePostMemberNameModifiers(publicMember);

    if (this.isClassMethod()) {
      method.kind = "method";

      if (isPrivate) {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
        return;
      }

      var isConstructor = this.isNonstaticConstructor(publicMethod);

      if (isConstructor) {
        publicMethod.kind = "constructor";

        if (publicMethod.decorators) {
          this.raise(publicMethod.start, "You can't attach decorators to a class constructor");
        }

        if (state.hadConstructor && !this.hasPlugin("typescript")) {
          this.raise(key.start, "Duplicate constructor in the same class");
        }

        state.hadConstructor = true;
      }

      this.pushClassMethod(classBody, publicMethod, false, false, isConstructor);
    } else if (this.isClassProperty()) {
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else if (isSimple && key.name === "async" && !this.isLineTerminator()) {
      var isGenerator = this.eat(types.star);
      method.kind = "method";
      this.parseClassPropertyName(method);

      if (method.key.type === "PrivateName") {
        this.pushClassPrivateMethod(classBody, privateMethod, isGenerator, true);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, "Constructor can't be an async function");
        }

        this.pushClassMethod(classBody, publicMethod, isGenerator, true, false);
      }
    } else if (isSimple && (key.name === "get" || key.name === "set") && !(this.isLineTerminator() && this.match(types.star))) {
      method.kind = key.name;
      this.parseClassPropertyName(publicMethod);

      if (method.key.type === "PrivateName") {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, "Constructor can't have get/set modifier");
        }

        this.pushClassMethod(classBody, publicMethod, false, false, false);
      }

      this.checkGetterSetterParams(publicMethod);
    } else if (this.isLineTerminator()) {
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else {
      this.unexpected();
    }
  };

  _proto.parseClassPropertyName = function parseClassPropertyName(member) {
    var key = this.parsePropertyName(member);

    if (!member.computed && member.static && (key.name === "prototype" || key.value === "prototype")) {
      this.raise(key.start, "Classes may not have static property named prototype");
    }

    if (key.type === "PrivateName" && key.id.name === "constructor") {
      this.raise(key.start, "Classes may not have a private field named '#constructor'");
    }

    return key;
  };

  _proto.pushClassProperty = function pushClassProperty(classBody, prop) {
    if (this.isNonstaticConstructor(prop)) {
      this.raise(prop.key.start, "Classes may not have a non-static field named 'constructor'");
    }

    classBody.body.push(this.parseClassProperty(prop));
  };

  _proto.pushClassPrivateProperty = function pushClassPrivateProperty(classBody, prop) {
    this.expectPlugin("classPrivateProperties", prop.key.start);
    classBody.body.push(this.parseClassPrivateProperty(prop));
  };

  _proto.pushClassMethod = function pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor) {
    classBody.body.push(this.parseMethod(method, isGenerator, isAsync, isConstructor, "ClassMethod"));
  };

  _proto.pushClassPrivateMethod = function pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
    this.expectPlugin("classPrivateMethods", method.key.start);
    classBody.body.push(this.parseMethod(method, isGenerator, isAsync, false, "ClassPrivateMethod"));
  };

  _proto.parsePostMemberNameModifiers = function parsePostMemberNameModifiers(methodOrProp) {};

  _proto.parseAccessModifier = function parseAccessModifier() {
    return undefined;
  };

  _proto.parseClassPrivateProperty = function parseClassPrivateProperty(node) {
    var oldInMethod = this.state.inMethod;
    this.state.inMethod = false;
    this.state.inClassProperty = true;
    node.value = this.eat(types.eq) ? this.parseMaybeAssign() : null;
    this.semicolon();
    this.state.inClassProperty = false;
    this.state.inMethod = oldInMethod;
    return this.finishNode(node, "ClassPrivateProperty");
  };

  _proto.parseClassProperty = function parseClassProperty(node) {
    if (!node.typeAnnotation) {
      this.expectPlugin("classProperties");
    }

    var oldInMethod = this.state.inMethod;
    this.state.inMethod = false;
    this.state.inClassProperty = true;

    if (this.match(types.eq)) {
      this.expectPlugin("classProperties");
      this.next();
      node.value = this.parseMaybeAssign();
    } else {
      node.value = null;
    }

    this.semicolon();
    this.state.inClassProperty = false;
    this.state.inMethod = oldInMethod;
    return this.finishNode(node, "ClassProperty");
  };

  _proto.parseClassId = function parseClassId(node, isStatement, optionalId) {
    if (this.match(types.name)) {
      node.id = this.parseIdentifier();
    } else {
      if (optionalId || !isStatement) {
        node.id = null;
      } else {
        this.unexpected(null, "A class name is required");
      }
    }
  };

  _proto.parseClassSuper = function parseClassSuper(node) {
    node.superClass = this.eat(types._extends) ? this.parseExprSubscripts() : null;
  };

  _proto.parseExport = function parseExport(node) {
    if (this.shouldParseExportStar()) {
      this.parseExportStar(node);
      if (node.type === "ExportAllDeclaration") return node;
    } else if (this.isExportDefaultSpecifier()) {
      this.expectPlugin("exportDefaultFrom");
      var specifier = this.startNode();
      specifier.exported = this.parseIdentifier(true);
      var specifiers = [this.finishNode(specifier, "ExportDefaultSpecifier")];
      node.specifiers = specifiers;

      if (this.match(types.comma) && this.lookahead().type === types.star) {
        this.expect(types.comma);

        var _specifier = this.startNode();

        this.expect(types.star);
        this.expectContextual("as");
        _specifier.exported = this.parseIdentifier();
        specifiers.push(this.finishNode(_specifier, "ExportNamespaceSpecifier"));
      } else {
        this.parseExportSpecifiersMaybe(node);
      }

      this.parseExportFrom(node, true);
    } else if (this.eat(types._default)) {
      node.declaration = this.parseExportDefaultExpression();
      this.checkExport(node, true, true);
      return this.finishNode(node, "ExportDefaultDeclaration");
    } else if (this.shouldParseExportDeclaration()) {
      if (this.isContextual("async")) {
        var next = this.lookahead();

        if (next.type !== types._function) {
          this.unexpected(next.start, "Unexpected token, expected \"function\"");
        }
      }

      node.specifiers = [];
      node.source = null;
      node.declaration = this.parseExportDeclaration(node);
    } else {
      node.declaration = null;
      node.specifiers = this.parseExportSpecifiers();
      this.parseExportFrom(node);
    }

    this.checkExport(node, true);
    return this.finishNode(node, "ExportNamedDeclaration");
  };

  _proto.isAsyncFunction = function isAsyncFunction() {
    if (!this.isContextual("async")) return false;
    var _this$state = this.state,
        input = _this$state.input,
        pos = _this$state.pos;
    skipWhiteSpace.lastIndex = pos;
    var skip = skipWhiteSpace.exec(input);
    if (!skip || !skip.length) return false;
    var next = pos + skip[0].length;
    return !lineBreak.test(input.slice(pos, next)) && input.slice(next, next + 8) === "function" && (next + 8 === input.length || !isIdentifierChar(input.charAt(next + 8)));
  };

  _proto.parseExportDefaultExpression = function parseExportDefaultExpression() {
    var expr = this.startNode();
    var isAsync = this.isAsyncFunction();

    if (this.eat(types._function) || isAsync) {
      if (isAsync) {
        this.eatContextual("async");
        this.expect(types._function);
      }

      return this.parseFunction(expr, true, false, isAsync, true);
    } else if (this.match(types._class)) {
      return this.parseClass(expr, true, true);
    } else if (this.match(types.at)) {
      if (this.hasPlugin("decorators") && this.getPluginOption("decorators", "decoratorsBeforeExport")) {
        this.unexpected(this.state.start, "Decorators must be placed *before* the 'export' keyword." + " You can set the 'decoratorsBeforeExport' option to false to use" + " the 'export @decorator class {}' syntax");
      }

      this.parseDecorators(false);
      return this.parseClass(expr, true, true);
    } else if (this.match(types._let) || this.match(types._const) || this.match(types._var)) {
      return this.raise(this.state.start, "Only expressions, functions or classes are allowed as the `default` export.");
    } else {
      var res = this.parseMaybeAssign();
      this.semicolon();
      return res;
    }
  };

  _proto.parseExportDeclaration = function parseExportDeclaration(node) {
    return this.parseStatement(true);
  };

  _proto.isExportDefaultSpecifier = function isExportDefaultSpecifier() {
    if (this.match(types.name)) {
      return this.state.value !== "async";
    }

    if (!this.match(types._default)) {
      return false;
    }

    var lookahead = this.lookahead();
    return lookahead.type === types.comma || lookahead.type === types.name && lookahead.value === "from";
  };

  _proto.parseExportSpecifiersMaybe = function parseExportSpecifiersMaybe(node) {
    if (this.eat(types.comma)) {
      node.specifiers = node.specifiers.concat(this.parseExportSpecifiers());
    }
  };

  _proto.parseExportFrom = function parseExportFrom(node, expect) {
    if (this.eatContextual("from")) {
      node.source = this.match(types.string) ? this.parseExprAtom() : this.unexpected();
      this.checkExport(node);
    } else {
      if (expect) {
        this.unexpected();
      } else {
        node.source = null;
      }
    }

    this.semicolon();
  };

  _proto.shouldParseExportStar = function shouldParseExportStar() {
    return this.match(types.star);
  };

  _proto.parseExportStar = function parseExportStar(node) {
    this.expect(types.star);

    if (this.isContextual("as")) {
      this.parseExportNamespace(node);
    } else {
      this.parseExportFrom(node, true);
      this.finishNode(node, "ExportAllDeclaration");
    }
  };

  _proto.parseExportNamespace = function parseExportNamespace(node) {
    this.expectPlugin("exportNamespaceFrom");
    var specifier = this.startNodeAt(this.state.lastTokStart, this.state.lastTokStartLoc);
    this.next();
    specifier.exported = this.parseIdentifier(true);
    node.specifiers = [this.finishNode(specifier, "ExportNamespaceSpecifier")];
    this.parseExportSpecifiersMaybe(node);
    this.parseExportFrom(node, true);
  };

  _proto.shouldParseExportDeclaration = function shouldParseExportDeclaration() {
    if (this.match(types.at)) {
      this.expectOnePlugin(["decorators", "decorators-legacy"]);

      if (this.hasPlugin("decorators")) {
        if (this.getPluginOption("decorators", "decoratorsBeforeExport")) {
          this.unexpected(this.state.start, "Decorators must be placed *before* the 'export' keyword." + " You can set the 'decoratorsBeforeExport' option to false to use" + " the 'export @decorator class {}' syntax");
        } else {
          return true;
        }
      }
    }

    return this.state.type.keyword === "var" || this.state.type.keyword === "const" || this.state.type.keyword === "let" || this.state.type.keyword === "function" || this.state.type.keyword === "class" || this.isAsyncFunction();
  };

  _proto.checkExport = function checkExport(node, checkNames, isDefault) {
    if (checkNames) {
      if (isDefault) {
        this.checkDuplicateExports(node, "default");
      } else if (node.specifiers && node.specifiers.length) {
        for (var _i4 = 0, _node$specifiers2 = node.specifiers; _i4 < _node$specifiers2.length; _i4++) {
          var specifier = _node$specifiers2[_i4];
          this.checkDuplicateExports(specifier, specifier.exported.name);
        }
      } else if (node.declaration) {
        if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
          var id = node.declaration.id;
          if (!id) throw new Error("Assertion failure");
          this.checkDuplicateExports(node, id.name);
        } else if (node.declaration.type === "VariableDeclaration") {
          for (var _i6 = 0, _node$declaration$dec2 = node.declaration.declarations; _i6 < _node$declaration$dec2.length; _i6++) {
            var declaration = _node$declaration$dec2[_i6];
            this.checkDeclaration(declaration.id);
          }
        }
      }
    }

    var currentContextDecorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    if (currentContextDecorators.length) {
      var isClass = node.declaration && (node.declaration.type === "ClassDeclaration" || node.declaration.type === "ClassExpression");

      if (!node.declaration || !isClass) {
        throw this.raise(node.start, "You can only use decorators on an export when exporting a class");
      }

      this.takeDecorators(node.declaration);
    }
  };

  _proto.checkDeclaration = function checkDeclaration(node) {
    if (node.type === "ObjectPattern") {
      for (var _i8 = 0, _node$properties2 = node.properties; _i8 < _node$properties2.length; _i8++) {
        var prop = _node$properties2[_i8];
        this.checkDeclaration(prop);
      }
    } else if (node.type === "ArrayPattern") {
      for (var _i10 = 0, _node$elements2 = node.elements; _i10 < _node$elements2.length; _i10++) {
        var elem = _node$elements2[_i10];

        if (elem) {
          this.checkDeclaration(elem);
        }
      }
    } else if (node.type === "ObjectProperty") {
      this.checkDeclaration(node.value);
    } else if (node.type === "RestElement") {
      this.checkDeclaration(node.argument);
    } else if (node.type === "Identifier") {
      this.checkDuplicateExports(node, node.name);
    }
  };

  _proto.checkDuplicateExports = function checkDuplicateExports(node, name) {
    if (this.state.exportedIdentifiers.indexOf(name) > -1) {
      this.raiseDuplicateExportError(node, name);
    }

    this.state.exportedIdentifiers.push(name);
  };

  _proto.raiseDuplicateExportError = function raiseDuplicateExportError(node, name) {
    throw this.raise(node.start, name === "default" ? "Only one default export allowed per module." : "`" + name + "` has already been exported. Exported identifiers must be unique.");
  };

  _proto.parseExportSpecifiers = function parseExportSpecifiers() {
    var nodes = [];
    var first = true;
    var needsFrom;
    this.expect(types.braceL);

    while (!this.eat(types.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(types.comma);
        if (this.eat(types.braceR)) break;
      }

      var isDefault = this.match(types._default);
      if (isDefault && !needsFrom) needsFrom = true;
      var node = this.startNode();
      node.local = this.parseIdentifier(isDefault);
      node.exported = this.eatContextual("as") ? this.parseIdentifier(true) : node.local.__clone();
      nodes.push(this.finishNode(node, "ExportSpecifier"));
    }

    if (needsFrom && !this.isContextual("from")) {
      this.unexpected();
    }

    return nodes;
  };

  _proto.parseImport = function parseImport(node) {
    if (this.match(types.string)) {
      node.specifiers = [];
      node.source = this.parseExprAtom();
    } else {
      node.specifiers = [];
      this.parseImportSpecifiers(node);
      this.expectContextual("from");
      node.source = this.match(types.string) ? this.parseExprAtom() : this.unexpected();
    }

    this.semicolon();
    return this.finishNode(node, "ImportDeclaration");
  };

  _proto.shouldParseDefaultImport = function shouldParseDefaultImport(node) {
    return this.match(types.name);
  };

  _proto.parseImportSpecifierLocal = function parseImportSpecifierLocal(node, specifier, type, contextDescription) {
    specifier.local = this.parseIdentifier();
    this.checkLVal(specifier.local, true, undefined, contextDescription);
    node.specifiers.push(this.finishNode(specifier, type));
  };

  _proto.parseImportSpecifiers = function parseImportSpecifiers(node) {
    var first = true;

    if (this.shouldParseDefaultImport(node)) {
      this.parseImportSpecifierLocal(node, this.startNode(), "ImportDefaultSpecifier", "default import specifier");
      if (!this.eat(types.comma)) return;
    }

    if (this.match(types.star)) {
      var specifier = this.startNode();
      this.next();
      this.expectContextual("as");
      this.parseImportSpecifierLocal(node, specifier, "ImportNamespaceSpecifier", "import namespace specifier");
      return;
    }

    this.expect(types.braceL);

    while (!this.eat(types.braceR)) {
      if (first) {
        first = false;
      } else {
        if (this.eat(types.colon)) {
          this.unexpected(null, "ES2015 named imports do not destructure. " + "Use another statement for destructuring after the import.");
        }

        this.expect(types.comma);
        if (this.eat(types.braceR)) break;
      }

      this.parseImportSpecifier(node);
    }
  };

  _proto.parseImportSpecifier = function parseImportSpecifier(node) {
    var specifier = this.startNode();
    specifier.imported = this.parseIdentifier(true);

    if (this.eatContextual("as")) {
      specifier.local = this.parseIdentifier();
    } else {
      this.checkReservedWord(specifier.imported.name, specifier.start, true, true);
      specifier.local = specifier.imported.__clone();
    }

    this.checkLVal(specifier.local, true, undefined, "import specifier");
    node.specifiers.push(this.finishNode(specifier, "ImportSpecifier"));
  };

  return StatementParser;
}(ExpressionParser);

var Parser = function (_StatementParser) {
  _inheritsLoose(Parser, _StatementParser);

  function Parser(options, input) {
    var _this;

    options = getOptions(options);
    _this = _StatementParser.call(this, options, input) || this;
    _this.options = options;
    _this.inModule = _this.options.sourceType === "module";
    _this.input = input;
    _this.plugins = pluginsMap(_this.options.plugins);
    _this.filename = options.sourceFilename;
    return _this;
  }

  var _proto = Parser.prototype;

  _proto.parse = function parse() {
    var file = this.startNode();
    var program = this.startNode();
    this.nextToken();
    return this.parseTopLevel(file, program);
  };

  return Parser;
}(StatementParser);

function pluginsMap(plugins) {
  var pluginMap = Object.create(null);

  for (var _i2 = 0; _i2 < plugins.length; _i2++) {
    var plugin = plugins[_i2];

    var _ref = Array.isArray(plugin) ? plugin : [plugin, {}],
        name = _ref[0],
        _ref$ = _ref[1],
        options = _ref$ === void 0 ? {} : _ref$;

    if (!pluginMap[name]) pluginMap[name] = options || {};
  }

  return pluginMap;
}

function nonNull(x) {
  if (x == null) {
    throw new Error("Unexpected " + x + " value.");
  }

  return x;
}

function assert(x) {
  if (!x) {
    throw new Error("Assert fail");
  }
}

function keywordTypeFromName(value) {
  switch (value) {
    case "any":
      return "TSAnyKeyword";

    case "boolean":
      return "TSBooleanKeyword";

    case "never":
      return "TSNeverKeyword";

    case "number":
      return "TSNumberKeyword";

    case "object":
      return "TSObjectKeyword";

    case "string":
      return "TSStringKeyword";

    case "symbol":
      return "TSSymbolKeyword";

    case "undefined":
      return "TSUndefinedKeyword";

    case "unknown":
      return "TSUnknownKeyword";

    default:
      return undefined;
  }
}

var typescript = (function (superClass) {
  return function (_superClass) {
    _inheritsLoose(_class, _superClass);

    function _class() {
      return _superClass.apply(this, arguments) || this;
    }

    var _proto = _class.prototype;

    _proto.tsIsIdentifier = function tsIsIdentifier() {
      return this.match(types.name);
    };

    _proto.tsNextTokenCanFollowModifier = function tsNextTokenCanFollowModifier() {
      this.next();
      return !this.hasPrecedingLineBreak() && !this.match(types.parenL) && !this.match(types.parenR) && !this.match(types.colon) && !this.match(types.eq) && !this.match(types.question);
    };

    _proto.tsParseModifier = function tsParseModifier(allowedModifiers) {
      if (!this.match(types.name)) {
        return undefined;
      }

      var modifier = this.state.value;

      if (allowedModifiers.indexOf(modifier) !== -1 && this.tsTryParse(this.tsNextTokenCanFollowModifier.bind(this))) {
        return modifier;
      }

      return undefined;
    };

    _proto.tsIsListTerminator = function tsIsListTerminator(kind) {
      switch (kind) {
        case "EnumMembers":
        case "TypeMembers":
          return this.match(types.braceR);

        case "HeritageClauseElement":
          return this.match(types.braceL);

        case "TupleElementTypes":
          return this.match(types.bracketR);

        case "TypeParametersOrArguments":
          return this.isRelational(">");
      }

      throw new Error("Unreachable");
    };

    _proto.tsParseList = function tsParseList(kind, parseElement) {
      var result = [];

      while (!this.tsIsListTerminator(kind)) {
        result.push(parseElement());
      }

      return result;
    };

    _proto.tsParseDelimitedList = function tsParseDelimitedList(kind, parseElement) {
      return nonNull(this.tsParseDelimitedListWorker(kind, parseElement, true));
    };

    _proto.tsTryParseDelimitedList = function tsTryParseDelimitedList(kind, parseElement) {
      return this.tsParseDelimitedListWorker(kind, parseElement, false);
    };

    _proto.tsParseDelimitedListWorker = function tsParseDelimitedListWorker(kind, parseElement, expectSuccess) {
      var result = [];

      while (true) {
        if (this.tsIsListTerminator(kind)) {
          break;
        }

        var element = parseElement();

        if (element == null) {
          return undefined;
        }

        result.push(element);

        if (this.eat(types.comma)) {
          continue;
        }

        if (this.tsIsListTerminator(kind)) {
          break;
        }

        if (expectSuccess) {
          this.expect(types.comma);
        }

        return undefined;
      }

      return result;
    };

    _proto.tsParseBracketedList = function tsParseBracketedList(kind, parseElement, bracket, skipFirstToken) {
      if (!skipFirstToken) {
        if (bracket) {
          this.expect(types.bracketL);
        } else {
          this.expectRelational("<");
        }
      }

      var result = this.tsParseDelimitedList(kind, parseElement);

      if (bracket) {
        this.expect(types.bracketR);
      } else {
        this.expectRelational(">");
      }

      return result;
    };

    _proto.tsParseEntityName = function tsParseEntityName(allowReservedWords) {
      var entity = this.parseIdentifier();

      while (this.eat(types.dot)) {
        var node = this.startNodeAtNode(entity);
        node.left = entity;
        node.right = this.parseIdentifier(allowReservedWords);
        entity = this.finishNode(node, "TSQualifiedName");
      }

      return entity;
    };

    _proto.tsParseTypeReference = function tsParseTypeReference() {
      var node = this.startNode();
      node.typeName = this.tsParseEntityName(false);

      if (!this.hasPrecedingLineBreak() && this.isRelational("<")) {
        node.typeParameters = this.tsParseTypeArguments();
      }

      return this.finishNode(node, "TSTypeReference");
    };

    _proto.tsParseThisTypePredicate = function tsParseThisTypePredicate(lhs) {
      this.next();
      var node = this.startNode();
      node.parameterName = lhs;
      node.typeAnnotation = this.tsParseTypeAnnotation(false);
      return this.finishNode(node, "TSTypePredicate");
    };

    _proto.tsParseThisTypeNode = function tsParseThisTypeNode() {
      var node = this.startNode();
      this.next();
      return this.finishNode(node, "TSThisType");
    };

    _proto.tsParseTypeQuery = function tsParseTypeQuery() {
      var node = this.startNode();
      this.expect(types._typeof);
      node.exprName = this.tsParseEntityName(true);
      return this.finishNode(node, "TSTypeQuery");
    };

    _proto.tsParseTypeParameter = function tsParseTypeParameter() {
      var node = this.startNode();
      node.name = this.parseIdentifierName(node.start);
      node.constraint = this.tsEatThenParseType(types._extends);
      node.default = this.tsEatThenParseType(types.eq);
      return this.finishNode(node, "TSTypeParameter");
    };

    _proto.tsTryParseTypeParameters = function tsTryParseTypeParameters() {
      if (this.isRelational("<")) {
        return this.tsParseTypeParameters();
      }
    };

    _proto.tsParseTypeParameters = function tsParseTypeParameters() {
      var node = this.startNode();

      if (this.isRelational("<") || this.match(types.jsxTagStart)) {
        this.next();
      } else {
        this.unexpected();
      }

      node.params = this.tsParseBracketedList("TypeParametersOrArguments", this.tsParseTypeParameter.bind(this), false, true);
      return this.finishNode(node, "TSTypeParameterDeclaration");
    };

    _proto.tsFillSignature = function tsFillSignature(returnToken, signature) {
      var returnTokenRequired = returnToken === types.arrow;
      signature.typeParameters = this.tsTryParseTypeParameters();
      this.expect(types.parenL);
      signature.parameters = this.tsParseBindingListForSignature();

      if (returnTokenRequired) {
        signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
      } else if (this.match(returnToken)) {
        signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
      }
    };

    _proto.tsParseBindingListForSignature = function tsParseBindingListForSignature() {
      var _this = this;

      return this.parseBindingList(types.parenR).map(function (pattern) {
        if (pattern.type !== "Identifier" && pattern.type !== "RestElement" && pattern.type !== "ObjectPattern") {
          throw _this.unexpected(pattern.start, "Name in a signature must be an Identifier or ObjectPattern, instead got " + pattern.type);
        }

        return pattern;
      });
    };

    _proto.tsParseTypeMemberSemicolon = function tsParseTypeMemberSemicolon() {
      if (!this.eat(types.comma)) {
        this.semicolon();
      }
    };

    _proto.tsParseSignatureMember = function tsParseSignatureMember(kind) {
      var node = this.startNode();

      if (kind === "TSConstructSignatureDeclaration") {
        this.expect(types._new);
      }

      this.tsFillSignature(types.colon, node);
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(node, kind);
    };

    _proto.tsIsUnambiguouslyIndexSignature = function tsIsUnambiguouslyIndexSignature() {
      this.next();
      return this.eat(types.name) && this.match(types.colon);
    };

    _proto.tsTryParseIndexSignature = function tsTryParseIndexSignature(node) {
      if (!(this.match(types.bracketL) && this.tsLookAhead(this.tsIsUnambiguouslyIndexSignature.bind(this)))) {
        return undefined;
      }

      this.expect(types.bracketL);
      var id = this.parseIdentifier();
      this.expect(types.colon);
      id.typeAnnotation = this.tsParseTypeAnnotation(false);
      this.expect(types.bracketR);
      node.parameters = [id];
      var type = this.tsTryParseTypeAnnotation();
      if (type) node.typeAnnotation = type;
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(node, "TSIndexSignature");
    };

    _proto.tsParsePropertyOrMethodSignature = function tsParsePropertyOrMethodSignature(node, readonly) {
      this.parsePropertyName(node);
      if (this.eat(types.question)) node.optional = true;
      var nodeAny = node;

      if (!readonly && (this.match(types.parenL) || this.isRelational("<"))) {
        var method = nodeAny;
        this.tsFillSignature(types.colon, method);
        this.tsParseTypeMemberSemicolon();
        return this.finishNode(method, "TSMethodSignature");
      } else {
        var property = nodeAny;
        if (readonly) property.readonly = true;
        var type = this.tsTryParseTypeAnnotation();
        if (type) property.typeAnnotation = type;
        this.tsParseTypeMemberSemicolon();
        return this.finishNode(property, "TSPropertySignature");
      }
    };

    _proto.tsParseTypeMember = function tsParseTypeMember() {
      if (this.match(types.parenL) || this.isRelational("<")) {
        return this.tsParseSignatureMember("TSCallSignatureDeclaration");
      }

      if (this.match(types._new) && this.tsLookAhead(this.tsIsStartOfConstructSignature.bind(this))) {
        return this.tsParseSignatureMember("TSConstructSignatureDeclaration");
      }

      var node = this.startNode();
      var readonly = !!this.tsParseModifier(["readonly"]);
      var idx = this.tsTryParseIndexSignature(node);

      if (idx) {
        if (readonly) node.readonly = true;
        return idx;
      }

      return this.tsParsePropertyOrMethodSignature(node, readonly);
    };

    _proto.tsIsStartOfConstructSignature = function tsIsStartOfConstructSignature() {
      this.next();
      return this.match(types.parenL) || this.isRelational("<");
    };

    _proto.tsParseTypeLiteral = function tsParseTypeLiteral() {
      var node = this.startNode();
      node.members = this.tsParseObjectTypeMembers();
      return this.finishNode(node, "TSTypeLiteral");
    };

    _proto.tsParseObjectTypeMembers = function tsParseObjectTypeMembers() {
      this.expect(types.braceL);
      var members = this.tsParseList("TypeMembers", this.tsParseTypeMember.bind(this));
      this.expect(types.braceR);
      return members;
    };

    _proto.tsIsStartOfMappedType = function tsIsStartOfMappedType() {
      this.next();

      if (this.eat(types.plusMin)) {
        return this.isContextual("readonly");
      }

      if (this.isContextual("readonly")) {
        this.next();
      }

      if (!this.match(types.bracketL)) {
        return false;
      }

      this.next();

      if (!this.tsIsIdentifier()) {
        return false;
      }

      this.next();
      return this.match(types._in);
    };

    _proto.tsParseMappedTypeParameter = function tsParseMappedTypeParameter() {
      var node = this.startNode();
      node.name = this.parseIdentifierName(node.start);
      node.constraint = this.tsExpectThenParseType(types._in);
      return this.finishNode(node, "TSTypeParameter");
    };

    _proto.tsParseMappedType = function tsParseMappedType() {
      var node = this.startNode();
      this.expect(types.braceL);

      if (this.match(types.plusMin)) {
        node.readonly = this.state.value;
        this.next();
        this.expectContextual("readonly");
      } else if (this.eatContextual("readonly")) {
        node.readonly = true;
      }

      this.expect(types.bracketL);
      node.typeParameter = this.tsParseMappedTypeParameter();
      this.expect(types.bracketR);

      if (this.match(types.plusMin)) {
        node.optional = this.state.value;
        this.next();
        this.expect(types.question);
      } else if (this.eat(types.question)) {
        node.optional = true;
      }

      node.typeAnnotation = this.tsTryParseType();
      this.semicolon();
      this.expect(types.braceR);
      return this.finishNode(node, "TSMappedType");
    };

    _proto.tsParseTupleType = function tsParseTupleType() {
      var _this2 = this;

      var node = this.startNode();
      node.elementTypes = this.tsParseBracketedList("TupleElementTypes", this.tsParseTupleElementType.bind(this), true, false);
      var seenOptionalElement = false;
      node.elementTypes.forEach(function (elementNode, i) {
        if (elementNode.type === "TSRestType") {
          if (i !== node.elementTypes.length - 1) {
            _this2.raise(elementNode.start, "A rest element must be last in a tuple type.");
          }
        } else if (elementNode.type === "TSOptionalType") {
          seenOptionalElement = true;
        } else if (seenOptionalElement) {
          _this2.raise(elementNode.start, "A required element cannot follow an optional element.");
        }
      });
      return this.finishNode(node, "TSTupleType");
    };

    _proto.tsParseTupleElementType = function tsParseTupleElementType() {
      if (this.match(types.ellipsis)) {
        var restNode = this.startNode();
        this.next();
        restNode.typeAnnotation = this.tsParseType();
        return this.finishNode(restNode, "TSRestType");
      }

      var type = this.tsParseType();

      if (this.eat(types.question)) {
        var optionalTypeNode = this.startNodeAtNode(type);
        optionalTypeNode.typeAnnotation = type;
        return this.finishNode(optionalTypeNode, "TSOptionalType");
      }

      return type;
    };

    _proto.tsParseParenthesizedType = function tsParseParenthesizedType() {
      var node = this.startNode();
      this.expect(types.parenL);
      node.typeAnnotation = this.tsParseType();
      this.expect(types.parenR);
      return this.finishNode(node, "TSParenthesizedType");
    };

    _proto.tsParseFunctionOrConstructorType = function tsParseFunctionOrConstructorType(type) {
      var node = this.startNode();

      if (type === "TSConstructorType") {
        this.expect(types._new);
      }

      this.tsFillSignature(types.arrow, node);
      return this.finishNode(node, type);
    };

    _proto.tsParseLiteralTypeNode = function tsParseLiteralTypeNode() {
      var _this3 = this;

      var node = this.startNode();

      node.literal = function () {
        switch (_this3.state.type) {
          case types.num:
            return _this3.parseLiteral(_this3.state.value, "NumericLiteral");

          case types.string:
            return _this3.parseLiteral(_this3.state.value, "StringLiteral");

          case types._true:
          case types._false:
            return _this3.parseBooleanLiteral();

          default:
            throw _this3.unexpected();
        }
      }();

      return this.finishNode(node, "TSLiteralType");
    };

    _proto.tsParseNonArrayType = function tsParseNonArrayType() {
      switch (this.state.type) {
        case types.name:
        case types._void:
        case types._null:
          {
            var type = this.match(types._void) ? "TSVoidKeyword" : this.match(types._null) ? "TSNullKeyword" : keywordTypeFromName(this.state.value);

            if (type !== undefined && this.lookahead().type !== types.dot) {
              var node = this.startNode();
              this.next();
              return this.finishNode(node, type);
            }

            return this.tsParseTypeReference();
          }

        case types.string:
        case types.num:
        case types._true:
        case types._false:
          return this.tsParseLiteralTypeNode();

        case types.plusMin:
          if (this.state.value === "-") {
            var _node = this.startNode();

            this.next();

            if (!this.match(types.num)) {
              throw this.unexpected();
            }

            _node.literal = this.parseLiteral(-this.state.value, "NumericLiteral", _node.start, _node.loc.start);
            return this.finishNode(_node, "TSLiteralType");
          }

          break;

        case types._this:
          {
            var thisKeyword = this.tsParseThisTypeNode();

            if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
              return this.tsParseThisTypePredicate(thisKeyword);
            } else {
              return thisKeyword;
            }
          }

        case types._typeof:
          return this.tsParseTypeQuery();

        case types.braceL:
          return this.tsLookAhead(this.tsIsStartOfMappedType.bind(this)) ? this.tsParseMappedType() : this.tsParseTypeLiteral();

        case types.bracketL:
          return this.tsParseTupleType();

        case types.parenL:
          return this.tsParseParenthesizedType();
      }

      throw this.unexpected();
    };

    _proto.tsParseArrayTypeOrHigher = function tsParseArrayTypeOrHigher() {
      var type = this.tsParseNonArrayType();

      while (!this.hasPrecedingLineBreak() && this.eat(types.bracketL)) {
        if (this.match(types.bracketR)) {
          var node = this.startNodeAtNode(type);
          node.elementType = type;
          this.expect(types.bracketR);
          type = this.finishNode(node, "TSArrayType");
        } else {
          var _node2 = this.startNodeAtNode(type);

          _node2.objectType = type;
          _node2.indexType = this.tsParseType();
          this.expect(types.bracketR);
          type = this.finishNode(_node2, "TSIndexedAccessType");
        }
      }

      return type;
    };

    _proto.tsParseTypeOperator = function tsParseTypeOperator(operator) {
      var node = this.startNode();
      this.expectContextual(operator);
      node.operator = operator;
      node.typeAnnotation = this.tsParseTypeOperatorOrHigher();
      return this.finishNode(node, "TSTypeOperator");
    };

    _proto.tsParseInferType = function tsParseInferType() {
      var node = this.startNode();
      this.expectContextual("infer");
      var typeParameter = this.startNode();
      typeParameter.name = this.parseIdentifierName(typeParameter.start);
      node.typeParameter = this.finishNode(typeParameter, "TSTypeParameter");
      return this.finishNode(node, "TSInferType");
    };

    _proto.tsParseTypeOperatorOrHigher = function tsParseTypeOperatorOrHigher() {
      var _this4 = this;

      var operator = ["keyof", "unique"].find(function (kw) {
        return _this4.isContextual(kw);
      });
      return operator ? this.tsParseTypeOperator(operator) : this.isContextual("infer") ? this.tsParseInferType() : this.tsParseArrayTypeOrHigher();
    };

    _proto.tsParseUnionOrIntersectionType = function tsParseUnionOrIntersectionType(kind, parseConstituentType, operator) {
      this.eat(operator);
      var type = parseConstituentType();

      if (this.match(operator)) {
        var types$$1 = [type];

        while (this.eat(operator)) {
          types$$1.push(parseConstituentType());
        }

        var node = this.startNodeAtNode(type);
        node.types = types$$1;
        type = this.finishNode(node, kind);
      }

      return type;
    };

    _proto.tsParseIntersectionTypeOrHigher = function tsParseIntersectionTypeOrHigher() {
      return this.tsParseUnionOrIntersectionType("TSIntersectionType", this.tsParseTypeOperatorOrHigher.bind(this), types.bitwiseAND);
    };

    _proto.tsParseUnionTypeOrHigher = function tsParseUnionTypeOrHigher() {
      return this.tsParseUnionOrIntersectionType("TSUnionType", this.tsParseIntersectionTypeOrHigher.bind(this), types.bitwiseOR);
    };

    _proto.tsIsStartOfFunctionType = function tsIsStartOfFunctionType() {
      if (this.isRelational("<")) {
        return true;
      }

      return this.match(types.parenL) && this.tsLookAhead(this.tsIsUnambiguouslyStartOfFunctionType.bind(this));
    };

    _proto.tsSkipParameterStart = function tsSkipParameterStart() {
      if (this.match(types.name) || this.match(types._this)) {
        this.next();
        return true;
      }

      if (this.match(types.braceL)) {
        var braceStackCounter = 1;
        this.next();

        while (braceStackCounter > 0) {
          if (this.match(types.braceL)) {
            ++braceStackCounter;
          } else if (this.match(types.braceR)) {
            --braceStackCounter;
          }

          this.next();
        }

        return true;
      }

      return false;
    };

    _proto.tsIsUnambiguouslyStartOfFunctionType = function tsIsUnambiguouslyStartOfFunctionType() {
      this.next();

      if (this.match(types.parenR) || this.match(types.ellipsis)) {
        return true;
      }

      if (this.tsSkipParameterStart()) {
        if (this.match(types.colon) || this.match(types.comma) || this.match(types.question) || this.match(types.eq)) {
          return true;
        }

        if (this.match(types.parenR)) {
          this.next();

          if (this.match(types.arrow)) {
            return true;
          }
        }
      }

      return false;
    };

    _proto.tsParseTypeOrTypePredicateAnnotation = function tsParseTypeOrTypePredicateAnnotation(returnToken) {
      var _this5 = this;

      return this.tsInType(function () {
        var t = _this5.startNode();

        _this5.expect(returnToken);

        var typePredicateVariable = _this5.tsIsIdentifier() && _this5.tsTryParse(_this5.tsParseTypePredicatePrefix.bind(_this5));

        if (!typePredicateVariable) {
          return _this5.tsParseTypeAnnotation(false, t);
        }

        var type = _this5.tsParseTypeAnnotation(false);

        var node = _this5.startNodeAtNode(typePredicateVariable);

        node.parameterName = typePredicateVariable;
        node.typeAnnotation = type;
        t.typeAnnotation = _this5.finishNode(node, "TSTypePredicate");
        return _this5.finishNode(t, "TSTypeAnnotation");
      });
    };

    _proto.tsTryParseTypeOrTypePredicateAnnotation = function tsTryParseTypeOrTypePredicateAnnotation() {
      return this.match(types.colon) ? this.tsParseTypeOrTypePredicateAnnotation(types.colon) : undefined;
    };

    _proto.tsTryParseTypeAnnotation = function tsTryParseTypeAnnotation() {
      return this.match(types.colon) ? this.tsParseTypeAnnotation() : undefined;
    };

    _proto.tsTryParseType = function tsTryParseType() {
      return this.tsEatThenParseType(types.colon);
    };

    _proto.tsParseTypePredicatePrefix = function tsParseTypePredicatePrefix() {
      var id = this.parseIdentifier();

      if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
        this.next();
        return id;
      }
    };

    _proto.tsParseTypeAnnotation = function tsParseTypeAnnotation(eatColon, t) {
      var _this6 = this;

      if (eatColon === void 0) {
        eatColon = true;
      }

      if (t === void 0) {
        t = this.startNode();
      }

      this.tsInType(function () {
        if (eatColon) _this6.expect(types.colon);
        t.typeAnnotation = _this6.tsParseType();
      });
      return this.finishNode(t, "TSTypeAnnotation");
    };

    _proto.tsParseType = function tsParseType() {
      assert(this.state.inType);
      var type = this.tsParseNonConditionalType();

      if (this.hasPrecedingLineBreak() || !this.eat(types._extends)) {
        return type;
      }

      var node = this.startNodeAtNode(type);
      node.checkType = type;
      node.extendsType = this.tsParseNonConditionalType();
      this.expect(types.question);
      node.trueType = this.tsParseType();
      this.expect(types.colon);
      node.falseType = this.tsParseType();
      return this.finishNode(node, "TSConditionalType");
    };

    _proto.tsParseNonConditionalType = function tsParseNonConditionalType() {
      if (this.tsIsStartOfFunctionType()) {
        return this.tsParseFunctionOrConstructorType("TSFunctionType");
      }

      if (this.match(types._new)) {
        return this.tsParseFunctionOrConstructorType("TSConstructorType");
      }

      return this.tsParseUnionTypeOrHigher();
    };

    _proto.tsParseTypeAssertion = function tsParseTypeAssertion() {
      var _this7 = this;

      var node = this.startNode();
      node.typeAnnotation = this.tsInType(function () {
        return _this7.tsParseType();
      });
      this.expectRelational(">");
      node.expression = this.parseMaybeUnary();
      return this.finishNode(node, "TSTypeAssertion");
    };

    _proto.tsParseHeritageClause = function tsParseHeritageClause() {
      return this.tsParseDelimitedList("HeritageClauseElement", this.tsParseExpressionWithTypeArguments.bind(this));
    };

    _proto.tsParseExpressionWithTypeArguments = function tsParseExpressionWithTypeArguments() {
      var node = this.startNode();
      node.expression = this.tsParseEntityName(false);

      if (this.isRelational("<")) {
        node.typeParameters = this.tsParseTypeArguments();
      }

      return this.finishNode(node, "TSExpressionWithTypeArguments");
    };

    _proto.tsParseInterfaceDeclaration = function tsParseInterfaceDeclaration(node) {
      node.id = this.parseIdentifier();
      node.typeParameters = this.tsTryParseTypeParameters();

      if (this.eat(types._extends)) {
        node.extends = this.tsParseHeritageClause();
      }

      var body = this.startNode();
      body.body = this.tsInType(this.tsParseObjectTypeMembers.bind(this));
      node.body = this.finishNode(body, "TSInterfaceBody");
      return this.finishNode(node, "TSInterfaceDeclaration");
    };

    _proto.tsParseTypeAliasDeclaration = function tsParseTypeAliasDeclaration(node) {
      node.id = this.parseIdentifier();
      node.typeParameters = this.tsTryParseTypeParameters();
      node.typeAnnotation = this.tsExpectThenParseType(types.eq);
      this.semicolon();
      return this.finishNode(node, "TSTypeAliasDeclaration");
    };

    _proto.tsInNoContext = function tsInNoContext(cb) {
      var oldContext = this.state.context;
      this.state.context = [oldContext[0]];

      try {
        return cb();
      } finally {
        this.state.context = oldContext;
      }
    };

    _proto.tsInType = function tsInType(cb) {
      var oldInType = this.state.inType;
      this.state.inType = true;

      try {
        return cb();
      } finally {
        this.state.inType = oldInType;
      }
    };

    _proto.tsEatThenParseType = function tsEatThenParseType(token) {
      return !this.match(token) ? undefined : this.tsNextThenParseType();
    };

    _proto.tsExpectThenParseType = function tsExpectThenParseType(token) {
      var _this8 = this;

      return this.tsDoThenParseType(function () {
        return _this8.expect(token);
      });
    };

    _proto.tsNextThenParseType = function tsNextThenParseType() {
      var _this9 = this;

      return this.tsDoThenParseType(function () {
        return _this9.next();
      });
    };

    _proto.tsDoThenParseType = function tsDoThenParseType(cb) {
      var _this10 = this;

      return this.tsInType(function () {
        cb();
        return _this10.tsParseType();
      });
    };

    _proto.tsParseEnumMember = function tsParseEnumMember() {
      var node = this.startNode();
      node.id = this.match(types.string) ? this.parseLiteral(this.state.value, "StringLiteral") : this.parseIdentifier(true);

      if (this.eat(types.eq)) {
        node.initializer = this.parseMaybeAssign();
      }

      return this.finishNode(node, "TSEnumMember");
    };

    _proto.tsParseEnumDeclaration = function tsParseEnumDeclaration(node, isConst) {
      if (isConst) node.const = true;
      node.id = this.parseIdentifier();
      this.expect(types.braceL);
      node.members = this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
      this.expect(types.braceR);
      return this.finishNode(node, "TSEnumDeclaration");
    };

    _proto.tsParseModuleBlock = function tsParseModuleBlock() {
      var node = this.startNode();
      this.expect(types.braceL);
      this.parseBlockOrModuleBlockBody(node.body = [], undefined, true, types.braceR);
      return this.finishNode(node, "TSModuleBlock");
    };

    _proto.tsParseModuleOrNamespaceDeclaration = function tsParseModuleOrNamespaceDeclaration(node) {
      node.id = this.parseIdentifier();

      if (this.eat(types.dot)) {
        var inner = this.startNode();
        this.tsParseModuleOrNamespaceDeclaration(inner);
        node.body = inner;
      } else {
        node.body = this.tsParseModuleBlock();
      }

      return this.finishNode(node, "TSModuleDeclaration");
    };

    _proto.tsParseAmbientExternalModuleDeclaration = function tsParseAmbientExternalModuleDeclaration(node) {
      if (this.isContextual("global")) {
        node.global = true;
        node.id = this.parseIdentifier();
      } else if (this.match(types.string)) {
        node.id = this.parseExprAtom();
      } else {
        this.unexpected();
      }

      if (this.match(types.braceL)) {
        node.body = this.tsParseModuleBlock();
      } else {
        this.semicolon();
      }

      return this.finishNode(node, "TSModuleDeclaration");
    };

    _proto.tsParseImportEqualsDeclaration = function tsParseImportEqualsDeclaration(node, isExport) {
      node.isExport = isExport || false;
      node.id = this.parseIdentifier();
      this.expect(types.eq);
      node.moduleReference = this.tsParseModuleReference();
      this.semicolon();
      return this.finishNode(node, "TSImportEqualsDeclaration");
    };

    _proto.tsIsExternalModuleReference = function tsIsExternalModuleReference() {
      return this.isContextual("require") && this.lookahead().type === types.parenL;
    };

    _proto.tsParseModuleReference = function tsParseModuleReference() {
      return this.tsIsExternalModuleReference() ? this.tsParseExternalModuleReference() : this.tsParseEntityName(false);
    };

    _proto.tsParseExternalModuleReference = function tsParseExternalModuleReference() {
      var node = this.startNode();
      this.expectContextual("require");
      this.expect(types.parenL);

      if (!this.match(types.string)) {
        throw this.unexpected();
      }

      node.expression = this.parseLiteral(this.state.value, "StringLiteral");
      this.expect(types.parenR);
      return this.finishNode(node, "TSExternalModuleReference");
    };

    _proto.tsLookAhead = function tsLookAhead(f) {
      var state = this.state.clone();
      var res = f();
      this.state = state;
      return res;
    };

    _proto.tsTryParseAndCatch = function tsTryParseAndCatch(f) {
      var state = this.state.clone();

      try {
        return f();
      } catch (e) {
        if (e instanceof SyntaxError) {
          this.state = state;
          return undefined;
        }

        throw e;
      }
    };

    _proto.tsTryParse = function tsTryParse(f) {
      var state = this.state.clone();
      var result = f();

      if (result !== undefined && result !== false) {
        return result;
      } else {
        this.state = state;
        return undefined;
      }
    };

    _proto.nodeWithSamePosition = function nodeWithSamePosition(original, type) {
      var node = this.startNodeAtNode(original);
      node.type = type;
      node.end = original.end;
      node.loc.end = original.loc.end;

      if (original.leadingComments) {
        node.leadingComments = original.leadingComments;
      }

      if (original.trailingComments) {
        node.trailingComments = original.trailingComments;
      }

      if (original.innerComments) node.innerComments = original.innerComments;
      return node;
    };

    _proto.tsTryParseDeclare = function tsTryParseDeclare(nany) {
      switch (this.state.type) {
        case types._function:
          this.next();
          return this.parseFunction(nany, true);

        case types._class:
          return this.parseClass(nany, true, false);

        case types._const:
          if (this.match(types._const) && this.isLookaheadContextual("enum")) {
            this.expect(types._const);
            this.expectContextual("enum");
            return this.tsParseEnumDeclaration(nany, true);
          }

        case types._var:
        case types._let:
          return this.parseVarStatement(nany, this.state.type);

        case types.name:
          {
            var value = this.state.value;

            if (value === "global") {
              return this.tsParseAmbientExternalModuleDeclaration(nany);
            } else {
              return this.tsParseDeclaration(nany, value, true);
            }
          }
      }
    };

    _proto.tsTryParseExportDeclaration = function tsTryParseExportDeclaration() {
      return this.tsParseDeclaration(this.startNode(), this.state.value, true);
    };

    _proto.tsParseExpressionStatement = function tsParseExpressionStatement(node, expr) {
      switch (expr.name) {
        case "declare":
          {
            var declaration = this.tsTryParseDeclare(node);

            if (declaration) {
              declaration.declare = true;
              return declaration;
            }

            break;
          }

        case "global":
          if (this.match(types.braceL)) {
            var mod = node;
            mod.global = true;
            mod.id = expr;
            mod.body = this.tsParseModuleBlock();
            return this.finishNode(mod, "TSModuleDeclaration");
          }

          break;

        default:
          return this.tsParseDeclaration(node, expr.name, false);
      }
    };

    _proto.tsParseDeclaration = function tsParseDeclaration(node, value, next) {
      switch (value) {
        case "abstract":
          if (next || this.match(types._class)) {
            var cls = node;
            cls.abstract = true;
            if (next) this.next();
            return this.parseClass(cls, true, false);
          }

          break;

        case "enum":
          if (next || this.match(types.name)) {
            if (next) this.next();
            return this.tsParseEnumDeclaration(node, false);
          }

          break;

        case "interface":
          if (next || this.match(types.name)) {
            if (next) this.next();
            return this.tsParseInterfaceDeclaration(node);
          }

          break;

        case "module":
          if (next) this.next();

          if (this.match(types.string)) {
            return this.tsParseAmbientExternalModuleDeclaration(node);
          } else if (next || this.match(types.name)) {
            return this.tsParseModuleOrNamespaceDeclaration(node);
          }

          break;

        case "namespace":
          if (next || this.match(types.name)) {
            if (next) this.next();
            return this.tsParseModuleOrNamespaceDeclaration(node);
          }

          break;

        case "type":
          if (next || this.match(types.name)) {
            if (next) this.next();
            return this.tsParseTypeAliasDeclaration(node);
          }

          break;
      }
    };

    _proto.tsTryParseGenericAsyncArrowFunction = function tsTryParseGenericAsyncArrowFunction(startPos, startLoc) {
      var _this11 = this;

      var res = this.tsTryParseAndCatch(function () {
        var node = _this11.startNodeAt(startPos, startLoc);

        node.typeParameters = _this11.tsParseTypeParameters();

        _superClass.prototype.parseFunctionParams.call(_this11, node);

        node.returnType = _this11.tsTryParseTypeOrTypePredicateAnnotation();

        _this11.expect(types.arrow);

        return node;
      });

      if (!res) {
        return undefined;
      }

      var oldInAsync = this.state.inAsync;
      var oldInGenerator = this.state.inGenerator;
      this.state.inAsync = true;
      this.state.inGenerator = false;
      res.id = null;
      res.generator = false;
      res.expression = true;
      res.async = true;
      this.parseFunctionBody(res, true);
      this.state.inAsync = oldInAsync;
      this.state.inGenerator = oldInGenerator;
      return this.finishNode(res, "ArrowFunctionExpression");
    };

    _proto.tsParseTypeArguments = function tsParseTypeArguments() {
      var _this12 = this;

      var node = this.startNode();
      node.params = this.tsInType(function () {
        return _this12.tsInNoContext(function () {
          _this12.expectRelational("<");

          return _this12.tsParseDelimitedList("TypeParametersOrArguments", _this12.tsParseType.bind(_this12));
        });
      });
      this.state.exprAllowed = false;
      this.expectRelational(">");
      return this.finishNode(node, "TSTypeParameterInstantiation");
    };

    _proto.tsIsDeclarationStart = function tsIsDeclarationStart() {
      if (this.match(types.name)) {
        switch (this.state.value) {
          case "abstract":
          case "declare":
          case "enum":
          case "interface":
          case "module":
          case "namespace":
          case "type":
            return true;
        }
      }

      return false;
    };

    _proto.isExportDefaultSpecifier = function isExportDefaultSpecifier() {
      if (this.tsIsDeclarationStart()) return false;
      return _superClass.prototype.isExportDefaultSpecifier.call(this);
    };

    _proto.parseAssignableListItem = function parseAssignableListItem(allowModifiers, decorators) {
      var accessibility;
      var readonly = false;

      if (allowModifiers) {
        accessibility = this.parseAccessModifier();
        readonly = !!this.tsParseModifier(["readonly"]);
      }

      var left = this.parseMaybeDefault();
      this.parseAssignableListItemTypes(left);
      var elt = this.parseMaybeDefault(left.start, left.loc.start, left);

      if (accessibility || readonly) {
        var pp = this.startNodeAtNode(elt);

        if (decorators.length) {
          pp.decorators = decorators;
        }

        if (accessibility) pp.accessibility = accessibility;
        if (readonly) pp.readonly = readonly;

        if (elt.type !== "Identifier" && elt.type !== "AssignmentPattern") {
          throw this.raise(pp.start, "A parameter property may not be declared using a binding pattern.");
        }

        pp.parameter = elt;
        return this.finishNode(pp, "TSParameterProperty");
      } else {
        if (decorators.length) {
          left.decorators = decorators;
        }

        return elt;
      }
    };

    _proto.parseFunctionBodyAndFinish = function parseFunctionBodyAndFinish(node, type, allowExpressionBody) {
      if (!allowExpressionBody && this.match(types.colon)) {
        node.returnType = this.tsParseTypeOrTypePredicateAnnotation(types.colon);
      }

      var bodilessType = type === "FunctionDeclaration" ? "TSDeclareFunction" : type === "ClassMethod" ? "TSDeclareMethod" : undefined;

      if (bodilessType && !this.match(types.braceL) && this.isLineTerminator()) {
        this.finishNode(node, bodilessType);
        return;
      }

      _superClass.prototype.parseFunctionBodyAndFinish.call(this, node, type, allowExpressionBody);
    };

    _proto.parseSubscript = function parseSubscript(base, startPos, startLoc, noCalls, state) {
      var _this13 = this;

      if (!this.hasPrecedingLineBreak() && this.match(types.bang)) {
        this.state.exprAllowed = false;
        this.next();
        var nonNullExpression = this.startNodeAt(startPos, startLoc);
        nonNullExpression.expression = base;
        return this.finishNode(nonNullExpression, "TSNonNullExpression");
      }

      if (this.isRelational("<")) {
        var result = this.tsTryParseAndCatch(function () {
          if (!noCalls && _this13.atPossibleAsync(base)) {
            var asyncArrowFn = _this13.tsTryParseGenericAsyncArrowFunction(startPos, startLoc);

            if (asyncArrowFn) {
              return asyncArrowFn;
            }
          }

          var node = _this13.startNodeAt(startPos, startLoc);

          node.callee = base;

          var typeArguments = _this13.tsParseTypeArguments();

          if (typeArguments) {
            if (!noCalls && _this13.eat(types.parenL)) {
              node.arguments = _this13.parseCallExpressionArguments(types.parenR, false);
              node.typeParameters = typeArguments;
              return _this13.finishCallExpression(node);
            } else if (_this13.match(types.backQuote)) {
              return _this13.parseTaggedTemplateExpression(startPos, startLoc, base, state, typeArguments);
            }
          }

          _this13.unexpected();
        });
        if (result) return result;
      }

      return _superClass.prototype.parseSubscript.call(this, base, startPos, startLoc, noCalls, state);
    };

    _proto.parseNewArguments = function parseNewArguments(node) {
      var _this14 = this;

      if (this.isRelational("<")) {
        var typeParameters = this.tsTryParseAndCatch(function () {
          var args = _this14.tsParseTypeArguments();

          if (!_this14.match(types.parenL)) _this14.unexpected();
          return args;
        });

        if (typeParameters) {
          node.typeParameters = typeParameters;
        }
      }

      _superClass.prototype.parseNewArguments.call(this, node);
    };

    _proto.parseExprOp = function parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn) {
      if (nonNull(types._in.binop) > minPrec && !this.hasPrecedingLineBreak() && this.isContextual("as")) {
        var node = this.startNodeAt(leftStartPos, leftStartLoc);
        node.expression = left;
        node.typeAnnotation = this.tsNextThenParseType();
        this.finishNode(node, "TSAsExpression");
        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
      }

      return _superClass.prototype.parseExprOp.call(this, left, leftStartPos, leftStartLoc, minPrec, noIn);
    };

    _proto.checkReservedWord = function checkReservedWord(word, startLoc, checkKeywords, isBinding) {};

    _proto.checkDuplicateExports = function checkDuplicateExports() {};

    _proto.parseImport = function parseImport(node) {
      if (this.match(types.name) && this.lookahead().type === types.eq) {
        return this.tsParseImportEqualsDeclaration(node);
      }

      return _superClass.prototype.parseImport.call(this, node);
    };

    _proto.parseExport = function parseExport(node) {
      if (this.match(types._import)) {
        this.expect(types._import);
        return this.tsParseImportEqualsDeclaration(node, true);
      } else if (this.eat(types.eq)) {
        var assign = node;
        assign.expression = this.parseExpression();
        this.semicolon();
        return this.finishNode(assign, "TSExportAssignment");
      } else if (this.eatContextual("as")) {
        var decl = node;
        this.expectContextual("namespace");
        decl.id = this.parseIdentifier();
        this.semicolon();
        return this.finishNode(decl, "TSNamespaceExportDeclaration");
      } else {
        return _superClass.prototype.parseExport.call(this, node);
      }
    };

    _proto.isAbstractClass = function isAbstractClass() {
      return this.isContextual("abstract") && this.lookahead().type === types._class;
    };

    _proto.parseExportDefaultExpression = function parseExportDefaultExpression() {
      if (this.isAbstractClass()) {
        var cls = this.startNode();
        this.next();
        this.parseClass(cls, true, true);
        cls.abstract = true;
        return cls;
      }

      if (this.state.value === "interface") {
        var result = this.tsParseDeclaration(this.startNode(), this.state.value, true);
        if (result) return result;
      }

      return _superClass.prototype.parseExportDefaultExpression.call(this);
    };

    _proto.parseStatementContent = function parseStatementContent(declaration, topLevel) {
      if (this.state.type === types._const) {
        var ahead = this.lookahead();

        if (ahead.type === types.name && ahead.value === "enum") {
          var node = this.startNode();
          this.expect(types._const);
          this.expectContextual("enum");
          return this.tsParseEnumDeclaration(node, true);
        }
      }

      return _superClass.prototype.parseStatementContent.call(this, declaration, topLevel);
    };

    _proto.parseAccessModifier = function parseAccessModifier() {
      return this.tsParseModifier(["public", "protected", "private"]);
    };

    _proto.parseClassMember = function parseClassMember(classBody, member, state) {
      var accessibility = this.parseAccessModifier();
      if (accessibility) member.accessibility = accessibility;

      _superClass.prototype.parseClassMember.call(this, classBody, member, state);
    };

    _proto.parseClassMemberWithIsStatic = function parseClassMemberWithIsStatic(classBody, member, state, isStatic) {
      var methodOrProp = member;
      var prop = member;
      var propOrIdx = member;
      var abstract = false,
          readonly = false;
      var mod = this.tsParseModifier(["abstract", "readonly"]);

      switch (mod) {
        case "readonly":
          readonly = true;
          abstract = !!this.tsParseModifier(["abstract"]);
          break;

        case "abstract":
          abstract = true;
          readonly = !!this.tsParseModifier(["readonly"]);
          break;
      }

      if (abstract) methodOrProp.abstract = true;
      if (readonly) propOrIdx.readonly = true;

      if (!abstract && !isStatic && !methodOrProp.accessibility) {
        var idx = this.tsTryParseIndexSignature(member);

        if (idx) {
          classBody.body.push(idx);
          return;
        }
      }

      if (readonly) {
        methodOrProp.static = isStatic;
        this.parseClassPropertyName(prop);
        this.parsePostMemberNameModifiers(methodOrProp);
        this.pushClassProperty(classBody, prop);
        return;
      }

      _superClass.prototype.parseClassMemberWithIsStatic.call(this, classBody, member, state, isStatic);
    };

    _proto.parsePostMemberNameModifiers = function parsePostMemberNameModifiers(methodOrProp) {
      var optional = this.eat(types.question);
      if (optional) methodOrProp.optional = true;
    };

    _proto.parseExpressionStatement = function parseExpressionStatement(node, expr) {
      var decl = expr.type === "Identifier" ? this.tsParseExpressionStatement(node, expr) : undefined;
      return decl || _superClass.prototype.parseExpressionStatement.call(this, node, expr);
    };

    _proto.shouldParseExportDeclaration = function shouldParseExportDeclaration() {
      if (this.tsIsDeclarationStart()) return true;
      return _superClass.prototype.shouldParseExportDeclaration.call(this);
    };

    _proto.parseConditional = function parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos) {
      if (!refNeedsArrowPos || !this.match(types.question)) {
        return _superClass.prototype.parseConditional.call(this, expr, noIn, startPos, startLoc, refNeedsArrowPos);
      }

      var state = this.state.clone();

      try {
        return _superClass.prototype.parseConditional.call(this, expr, noIn, startPos, startLoc);
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          throw err;
        }

        this.state = state;
        refNeedsArrowPos.start = err.pos || this.state.start;
        return expr;
      }
    };

    _proto.parseParenItem = function parseParenItem(node, startPos, startLoc) {
      node = _superClass.prototype.parseParenItem.call(this, node, startPos, startLoc);

      if (this.eat(types.question)) {
        node.optional = true;
      }

      if (this.match(types.colon)) {
        var typeCastNode = this.startNodeAt(startPos, startLoc);
        typeCastNode.expression = node;
        typeCastNode.typeAnnotation = this.tsParseTypeAnnotation();
        return this.finishNode(typeCastNode, "TSTypeCastExpression");
      }

      return node;
    };

    _proto.parseExportDeclaration = function parseExportDeclaration(node) {
      var isDeclare = this.eatContextual("declare");
      var declaration;

      if (this.match(types.name)) {
        declaration = this.tsTryParseExportDeclaration();
      }

      if (!declaration) {
        declaration = _superClass.prototype.parseExportDeclaration.call(this, node);
      }

      if (declaration && isDeclare) {
        declaration.declare = true;
      }

      return declaration;
    };

    _proto.parseClassId = function parseClassId(node, isStatement, optionalId) {
      if ((!isStatement || optionalId) && this.isContextual("implements")) {
        return;
      }

      _superClass.prototype.parseClassId.apply(this, arguments);

      var typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) node.typeParameters = typeParameters;
    };

    _proto.parseClassProperty = function parseClassProperty(node) {
      if (!node.optional && this.eat(types.bang)) {
        node.definite = true;
      }

      var type = this.tsTryParseTypeAnnotation();
      if (type) node.typeAnnotation = type;
      return _superClass.prototype.parseClassProperty.call(this, node);
    };

    _proto.pushClassMethod = function pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor) {
      var typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) method.typeParameters = typeParameters;

      _superClass.prototype.pushClassMethod.call(this, classBody, method, isGenerator, isAsync, isConstructor);
    };

    _proto.pushClassPrivateMethod = function pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
      var typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) method.typeParameters = typeParameters;

      _superClass.prototype.pushClassPrivateMethod.call(this, classBody, method, isGenerator, isAsync);
    };

    _proto.parseClassSuper = function parseClassSuper(node) {
      _superClass.prototype.parseClassSuper.call(this, node);

      if (node.superClass && this.isRelational("<")) {
        node.superTypeParameters = this.tsParseTypeArguments();
      }

      if (this.eatContextual("implements")) {
        node.implements = this.tsParseHeritageClause();
      }
    };

    _proto.parseObjPropValue = function parseObjPropValue(prop) {
      var _superClass$prototype;

      var typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) prop.typeParameters = typeParameters;

      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      (_superClass$prototype = _superClass.prototype.parseObjPropValue).call.apply(_superClass$prototype, [this, prop].concat(args));
    };

    _proto.parseFunctionParams = function parseFunctionParams(node, allowModifiers) {
      var typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) node.typeParameters = typeParameters;

      _superClass.prototype.parseFunctionParams.call(this, node, allowModifiers);
    };

    _proto.parseVarHead = function parseVarHead(decl) {
      _superClass.prototype.parseVarHead.call(this, decl);

      if (decl.id.type === "Identifier" && this.eat(types.bang)) {
        decl.definite = true;
      }

      var type = this.tsTryParseTypeAnnotation();

      if (type) {
        decl.id.typeAnnotation = type;
        this.finishNode(decl.id, decl.id.type);
      }
    };

    _proto.parseAsyncArrowFromCallExpression = function parseAsyncArrowFromCallExpression(node, call) {
      if (this.match(types.colon)) {
        node.returnType = this.tsParseTypeAnnotation();
      }

      return _superClass.prototype.parseAsyncArrowFromCallExpression.call(this, node, call);
    };

    _proto.parseMaybeAssign = function parseMaybeAssign() {
      var jsxError;

      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      if (this.match(types.jsxTagStart)) {
        var context = this.curContext();
        assert(context === types$1.j_oTag);
        assert(this.state.context[this.state.context.length - 2] === types$1.j_expr);

        var _state = this.state.clone();

        try {
          var _superClass$prototype2;

          return (_superClass$prototype2 = _superClass.prototype.parseMaybeAssign).call.apply(_superClass$prototype2, [this].concat(args));
        } catch (err) {
          if (!(err instanceof SyntaxError)) {
            throw err;
          }

          this.state = _state;
          assert(this.curContext() === types$1.j_oTag);
          this.state.context.pop();
          assert(this.curContext() === types$1.j_expr);
          this.state.context.pop();
          jsxError = err;
        }
      }

      if (jsxError === undefined && !this.isRelational("<")) {
        var _superClass$prototype3;

        return (_superClass$prototype3 = _superClass.prototype.parseMaybeAssign).call.apply(_superClass$prototype3, [this].concat(args));
      }

      var arrowExpression;
      var typeParameters;
      var state = this.state.clone();

      try {
        var _superClass$prototype4;

        typeParameters = this.tsParseTypeParameters();
        arrowExpression = (_superClass$prototype4 = _superClass.prototype.parseMaybeAssign).call.apply(_superClass$prototype4, [this].concat(args));

        if (arrowExpression.type !== "ArrowFunctionExpression") {
          this.unexpected();
        }
      } catch (err) {
        var _superClass$prototype5;

        if (!(err instanceof SyntaxError)) {
          throw err;
        }

        if (jsxError) {
          throw jsxError;
        }

        assert(!this.hasPlugin("jsx"));
        this.state = state;
        return (_superClass$prototype5 = _superClass.prototype.parseMaybeAssign).call.apply(_superClass$prototype5, [this].concat(args));
      }

      if (typeParameters && typeParameters.params.length !== 0) {
        this.resetStartLocationFromNode(arrowExpression, typeParameters.params[0]);
      }

      arrowExpression.typeParameters = typeParameters;
      return arrowExpression;
    };

    _proto.parseMaybeUnary = function parseMaybeUnary(refShorthandDefaultPos) {
      if (!this.hasPlugin("jsx") && this.eatRelational("<")) {
        return this.tsParseTypeAssertion();
      } else {
        return _superClass.prototype.parseMaybeUnary.call(this, refShorthandDefaultPos);
      }
    };

    _proto.parseArrow = function parseArrow(node) {
      if (this.match(types.colon)) {
        var state = this.state.clone();

        try {
          var returnType = this.tsParseTypeOrTypePredicateAnnotation(types.colon);
          if (this.canInsertSemicolon()) this.unexpected();
          if (!this.match(types.arrow)) this.unexpected();
          node.returnType = returnType;
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;
          } else {
            throw err;
          }
        }
      }

      return _superClass.prototype.parseArrow.call(this, node);
    };

    _proto.parseAssignableListItemTypes = function parseAssignableListItemTypes(param) {
      if (this.eat(types.question)) {
        if (param.type !== "Identifier") {
          throw this.raise(param.start, "A binding pattern parameter cannot be optional in an implementation signature.");
        }

        param.optional = true;
      }

      var type = this.tsTryParseTypeAnnotation();
      if (type) param.typeAnnotation = type;
      return this.finishNode(param, param.type);
    };

    _proto.toAssignable = function toAssignable(node, isBinding, contextDescription) {
      switch (node.type) {
        case "TSTypeCastExpression":
          return _superClass.prototype.toAssignable.call(this, this.typeCastToParameter(node), isBinding, contextDescription);

        case "TSParameterProperty":
          return _superClass.prototype.toAssignable.call(this, node, isBinding, contextDescription);

        case "TSAsExpression":
        case "TSNonNullExpression":
        case "TSTypeAssertion":
          node.expression = this.toAssignable(node.expression, isBinding, contextDescription);
          return node;

        default:
          return _superClass.prototype.toAssignable.call(this, node, isBinding, contextDescription);
      }
    };

    _proto.checkLVal = function checkLVal(expr, isBinding, checkClashes, contextDescription) {
      switch (expr.type) {
        case "TSTypeCastExpression":
          return;

        case "TSParameterProperty":
          this.checkLVal(expr.parameter, isBinding, checkClashes, "parameter property");
          return;

        case "TSAsExpression":
        case "TSNonNullExpression":
        case "TSTypeAssertion":
          this.checkLVal(expr.expression, isBinding, checkClashes, contextDescription);
          return;

        default:
          _superClass.prototype.checkLVal.call(this, expr, isBinding, checkClashes, contextDescription);

          return;
      }
    };

    _proto.parseBindingAtom = function parseBindingAtom() {
      switch (this.state.type) {
        case types._this:
          return this.parseIdentifier(true);

        default:
          return _superClass.prototype.parseBindingAtom.call(this);
      }
    };

    _proto.parseMaybeDecoratorArguments = function parseMaybeDecoratorArguments(expr) {
      if (this.isRelational("<")) {
        var typeArguments = this.tsParseTypeArguments();

        if (this.match(types.parenL)) {
          var call = _superClass.prototype.parseMaybeDecoratorArguments.call(this, expr);

          call.typeParameters = typeArguments;
          return call;
        }

        this.unexpected(this.state.start, types.parenL);
      }

      return _superClass.prototype.parseMaybeDecoratorArguments.call(this, expr);
    };

    _proto.isClassMethod = function isClassMethod() {
      return this.isRelational("<") || _superClass.prototype.isClassMethod.call(this);
    };

    _proto.isClassProperty = function isClassProperty() {
      return this.match(types.bang) || this.match(types.colon) || _superClass.prototype.isClassProperty.call(this);
    };

    _proto.parseMaybeDefault = function parseMaybeDefault() {
      var _superClass$prototype6;

      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      var node = (_superClass$prototype6 = _superClass.prototype.parseMaybeDefault).call.apply(_superClass$prototype6, [this].concat(args));

      if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
        this.raise(node.typeAnnotation.start, "Type annotations must come before default assignments, " + "e.g. instead of `age = 25: number` use `age: number = 25`");
      }

      return node;
    };

    _proto.readToken = function readToken(code) {
      if (this.state.inType && (code === 62 || code === 60)) {
        return this.finishOp(types.relational, 1);
      } else {
        return _superClass.prototype.readToken.call(this, code);
      }
    };

    _proto.toAssignableList = function toAssignableList(exprList, isBinding, contextDescription) {
      for (var i = 0; i < exprList.length; i++) {
        var expr = exprList[i];

        if (expr && expr.type === "TSTypeCastExpression") {
          exprList[i] = this.typeCastToParameter(expr);
        }
      }

      return _superClass.prototype.toAssignableList.call(this, exprList, isBinding, contextDescription);
    };

    _proto.typeCastToParameter = function typeCastToParameter(node) {
      node.expression.typeAnnotation = node.typeAnnotation;
      return this.finishNodeAt(node.expression, node.expression.type, node.typeAnnotation.end, node.typeAnnotation.loc.end);
    };

    _proto.toReferencedList = function toReferencedList(exprList, isInParens) {
      for (var i = 0; i < exprList.length; i++) {
        var expr = exprList[i];

        if (expr && expr._exprListItem && expr.type === "TsTypeCastExpression") {
          this.raise(expr.start, "Did not expect a type annotation here.");
        }
      }

      return exprList;
    };

    _proto.shouldParseArrow = function shouldParseArrow() {
      return this.match(types.colon) || _superClass.prototype.shouldParseArrow.call(this);
    };

    _proto.shouldParseAsyncArrow = function shouldParseAsyncArrow() {
      return this.match(types.colon) || _superClass.prototype.shouldParseAsyncArrow.call(this);
    };

    _proto.canHaveLeadingDecorator = function canHaveLeadingDecorator() {
      return _superClass.prototype.canHaveLeadingDecorator.call(this) || this.isAbstractClass();
    };

    _proto.jsxParseOpeningElementAfterName = function jsxParseOpeningElementAfterName(node) {
      var _this15 = this;

      var typeArguments = this.tsTryParseAndCatch(function () {
        return _this15.tsParseTypeArguments();
      });
      if (typeArguments) node.typeParameters = typeArguments;
      return _superClass.prototype.jsxParseOpeningElementAfterName.call(this, node);
    };

    return _class;
  }(superClass);
});

function hasPlugin(plugins, name) {
  return plugins.some(function (plugin) {
    if (Array.isArray(plugin)) {
      return plugin[0] === name;
    } else {
      return plugin === name;
    }
  });
}
function getPluginOption(plugins, name, option) {
  var plugin = plugins.find(function (plugin) {
    if (Array.isArray(plugin)) {
      return plugin[0] === name;
    } else {
      return plugin === name;
    }
  });

  if (plugin && Array.isArray(plugin)) {
    return plugin[1][option];
  }

  return null;
}
var PIPELINE_PROPOSALS = ["minimal", "smart"];
function validatePlugins(plugins) {
  if (hasPlugin(plugins, "decorators")) {
    if (hasPlugin(plugins, "decorators-legacy")) {
      throw new Error("Cannot use the decorators and decorators-legacy plugin together");
    }

    var decoratorsBeforeExport = getPluginOption(plugins, "decorators", "decoratorsBeforeExport");

    if (decoratorsBeforeExport == null) {
      throw new Error("The 'decorators' plugin requires a 'decoratorsBeforeExport' option," + " whose value must be a boolean. If you are migrating from" + " Babylon/Babel 6 or want to use the old decorators proposal, you" + " should use the 'decorators-legacy' plugin instead of 'decorators'.");
    } else if (typeof decoratorsBeforeExport !== "boolean") {
      throw new Error("'decoratorsBeforeExport' must be a boolean.");
    }
  }

  if (hasPlugin(plugins, "flow") && hasPlugin(plugins, "typescript")) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }

  if (hasPlugin(plugins, "pipelineOperator") && !PIPELINE_PROPOSALS.includes(getPluginOption(plugins, "pipelineOperator", "proposal"))) {
    throw new Error("'pipelineOperator' requires 'proposal' option whose value should be one of: " + PIPELINE_PROPOSALS.map(function (p) {
      return "'" + p + "'";
    }).join(", "));
  }
}
var mixinPluginNames = ["estree", "jsx", "flow", "typescript"];
var mixinPlugins = {
  estree: estree,
  jsx: jsx,
  flow: flow,
  typescript: typescript
};

function parse(input, options) {
  if (options && options.sourceType === "unambiguous") {
    options = Object.assign({}, options);

    try {
      options.sourceType = "module";
      var parser = getParser(options, input);
      var ast = parser.parse();
      if (!parser.sawUnambiguousESM) ast.program.sourceType = "script";
      return ast;
    } catch (moduleError) {
      try {
        options.sourceType = "script";
        return getParser(options, input).parse();
      } catch (scriptError) {}

      throw moduleError;
    }
  } else {
    return getParser(options, input).parse();
  }
}
function parseExpression(input, options) {
  var parser = getParser(options, input);

  if (parser.options.strictMode) {
    parser.state.strict = true;
  }

  return parser.getExpression();
}
function getParser(options, input) {
  var cls = Parser;

  if (options && options.plugins) {
    validatePlugins(options.plugins);
    cls = getParserClass(options.plugins);
  }

  return new cls(options, input);
}

var parserClassCache = {};

function getParserClass(pluginsFromOptions) {
  var pluginList = mixinPluginNames.filter(function (name) {
    return hasPlugin(pluginsFromOptions, name);
  });
  var key = pluginList.join("/");
  var cls = parserClassCache[key];

  if (!cls) {
    cls = Parser;

    for (var _i2 = 0; _i2 < pluginList.length; _i2++) {
      var plugin = pluginList[_i2];
      cls = mixinPlugins[plugin](cls);
    }

    parserClassCache[key] = cls;
  }

  return cls;
}

exports.parse = parse;
exports.parseExpression = parseExpression;
exports.tokTypes = types;
