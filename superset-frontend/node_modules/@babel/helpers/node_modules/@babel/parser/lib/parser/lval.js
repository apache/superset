"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var _identifier = require("../util/identifier");

var _node = require("./node");

var _scopeflags = require("../util/scopeflags");

var _util = require("./util");

var _location = require("./location");

const unwrapParenthesizedExpression = node => {
  return node.type === "ParenthesizedExpression" ? unwrapParenthesizedExpression(node.expression) : node;
};

class LValParser extends _node.NodeUtils {
  toAssignable(node) {
    var _node$extra, _node$extra3;

    let parenthesized = undefined;

    if (node.type === "ParenthesizedExpression" || ((_node$extra = node.extra) == null ? void 0 : _node$extra.parenthesized)) {
      parenthesized = unwrapParenthesizedExpression(node);

      if (parenthesized.type !== "Identifier" && parenthesized.type !== "MemberExpression") {
        this.raise(node.start, _location.Errors.InvalidParenthesizedAssignment);
      }
    }

    switch (node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
        break;

      case "ObjectExpression":
        node.type = "ObjectPattern";

        for (let i = 0, length = node.properties.length, last = length - 1; i < length; i++) {
          var _node$extra2;

          const prop = node.properties[i];
          const isLast = i === last;
          this.toAssignableObjectExpressionProp(prop, isLast);

          if (isLast && prop.type === "RestElement" && ((_node$extra2 = node.extra) == null ? void 0 : _node$extra2.trailingComma)) {
            this.raiseRestNotLast(node.extra.trailingComma);
          }
        }

        break;

      case "ObjectProperty":
        this.toAssignable(node.value);
        break;

      case "SpreadElement":
        {
          this.checkToRestConversion(node);
          node.type = "RestElement";
          const arg = node.argument;
          this.toAssignable(arg);
          break;
        }

      case "ArrayExpression":
        node.type = "ArrayPattern";
        this.toAssignableList(node.elements, (_node$extra3 = node.extra) == null ? void 0 : _node$extra3.trailingComma);
        break;

      case "AssignmentExpression":
        if (node.operator !== "=") {
          this.raise(node.left.end, _location.Errors.MissingEqInAssignment);
        }

        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left);
        break;

      case "ParenthesizedExpression":
        this.toAssignable(parenthesized);
        break;

      default:
    }

