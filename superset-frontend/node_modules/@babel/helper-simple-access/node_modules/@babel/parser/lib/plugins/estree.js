"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var N = _interopRequireWildcard(require("../types"));

var _scopeflags = require("../util/scopeflags");

var _location = require("../parser/location");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function isSimpleProperty(node) {
  return node != null && node.type === "Property" && node.kind === "init" && node.method === false;
}

var _default = superClass => class extends superClass {
  estreeParseRegExpLiteral({
    pattern,
    flags
  }) {
    let regex = null;

    try {
      regex = new RegExp(pattern, flags);
    } catch (e) {}

    const node = this.estreeParseLiteral(regex);
    node.regex = {
      pattern,
      flags
    };
    return node;
  }

  estreeParseBigIntLiteral(value) {
    const bigInt = typeof BigInt !== "undefined" ? BigInt(value) : null;
    const node = this.estreeParseLiteral(bigInt);
    node.bigint = String(node.value || value);
    return node;
  }

  estreeParseLiteral(value) {
    return this.parseLiteral(value, "Literal");
  }

  directiveToStmt(directive) {
    const directiveLiteral = directive.value;
    const stmt = this.startNodeAt(directive.start, directive.loc.start);
    const expression = this.startNodeAt(directiveLiteral.start, directiveLiteral.loc.start);
    expression.value = directiveLiteral.value;
    expression.raw = directiveLiteral.extra.raw;
    stmt.expression = this.finishNodeAt(expression, "Literal", directiveLiteral.end, directiveLiteral.loc.end);
    stmt.directive = directiveLiteral.extra.raw.slice(1, -1);
    return this.finishNodeAt(stmt, "ExpressionStatement", directive.end, directive.loc.end);
  }

  initFunction(node, isAsync) {
    super.initFunction(node, isAsync);
    node.expression = false;
  }

  checkDeclaration(node) {
    if (isSimpleProperty(node)) {
      this.checkDeclaration(node.value);
    } else {
      super.checkDeclaration(node);
    }
  }

  checkGetterSetterParams(method) {
    const prop = method;
    const paramCount = prop.kind === "get" ? 0 : 1;
    const start = prop.start;

    if (prop.value.params.length !== paramCount) {
      if (method.kind === "get") {
        this.raise(start, _location.Errors.BadGetterArity);
      } else {
        this.raise(start, _location.Errors.BadSetterArity);
      }
    } else if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
      this.raise(start, _location.Errors.BadSetterRestParameter);
    }
  }

  checkLVal(expr, bindingType = _scopeflags.BIND_NONE, checkClashes, contextDescription, disallowLetBinding) {
    switch (expr.type) {
      case "ObjectPattern":
        expr.properties.forEach(prop => {
          this.checkLVal(prop.type === "Property" ? prop.value : prop, bindingType, checkClashes, "object destructuring pattern", disallowLetBinding);
        });
        break;

      default:
        super.checkLVal(expr, bindingType, checkClashes, contextDescription, disallowLetBinding);
    }
  }

  checkDuplicatedProto(prop, protoRef, refExpressionErrors) {
    if (prop.type === "SpreadElement" || prop.computed || prop.method || prop.shorthand) {
      return;
    }

    const key = prop.key;
    const name = key.type === "Identifier" ? key.name : String(key.value);

    if (name === "__proto__" && prop.kind === "init") {
      if (protoRef.used) {
        if (refExpressionErrors && refExpressionErrors.doubleProto === -1) {
          refExpressionErrors.doubleProto = key.start;
        } else {
          this.raise(key.start, _location.Errors.DuplicateProto);
        }
      }

      protoRef.used = true;
    }
  }

  isValidDirective(stmt) {
    return stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && typeof stmt.expression.value === "string" && (!stmt.expression.extra || !stmt.expression.extra.parenthesized);
  }

  stmtToDirective(stmt) {
    const directive = super.stmtToDirective(stmt);
    const value = stmt.expression.value;
    directive.value.value = value;
    return directive;
  }

  parseBlockBody(node, allowDirectives, topLevel, end) {
    super.parseBlockBody(node, allowDirectives, topLevel, end);
    const directiveStatements = node.directives.map(d => this.directiveToStmt(d));
    node.body = directiveStatements.concat(node.body);
    delete node.directives;
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper) {
    this.parseMethod(method, isGenerator, isAsync, isConstructor, allowsDirectSuper, "ClassMethod", true);

    if (method.typeParameters) {
      method.value.typeParameters = method.typeParameters;
      delete method.typeParameters;
    }

    classBody.body.push(method);
  }

  parseExprAtom(refExpressionErrors) {
    switch (this.state.type) {
      case _types.types.num:
      case _types.types.string:
        return this.estreeParseLiteral(this.state.value);

      case _types.types.regexp:
        return this.estreeParseRegExpLiteral(this.state.value);

      case _types.types.bigint:
        return this.estreeParseBigIntLiteral(this.state.value);

      case _types.types._null:
        return this.estreeParseLiteral(null);

      case _types.types._true:
        return this.estreeParseLiteral(true);

      case _types.types._false:
        return this.estreeParseLiteral(false);

      default:
        return super.parseExprAtom(refExpressionErrors);
    }
  }

  parseLiteral(value, type, startPos, startLoc) {
    const node = super.parseLiteral(value, type, startPos, startLoc);
    node.raw = node.extra.raw;
    delete node.extra;
    return node;
  }

  parseFunctionBody(node, allowExpression, isMethod = false) {
    super.parseFunctionBody(node, allowExpression, isMethod);
    node.expression = node.body.type !== "BlockStatement";
  }

  parseMethod(node, isGenerator, isAsync, isConstructor, allowDirectSuper, type, inClassScope = false) {
    let funcNode = this.startNode();
    funcNode.kind = node.kind;
    funcNode = super.parseMethod(funcNode, isGenerator, isAsync, isConstructor, allowDirectSuper, type, inClassScope);
    funcNode.type = "FunctionExpression";
    delete funcNode.kind;
    node.value = funcNode;
    type = type === "ClassMethod" ? "MethodDefinition" : type;
    return this.finishNode(node, type);
  }

  parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) {
    const node = super.parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc);

    if (node) {
      node.type = "Property";
      if (node.kind === "method") node.kind = "init";
      node.shorthand = false;
    }

    return node;
  }

  parseObjectProperty(prop, startPos, startLoc, isPattern, refExpressionErrors) {
    const node = super.parseObjectProperty(prop, startPos, startLoc, isPattern, refExpressionErrors);

    if (node) {
      node.kind = "init";
      node.type = "Property";
    }

    return node;
  }

  toAssignable(node) {
    if (isSimpleProperty(node)) {
      this.toAssignable(node.value);
      return node;
    }

    return super.toAssignable(node);
  }

  toAssignableObjectExpressionProp(prop, isLast) {
    if (prop.kind === "get" || prop.kind === "set") {
      throw this.raise(prop.key.start, _location.Errors.PatternHasAccessor);
    } else if (prop.method) {
      throw this.raise(prop.key.start, _location.Errors.PatternHasMethod);
    } else {
      super.toAssignableObjectExpressionProp(prop, isLast);
    }
  }

  finishCallExpression(node, optional) {
    super.finishCallExpression(node, optional);

    if (node.callee.type === "Import") {
      node.type = "ImportExpression";
      node.source = node.arguments[0];
      delete node.arguments;
      delete node.callee;
    }

    return node;
  }

  toReferencedListDeep(exprList, isParenthesizedExpr) {
    if (!exprList) {
      return;
    }

    super.toReferencedListDeep(exprList, isParenthesizedExpr);
  }

};

exports.default = _default;