    return node;
  }

  toAssignableObjectExpressionProp(prop, isLast) {
    if (prop.type === "ObjectMethod") {
      const error = prop.kind === "get" || prop.kind === "set" ? _location.Errors.PatternHasAccessor : _location.Errors.PatternHasMethod;
      this.raise(prop.key.start, error);
    } else if (prop.type === "SpreadElement" && !isLast) {
      this.raiseRestNotLast(prop.start);
    } else {
      this.toAssignable(prop);
    }
  }

  toAssignableList(exprList, trailingCommaPos) {
    let end = exprList.length;

    if (end) {
      const last = exprList[end - 1];

      if (last && last.type === "RestElement") {
        --end;
      } else if (last && last.type === "SpreadElement") {
        last.type = "RestElement";
        const arg = last.argument;
        this.toAssignable(arg);

        if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern" && arg.type !== "ObjectPattern") {
          this.unexpected(arg.start);
        }

        if (trailingCommaPos) {
          this.raiseTrailingCommaAfterRest(trailingCommaPos);
        }

        --end;
      }
    }

    for (let i = 0; i < end; i++) {
      const elt = exprList[i];

      if (elt) {
        this.toAssignable(elt);

        if (elt.type === "RestElement") {
          this.raiseRestNotLast(elt.start);
        }
      }
    }

    return exprList;
  }

  toReferencedList(exprList, isParenthesizedExpr) {
    return exprList;
  }

  toReferencedListDeep(exprList, isParenthesizedExpr) {
    this.toReferencedList(exprList, isParenthesizedExpr);

    for (let _i = 0; _i < exprList.length; _i++) {
      const expr = exprList[_i];

      if (expr && expr.type === "ArrayExpression") {
        this.toReferencedListDeep(expr.elements);
      }
    }
  }

  parseSpread(refExpressionErrors, refNeedsArrowPos) {
    const node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssign(false, refExpressionErrors, undefined, refNeedsArrowPos);
    return this.finishNode(node, "SpreadElement");
  }

  parseRestBinding() {
    const node = this.startNode();
    this.next();
    node.argument = this.parseBindingAtom();
    return this.finishNode(node, "RestElement");
  }

  parseBindingAtom() {
    switch (this.state.type) {
      case _types.types.bracketL:
        {
          const node = this.startNode();
          this.next();
          node.elements = this.parseBindingList(_types.types.bracketR, 93, true);
          return this.finishNode(node, "ArrayPattern");
        }

      case _types.types.braceL:
        return this.parseObj(true);
    }

    return this.parseIdentifier();
  }

  parseBindingList(close, closeCharCode, allowEmpty, allowModifiers) {
    const elts = [];
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(_types.types.comma);
      }

      if (allowEmpty && this.match(_types.types.comma)) {
        elts.push(null);
      } else if (this.eat(close)) {
        break;
      } else if (this.match(_types.types.ellipsis)) {
        elts.push(this.parseAssignableListItemTypes(this.parseRestBinding()));
        this.checkCommaAfterRest(closeCharCode);
        this.expect(close);
        break;
      } else {
        const decorators = [];

        if (this.match(_types.types.at) && this.hasPlugin("decorators")) {
          this.raise(this.state.start, _location.Errors.UnsupportedParameterDecorator);
        }

        while (this.match(_types.types.at)) {
          decorators.push(this.parseDecorator());
        }

        elts.push(this.parseAssignableListItem(allowModifiers, decorators));
      }
    }

    return elts;
  }

  parseAssignableListItem(allowModifiers, decorators) {
    const left = this.parseMaybeDefault();
    this.parseAssignableListItemTypes(left);
    const elt = this.parseMaybeDefault(left.start, left.loc.start, left);

    if (decorators.length) {
      left.decorators = decorators;
    }

    return elt;
  }

  parseAssignableListItemTypes(param) {
    return param;
  }

  parseMaybeDefault(startPos, startLoc, left) {
    startLoc = startLoc || this.state.startLoc;
    startPos = startPos || this.state.start;
    left = left || this.parseBindingAtom();
    if (!this.eat(_types.types.eq)) return left;
    const node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssign();
    return this.finishNode(node, "AssignmentPattern");
  }

  checkLVal(expr, bindingType = _scopeflags.BIND_NONE, checkClashes, contextDescription, disallowLetBinding, strictModeChanged = false) {
    switch (expr.type) {
      case "Identifier":
        if (this.state.strict && (strictModeChanged ? (0, _identifier.isStrictBindReservedWord)(expr.name, this.inModule) : (0, _identifier.isStrictBindOnlyReservedWord)(expr.name))) {
          this.raise(expr.start, bindingType === _scopeflags.BIND_NONE ? _location.Errors.StrictEvalArguments : _location.Errors.StrictEvalArgumentsBinding, expr.name);
        }

        if (checkClashes) {
          const key = `_${expr.name}`;

          if (checkClashes[key]) {
            this.raise(expr.start, _location.Errors.ParamDupe);
          } else {
            checkClashes[key] = true;
          }
        }

        if (disallowLetBinding && expr.name === "let") {
          this.raise(expr.start, _location.Errors.LetInLexicalBinding);
        }

        if (!(bindingType & _scopeflags.BIND_NONE)) {
          this.scope.declareName(expr.name, bindingType, expr.start);
        }

        break;

      case "MemberExpression":
        if (bindingType !== _scopeflags.BIND_NONE) {
          this.raise(expr.start, _location.Errors.InvalidPropertyBindingPattern);
        }

        break;

      case "ObjectPattern":
        for (let _i2 = 0, _expr$properties = expr.properties; _i2 < _expr$properties.length; _i2++) {
          let prop = _expr$properties[_i2];
          if (prop.type === "ObjectProperty") prop = prop.value;else if (prop.type === "ObjectMethod") continue;
          this.checkLVal(prop, bindingType, checkClashes, "object destructuring pattern", disallowLetBinding);
        }

        break;

      case "ArrayPattern":
        for (let _i3 = 0, _expr$elements = expr.elements; _i3 < _expr$elements.length; _i3++) {
          const elem = _expr$elements[_i3];

          if (elem) {
            this.checkLVal(elem, bindingType, checkClashes, "array destructuring pattern", disallowLetBinding);
          }
        }

        break;

      case "AssignmentPattern":
        this.checkLVal(expr.left, bindingType, checkClashes, "assignment pattern");
        break;

      case "RestElement":
        this.checkLVal(expr.argument, bindingType, checkClashes, "rest element");
        break;

      case "ParenthesizedExpression":
        this.checkLVal(expr.expression, bindingType, checkClashes, "parenthesized expression");
        break;

      default:
        {
          this.raise(expr.start, bindingType === _scopeflags.BIND_NONE ? _location.Errors.InvalidLhs : _location.Errors.InvalidLhsBinding, contextDescription);
        }
    }
  }

  checkToRestConversion(node) {
    if (node.argument.type !== "Identifier" && node.argument.type !== "MemberExpression") {
      this.raise(node.argument.start, _location.Errors.InvalidRestAssignmentPattern);
    }
  }

  checkCommaAfterRest(close) {
    if (this.match(_types.types.comma)) {
      if (this.lookaheadCharCode() === close) {
        this.raiseTrailingCommaAfterRest(this.state.start);
      } else {
        this.raiseRestNotLast(this.state.start);
      }
    }
  }

  raiseRestNotLast(pos) {
    throw this.raise(pos, _location.Errors.ElementAfterRest);
  }

  raiseTrailingCommaAfterRest(pos) {
    this.raise(pos, _location.Errors.RestTrailingComma);
  }

}

exports.default = LValParser;