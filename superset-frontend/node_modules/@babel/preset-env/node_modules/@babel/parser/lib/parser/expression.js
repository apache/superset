"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var _context = require("../tokenizer/context");

var N = _interopRequireWildcard(require("../types"));

var _lval = _interopRequireDefault(require("./lval"));

var _identifier = require("../util/identifier");

var _scopeflags = require("../util/scopeflags");

var _util = require("./util");

var _productionParameter = require("../util/production-parameter");

var _location = require("./location");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class ExpressionParser extends _lval.default {
  checkDuplicatedProto(prop, protoRef, refExpressionErrors) {
    if (prop.type === "SpreadElement" || prop.computed || prop.kind || prop.shorthand) {
      return;
    }

    const key = prop.key;
    const name = key.type === "Identifier" ? key.name : String(key.value);

    if (name === "__proto__") {
      if (protoRef.used) {
        if (refExpressionErrors) {
          if (refExpressionErrors.doubleProto === -1) {
            refExpressionErrors.doubleProto = key.start;
          }
        } else {
          this.raise(key.start, _location.Errors.DuplicateProto);
        }
      }

      protoRef.used = true;
    }
  }

  getExpression() {
    let paramFlags = _productionParameter.PARAM;

    if (this.hasPlugin("topLevelAwait") && this.inModule) {
      paramFlags |= _productionParameter.PARAM_AWAIT;
    }

    this.scope.enter(_scopeflags.SCOPE_PROGRAM);
    this.prodParam.enter(paramFlags);
    this.nextToken();
    const expr = this.parseExpression();

    if (!this.match(_types.types.eof)) {
      this.unexpected();
    }

    expr.comments = this.state.comments;
    expr.errors = this.state.errors;
    return expr;
  }

  parseExpression(noIn, refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const expr = this.parseMaybeAssign(noIn, refExpressionErrors);

    if (this.match(_types.types.comma)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];

      while (this.eat(_types.types.comma)) {
        node.expressions.push(this.parseMaybeAssign(noIn, refExpressionErrors));
      }

      this.toReferencedList(node.expressions);
      return this.finishNode(node, "SequenceExpression");
    }

    return expr;
  }

  parseMaybeAssign(noIn, refExpressionErrors, afterLeftParse, refNeedsArrowPos) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;

    if (this.isContextual("yield")) {
      if (this.prodParam.hasYield) {
        let left = this.parseYield(noIn);

        if (afterLeftParse) {
          left = afterLeftParse.call(this, left, startPos, startLoc);
        }

        return left;
      } else {
        this.state.exprAllowed = false;
      }
    }

    let ownExpressionErrors;

    if (refExpressionErrors) {
      ownExpressionErrors = false;
    } else {
      refExpressionErrors = new _util.ExpressionErrors();
      ownExpressionErrors = true;
    }

    if (this.match(_types.types.parenL) || this.match(_types.types.name)) {
      this.state.potentialArrowAt = this.state.start;
    }

    let left = this.parseMaybeConditional(noIn, refExpressionErrors, refNeedsArrowPos);

    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }

    if (this.state.type.isAssign) {
      const node = this.startNodeAt(startPos, startLoc);
      const operator = this.state.value;
      node.operator = operator;

      if (operator === "??=") {
        this.expectPlugin("logicalAssignment");
      }

      if (operator === "||=" || operator === "&&=") {
        this.expectPlugin("logicalAssignment");
      }

      if (this.match(_types.types.eq)) {
        node.left = this.toAssignable(left);
        refExpressionErrors.doubleProto = -1;
      } else {
        node.left = left;
      }

      if (refExpressionErrors.shorthandAssign >= node.left.start) {
        refExpressionErrors.shorthandAssign = -1;
      }

      this.checkLVal(left, undefined, undefined, "assignment expression");
      this.next();
      node.right = this.parseMaybeAssign(noIn);
      return this.finishNode(node, "AssignmentExpression");
    } else if (ownExpressionErrors) {
      this.checkExpressionErrors(refExpressionErrors, true);
    }

    return left;
  }

  parseMaybeConditional(noIn, refExpressionErrors, refNeedsArrowPos) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprOps(noIn, refExpressionErrors);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    if (this.checkExpressionErrors(refExpressionErrors, false)) return expr;
    return this.parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos);
  }

  parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos) {
    if (this.eat(_types.types.question)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.test = expr;
      node.consequent = this.parseMaybeAssign();
      this.expect(_types.types.colon);
      node.alternate = this.parseMaybeAssign(noIn);
      return this.finishNode(node, "ConditionalExpression");
    }

    return expr;
  }

  parseExprOps(noIn, refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseMaybeUnary(refExpressionErrors);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    if (this.checkExpressionErrors(refExpressionErrors, false)) {
      return expr;
    }

    return this.parseExprOp(expr, startPos, startLoc, -1, noIn);
  }

  parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn) {
    let prec = this.state.type.binop;

    if (prec != null && (!noIn || !this.match(_types.types._in))) {
      if (prec > minPrec) {
        const operator = this.state.value;

        if (operator === "|>" && this.state.inFSharpPipelineDirectBody) {
          return left;
        }

        const node = this.startNodeAt(leftStartPos, leftStartLoc);
        node.left = left;
        node.operator = operator;

        if (operator === "**" && left.type === "UnaryExpression" && (this.options.createParenthesizedExpressions || !(left.extra && left.extra.parenthesized))) {
          this.raise(left.argument.start, _location.Errors.UnexpectedTokenUnaryExponentiation);
        }

        const op = this.state.type;
        const logical = op === _types.types.logicalOR || op === _types.types.logicalAND;
        const coalesce = op === _types.types.nullishCoalescing;

        if (op === _types.types.pipeline) {
          this.expectPlugin("pipelineOperator");
          this.state.inPipeline = true;
          this.checkPipelineAtInfixOperator(left, leftStartPos);
        } else if (coalesce) {
          prec = _types.types.logicalAND.binop;
        }

        this.next();

        if (op === _types.types.pipeline && this.getPluginOption("pipelineOperator", "proposal") === "minimal") {
          if (this.match(_types.types.name) && this.state.value === "await" && this.prodParam.hasAwait) {
            throw this.raise(this.state.start, _location.Errors.UnexpectedAwaitAfterPipelineBody);
          }
        }

        node.right = this.parseExprOpRightExpr(op, prec, noIn);
        this.finishNode(node, logical || coalesce ? "LogicalExpression" : "BinaryExpression");
        const nextOp = this.state.type;

        if (coalesce && (nextOp === _types.types.logicalOR || nextOp === _types.types.logicalAND) || logical && nextOp === _types.types.nullishCoalescing) {
          throw this.raise(this.state.start, _location.Errors.MixingCoalesceWithLogical);
        }

        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
      }
    }

    return left;
  }

  parseExprOpRightExpr(op, prec, noIn) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;

    switch (op) {
      case _types.types.pipeline:
        switch (this.getPluginOption("pipelineOperator", "proposal")) {
          case "smart":
            return this.withTopicPermittingContext(() => {
              return this.parseSmartPipelineBody(this.parseExprOpBaseRightExpr(op, prec, noIn), startPos, startLoc);
            });

          case "fsharp":
            return this.withSoloAwaitPermittingContext(() => {
              return this.parseFSharpPipelineBody(prec, noIn);
            });
        }

      default:
        return this.parseExprOpBaseRightExpr(op, prec, noIn);
    }
  }

  parseExprOpBaseRightExpr(op, prec, noIn) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    return this.parseExprOp(this.parseMaybeUnary(), startPos, startLoc, op.rightAssociative ? prec - 1 : prec, noIn);
  }

  parseMaybeUnary(refExpressionErrors) {
    if (this.isContextual("await") && this.isAwaitAllowed()) {
      return this.parseAwait();
    } else if (this.state.type.prefix) {
      const node = this.startNode();
      const update = this.match(_types.types.incDec);
      node.operator = this.state.value;
      node.prefix = true;

      if (node.operator === "throw") {
        this.expectPlugin("throwExpressions");
      }

      this.next();
      node.argument = this.parseMaybeUnary();
      this.checkExpressionErrors(refExpressionErrors, true);

      if (update) {
        this.checkLVal(node.argument, undefined, undefined, "prefix operation");
      } else if (this.state.strict && node.operator === "delete") {
        const arg = node.argument;

        if (arg.type === "Identifier") {
          this.raise(node.start, _location.Errors.StrictDelete);
        } else if (arg.type === "MemberExpression" && arg.property.type === "PrivateName") {
          this.raise(node.start, _location.Errors.DeletePrivateField);
        }
      }

      return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
    }

    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let expr = this.parseExprSubscripts(refExpressionErrors);
    if (this.checkExpressionErrors(refExpressionErrors, false)) return expr;

    while (this.state.type.postfix && !this.canInsertSemicolon()) {
      const node = this.startNodeAt(startPos, startLoc);
      node.operator = this.state.value;
      node.prefix = false;
      node.argument = expr;
      this.checkLVal(expr, undefined, undefined, "postfix operation");
      this.next();
      expr = this.finishNode(node, "UpdateExpression");
    }

    return expr;
  }

  parseExprSubscripts(refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprAtom(refExpressionErrors);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    return this.parseSubscripts(expr, startPos, startLoc);
  }

  parseSubscripts(base, startPos, startLoc, noCalls) {
    const state = {
      optionalChainMember: false,
      maybeAsyncArrow: this.atPossibleAsync(base),
      stop: false
    };

    do {
      base = this.parseSubscript(base, startPos, startLoc, noCalls, state);
      state.maybeAsyncArrow = false;
    } while (!state.stop);

    return base;
  }

  parseSubscript(base, startPos, startLoc, noCalls, state) {
    if (!noCalls && this.eat(_types.types.doubleColon)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.callee = this.parseNoCallExpr();
      state.stop = true;
      return this.parseSubscripts(this.finishNode(node, "BindExpression"), startPos, startLoc, noCalls);
    }

    let optional = false;

    if (this.match(_types.types.questionDot)) {
      state.optionalChainMember = optional = true;

      if (noCalls && this.lookaheadCharCode() === 40) {
        state.stop = true;
        return base;
      }

      this.next();
    }

    const computed = this.eat(_types.types.bracketL);

    if (optional && !this.match(_types.types.parenL) && !this.match(_types.types.backQuote) || computed || this.eat(_types.types.dot)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = computed ? this.parseExpression() : optional ? this.parseIdentifier(true) : this.parseMaybePrivateName(true);
      node.computed = computed;

      if (node.property.type === "PrivateName") {
        if (node.object.type === "Super") {
          this.raise(startPos, _location.Errors.SuperPrivateField);
        }

        this.classScope.usePrivateName(node.property.id.name, node.property.start);
      }

      if (computed) {
        this.expect(_types.types.bracketR);
      }

      if (state.optionalChainMember) {
        node.optional = optional;
        return this.finishNode(node, "OptionalMemberExpression");
      } else {
        return this.finishNode(node, "MemberExpression");
      }
    } else if (!noCalls && this.match(_types.types.parenL)) {
      const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
      const oldYieldPos = this.state.yieldPos;
      const oldAwaitPos = this.state.awaitPos;
      this.state.maybeInArrowParameters = true;
      this.state.yieldPos = -1;
      this.state.awaitPos = -1;
      this.next();
      let node = this.startNodeAt(startPos, startLoc);
      node.callee = base;

      if (optional) {
        node.optional = true;
        node.arguments = this.parseCallExpressionArguments(_types.types.parenR, false);
      } else {
        node.arguments = this.parseCallExpressionArguments(_types.types.parenR, state.maybeAsyncArrow, base.type === "Import", base.type !== "Super", node);
      }

      this.finishCallExpression(node, state.optionalChainMember);

      if (state.maybeAsyncArrow && this.shouldParseAsyncArrow() && !optional) {
        state.stop = true;
        node = this.parseAsyncArrowFromCallExpression(this.startNodeAt(startPos, startLoc), node);
        this.checkYieldAwaitInDefaultParams();
        this.state.yieldPos = oldYieldPos;
        this.state.awaitPos = oldAwaitPos;
      } else {
        this.toReferencedListDeep(node.arguments);
        if (oldYieldPos !== -1) this.state.yieldPos = oldYieldPos;

        if (!this.isAwaitAllowed() && !oldMaybeInArrowParameters || oldAwaitPos !== -1) {
          this.state.awaitPos = oldAwaitPos;
        }
      }

      this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
      return node;
    } else if (this.match(_types.types.backQuote)) {
      return this.parseTaggedTemplateExpression(startPos, startLoc, base, state);
    } else {
      state.stop = true;
      return base;
    }
  }

  parseTaggedTemplateExpression(startPos, startLoc, base, state, typeArguments) {
    const node = this.startNodeAt(startPos, startLoc);
    node.tag = base;
    node.quasi = this.parseTemplate(true);
    if (typeArguments) node.typeParameters = typeArguments;

    if (state.optionalChainMember) {
      this.raise(startPos, _location.Errors.OptionalChainingNoTemplate);
    }

    return this.finishNode(node, "TaggedTemplateExpression");
  }

  atPossibleAsync(base) {
    return base.type === "Identifier" && base.name === "async" && this.state.lastTokEnd === base.end && !this.canInsertSemicolon() && this.input.slice(base.start, base.end) === "async";
  }

  finishCallExpression(node, optional) {
    if (node.callee.type === "Import") {
      if (node.arguments.length !== 1) {
        this.raise(node.start, _location.Errors.ImportCallArity);
      } else {
        const importArg = node.arguments[0];

        if (importArg && importArg.type === "SpreadElement") {
          this.raise(importArg.start, _location.Errors.ImportCallSpreadArgument);
        }
      }
    }

    return this.finishNode(node, optional ? "OptionalCallExpression" : "CallExpression");
  }

  parseCallExpressionArguments(close, possibleAsyncArrow, dynamicImport, allowPlaceholder, nodeForExtra) {
    const elts = [];
    let innerParenStart;
    let first = true;
    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.inFSharpPipelineDirectBody = false;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(_types.types.comma);

        if (this.match(close)) {
          if (dynamicImport) {
            this.raise(this.state.lastTokStart, _location.Errors.ImportCallArgumentTrailingComma);
          }

          if (nodeForExtra) {
            this.addExtra(nodeForExtra, "trailingComma", this.state.lastTokStart);
          }

          this.next();
          break;
        }
      }

      if (this.match(_types.types.parenL) && !innerParenStart) {
        innerParenStart = this.state.start;
      }

      elts.push(this.parseExprListItem(false, possibleAsyncArrow ? new _util.ExpressionErrors() : undefined, possibleAsyncArrow ? {
        start: 0
      } : undefined, allowPlaceholder));
    }

    if (possibleAsyncArrow && innerParenStart && this.shouldParseAsyncArrow()) {
      this.unexpected();
    }

    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    return elts;
  }

  shouldParseAsyncArrow() {
    return this.match(_types.types.arrow) && !this.canInsertSemicolon();
  }

  parseAsyncArrowFromCallExpression(node, call) {
    var _call$extra;

    this.expect(_types.types.arrow);
    this.parseArrowExpression(node, call.arguments, true, (_call$extra = call.extra) == null ? void 0 : _call$extra.trailingComma);
    return node;
  }

  parseNoCallExpr() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    return this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  }

  parseExprAtom(refExpressionErrors) {
    if (this.state.type === _types.types.slash) this.readRegexp();
    const canBeArrow = this.state.potentialArrowAt === this.state.start;
    let node;

    switch (this.state.type) {
      case _types.types._super:
        node = this.startNode();
        this.next();

        if (this.match(_types.types.parenL) && !this.scope.allowDirectSuper && !this.options.allowSuperOutsideMethod) {
          this.raise(node.start, _location.Errors.SuperNotAllowed);
        } else if (!this.scope.allowSuper && !this.options.allowSuperOutsideMethod) {
          this.raise(node.start, _location.Errors.UnexpectedSuper);
        }

        if (!this.match(_types.types.parenL) && !this.match(_types.types.bracketL) && !this.match(_types.types.dot)) {
          this.raise(node.start, _location.Errors.UnsupportedSuper);
        }

        return this.finishNode(node, "Super");

      case _types.types._import:
        node = this.startNode();
        this.next();

        if (this.match(_types.types.dot)) {
          return this.parseImportMetaProperty(node);
        }

        if (!this.match(_types.types.parenL)) {
          this.raise(this.state.lastTokStart, _location.Errors.UnsupportedImport);
        }

        return this.finishNode(node, "Import");

      case _types.types._this:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "ThisExpression");

      case _types.types.name:
        {
          node = this.startNode();
          const containsEsc = this.state.containsEsc;
          const id = this.parseIdentifier();

          if (!containsEsc && id.name === "async" && this.match(_types.types._function) && !this.canInsertSemicolon()) {
            const last = this.state.context.length - 1;

            if (this.state.context[last] !== _context.types.functionStatement) {
              throw new Error("Internal error");
            }

            this.state.context[last] = _context.types.functionExpression;
            this.next();
            return this.parseFunction(node, undefined, true);
          } else if (canBeArrow && !containsEsc && id.name === "async" && this.match(_types.types.name) && !this.canInsertSemicolon()) {
            const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
            const oldYieldPos = this.state.yieldPos;
            const oldAwaitPos = this.state.awaitPos;
            this.state.maybeInArrowParameters = true;
            this.state.yieldPos = -1;
            this.state.awaitPos = -1;
            const params = [this.parseIdentifier()];
            this.expect(_types.types.arrow);
            this.checkYieldAwaitInDefaultParams();
            this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
            this.state.yieldPos = oldYieldPos;
            this.state.awaitPos = oldAwaitPos;
            this.parseArrowExpression(node, params, true);
            return node;
          }

          if (canBeArrow && this.match(_types.types.arrow) && !this.canInsertSemicolon()) {
            this.next();
            this.parseArrowExpression(node, [id], false);
            return node;
          }

          return id;
        }

      case _types.types._do:
        {
          this.expectPlugin("doExpressions");
          const node = this.startNode();
          this.next();
          const oldLabels = this.state.labels;
          this.state.labels = [];
          node.body = this.parseBlock();
          this.state.labels = oldLabels;
          return this.finishNode(node, "DoExpression");
        }

      case _types.types.regexp:
        {
          const value = this.state.value;
          node = this.parseLiteral(value.value, "RegExpLiteral");
          node.pattern = value.pattern;
          node.flags = value.flags;
          return node;
        }

      case _types.types.num:
        return this.parseLiteral(this.state.value, "NumericLiteral");

      case _types.types.bigint:
        return this.parseLiteral(this.state.value, "BigIntLiteral");

      case _types.types.string:
        return this.parseLiteral(this.state.value, "StringLiteral");

      case _types.types._null:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "NullLiteral");

      case _types.types._true:
      case _types.types._false:
        return this.parseBooleanLiteral();

      case _types.types.parenL:
        return this.parseParenAndDistinguishExpression(canBeArrow);

      case _types.types.bracketL:
        {
          const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
          this.state.inFSharpPipelineDirectBody = false;
          node = this.startNode();
          this.next();
          node.elements = this.parseExprList(_types.types.bracketR, true, refExpressionErrors, node);

          if (!this.state.maybeInArrowParameters) {
            this.toReferencedList(node.elements);
          }

          this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
          return this.finishNode(node, "ArrayExpression");
        }

      case _types.types.braceL:
        {
          const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
          this.state.inFSharpPipelineDirectBody = false;
          const ret = this.parseObj(false, refExpressionErrors);
          this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
          return ret;
        }

      case _types.types._function:
        return this.parseFunctionExpression();

      case _types.types.at:
        this.parseDecorators();

      case _types.types._class:
        node = this.startNode();
        this.takeDecorators(node);
        return this.parseClass(node, false);

      case _types.types._new:
        return this.parseNew();

      case _types.types.backQuote:
        return this.parseTemplate(false);

      case _types.types.doubleColon:
        {
          node = this.startNode();
          this.next();
          node.object = null;
          const callee = node.callee = this.parseNoCallExpr();

          if (callee.type === "MemberExpression") {
            return this.finishNode(node, "BindExpression");
          } else {
            throw this.raise(callee.start, _location.Errors.UnsupportedBind);
          }
        }

      case _types.types.hash:
        {
          if (this.state.inPipeline) {
            node = this.startNode();

            if (this.getPluginOption("pipelineOperator", "proposal") !== "smart") {
              this.raise(node.start, _location.Errors.PrimaryTopicRequiresSmartPipeline);
            }

            this.next();

            if (!this.primaryTopicReferenceIsAllowedInCurrentTopicContext()) {
              this.raise(node.start, _location.Errors.PrimaryTopicNotAllowed);
            }

            this.registerTopicReference();
            return this.finishNode(node, "PipelinePrimaryTopicReference");
          }
        }

      default:
        throw this.unexpected();
    }
  }

  parseBooleanLiteral() {
    const node = this.startNode();
    node.value = this.match(_types.types._true);
    this.next();
    return this.finishNode(node, "BooleanLiteral");
  }

  parseMaybePrivateName(isPrivateNameAllowed) {
    const isPrivate = this.match(_types.types.hash);

    if (isPrivate) {
      this.expectOnePlugin(["classPrivateProperties", "classPrivateMethods"]);

      if (!isPrivateNameAllowed) {
        this.raise(this.state.pos, _location.Errors.UnexpectedPrivateField);
      }

      const node = this.startNode();
      this.next();
      this.assertNoSpace("Unexpected space between # and identifier");
      node.id = this.parseIdentifier(true);
      return this.finishNode(node, "PrivateName");
    } else {
      return this.parseIdentifier(true);
    }
  }

  parseFunctionExpression() {
    const node = this.startNode();
    let meta = this.startNode();
    this.next();
    meta = this.createIdentifier(meta, "function");

    if (this.prodParam.hasYield && this.eat(_types.types.dot)) {
      return this.parseMetaProperty(node, meta, "sent");
    }

    return this.parseFunction(node);
  }

  parseMetaProperty(node, meta, propertyName) {
    node.meta = meta;

    if (meta.name === "function" && propertyName === "sent") {
      if (this.isContextual(propertyName)) {
        this.expectPlugin("functionSent");
      } else if (!this.hasPlugin("functionSent")) {
        this.unexpected();
      }
    }

    const containsEsc = this.state.containsEsc;
    node.property = this.parseIdentifier(true);

    if (node.property.name !== propertyName || containsEsc) {
      this.raise(node.property.start, _location.Errors.UnsupportedMetaProperty, meta.name, propertyName);
    }

    return this.finishNode(node, "MetaProperty");
  }

  parseImportMetaProperty(node) {
    const id = this.createIdentifier(this.startNodeAtNode(node), "import");
    this.expect(_types.types.dot);

    if (this.isContextual("meta")) {
      this.expectPlugin("importMeta");

      if (!this.inModule) {
        this.raiseWithData(id.start, {
          code: "BABEL_PARSER_SOURCETYPE_MODULE_REQUIRED"
        }, _location.Errors.ImportMetaOutsideModule);
      }

      this.sawUnambiguousESM = true;
    } else if (!this.hasPlugin("importMeta")) {
      this.raise(id.start, _location.Errors.ImportCallArityLtOne);
    }

    return this.parseMetaProperty(node, id, "meta");
  }

  parseLiteral(value, type, startPos, startLoc) {
    startPos = startPos || this.state.start;
    startLoc = startLoc || this.state.startLoc;
    const node = this.startNodeAt(startPos, startLoc);
    this.addExtra(node, "rawValue", value);
    this.addExtra(node, "raw", this.input.slice(startPos, this.state.end));
    node.value = value;
    this.next();
    return this.finishNode(node, type);
  }

  parseParenAndDistinguishExpression(canBeArrow) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let val;
    this.expect(_types.types.parenL);
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldYieldPos = this.state.yieldPos;
    const oldAwaitPos = this.state.awaitPos;
    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.maybeInArrowParameters = true;
    this.state.yieldPos = -1;
    this.state.awaitPos = -1;
    this.state.inFSharpPipelineDirectBody = false;
    const innerStartPos = this.state.start;
    const innerStartLoc = this.state.startLoc;
    const exprList = [];
    const refExpressionErrors = new _util.ExpressionErrors();
    const refNeedsArrowPos = {
      start: 0
    };
    let first = true;
    let spreadStart;
    let optionalCommaStart;

    while (!this.match(_types.types.parenR)) {
      if (first) {
        first = false;
      } else {
        this.expect(_types.types.comma, refNeedsArrowPos.start || null);

        if (this.match(_types.types.parenR)) {
          optionalCommaStart = this.state.start;
          break;
        }
      }

      if (this.match(_types.types.ellipsis)) {
        const spreadNodeStartPos = this.state.start;
        const spreadNodeStartLoc = this.state.startLoc;
        spreadStart = this.state.start;
        exprList.push(this.parseParenItem(this.parseRestBinding(), spreadNodeStartPos, spreadNodeStartLoc));
        this.checkCommaAfterRest(41);
        break;
      } else {
        exprList.push(this.parseMaybeAssign(false, refExpressionErrors, this.parseParenItem, refNeedsArrowPos));
      }
    }

    const innerEndPos = this.state.start;
    const innerEndLoc = this.state.startLoc;
    this.expect(_types.types.parenR);
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    let arrowNode = this.startNodeAt(startPos, startLoc);

    if (canBeArrow && this.shouldParseArrow() && (arrowNode = this.parseArrow(arrowNode))) {
      this.checkYieldAwaitInDefaultParams();
      this.state.yieldPos = oldYieldPos;
      this.state.awaitPos = oldAwaitPos;

      for (let _i = 0; _i < exprList.length; _i++) {
        const param = exprList[_i];

        if (param.extra && param.extra.parenthesized) {
          this.unexpected(param.extra.parenStart);
        }
      }

      this.parseArrowExpression(arrowNode, exprList, false);
      return arrowNode;
    }

    if (oldYieldPos !== -1) this.state.yieldPos = oldYieldPos;
    if (oldAwaitPos !== -1) this.state.awaitPos = oldAwaitPos;

    if (!exprList.length) {
      this.unexpected(this.state.lastTokStart);
    }

    if (optionalCommaStart) this.unexpected(optionalCommaStart);
    if (spreadStart) this.unexpected(spreadStart);
    this.checkExpressionErrors(refExpressionErrors, true);
    if (refNeedsArrowPos.start) this.unexpected(refNeedsArrowPos.start);
    this.toReferencedListDeep(exprList, true);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }

    if (!this.options.createParenthesizedExpressions) {
      this.addExtra(val, "parenthesized", true);
      this.addExtra(val, "parenStart", startPos);
      return val;
    }

    const parenExpression = this.startNodeAt(startPos, startLoc);
    parenExpression.expression = val;
    this.finishNode(parenExpression, "ParenthesizedExpression");
    return parenExpression;
  }

  shouldParseArrow() {
    return !this.canInsertSemicolon();
  }

  parseArrow(node) {
    if (this.eat(_types.types.arrow)) {
      return node;
    }
  }

  parseParenItem(node, startPos, startLoc) {
    return node;
  }

  parseNew() {
    const node = this.startNode();
    let meta = this.startNode();
    this.next();
    meta = this.createIdentifier(meta, "new");

    if (this.eat(_types.types.dot)) {
      const metaProp = this.parseMetaProperty(node, meta, "target");

      if (!this.scope.inNonArrowFunction && !this.scope.inClass) {
        let error = _location.Errors.UnexpectedNewTarget;

        if (this.hasPlugin("classProperties")) {
          error += " or class properties";
        }

        this.raise(metaProp.start, error);
      }

      return metaProp;
    }

    node.callee = this.parseNoCallExpr();

    if (node.callee.type === "Import") {
      this.raise(node.callee.start, _location.Errors.ImportCallNotNewExpression);
    } else if (node.callee.type === "OptionalMemberExpression" || node.callee.type === "OptionalCallExpression") {
      this.raise(this.state.lastTokEnd, _location.Errors.OptionalChainingNoNew);
    } else if (this.eat(_types.types.questionDot)) {
      this.raise(this.state.start, _location.Errors.OptionalChainingNoNew);
    }

    this.parseNewArguments(node);
    return this.finishNode(node, "NewExpression");
  }

  parseNewArguments(node) {
    if (this.eat(_types.types.parenL)) {
      const args = this.parseExprList(_types.types.parenR);
      this.toReferencedList(args);
      node.arguments = args;
    } else {
      node.arguments = [];
    }
  }

  parseTemplateElement(isTagged) {
    const elem = this.startNode();

    if (this.state.value === null) {
      if (!isTagged) {
        this.raise(this.state.start + 1, _location.Errors.InvalidEscapeSequenceTemplate);
      }
    }

    elem.value = {
      raw: this.input.slice(this.state.start, this.state.end).replace(/\r\n?/g, "\n"),
      cooked: this.state.value
    };
    this.next();
    elem.tail = this.match(_types.types.backQuote);
    return this.finishNode(elem, "TemplateElement");
  }

  parseTemplate(isTagged) {
    const node = this.startNode();
    this.next();
    node.expressions = [];
    let curElt = this.parseTemplateElement(isTagged);
    node.quasis = [curElt];

    while (!curElt.tail) {
      this.expect(_types.types.dollarBraceL);
      node.expressions.push(this.parseExpression());
      this.expect(_types.types.braceR);
      node.quasis.push(curElt = this.parseTemplateElement(isTagged));
    }

    this.next();
    return this.finishNode(node, "TemplateLiteral");
  }

  parseObj(isPattern, refExpressionErrors) {
    const propHash = Object.create(null);
    let first = true;
    const node = this.startNode();
    node.properties = [];
    this.next();

    while (!this.eat(_types.types.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(_types.types.comma);

        if (this.match(_types.types.braceR)) {
          this.addExtra(node, "trailingComma", this.state.lastTokStart);
          this.next();
          break;
        }
      }

      const prop = this.parseObjectMember(isPattern, refExpressionErrors);

      if (!isPattern) {
        this.checkDuplicatedProto(prop, propHash, refExpressionErrors);
      }

      if (prop.shorthand) {
        this.addExtra(prop, "shorthand", true);
      }

      node.properties.push(prop);
    }

    return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
  }

  isAsyncProp(prop) {
    return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.match(_types.types.name) || this.match(_types.types.num) || this.match(_types.types.string) || this.match(_types.types.bracketL) || this.state.type.keyword || this.match(_types.types.star)) && !this.hasPrecedingLineBreak();
  }

  parseObjectMember(isPattern, refExpressionErrors) {
    let decorators = [];

    if (this.match(_types.types.at)) {
      if (this.hasPlugin("decorators")) {
        this.raise(this.state.start, _location.Errors.UnsupportedPropertyDecorator);
      }

      while (this.match(_types.types.at)) {
        decorators.push(this.parseDecorator());
      }
    }

    const prop = this.startNode();
    let isGenerator = false;
    let isAsync = false;
    let startPos;
    let startLoc;

    if (this.match(_types.types.ellipsis)) {
      if (decorators.length) this.unexpected();

      if (isPattern) {
        this.next();
        prop.argument = this.parseIdentifier();
        this.checkCommaAfterRest(125);
        return this.finishNode(prop, "RestElement");
      }

      return this.parseSpread();
    }

    if (decorators.length) {
      prop.decorators = decorators;
      decorators = [];
    }

    prop.method = false;

    if (isPattern || refExpressionErrors) {
      startPos = this.state.start;
      startLoc = this.state.startLoc;
    }

    if (!isPattern) {
      isGenerator = this.eat(_types.types.star);
    }

    const containsEsc = this.state.containsEsc;
    this.parsePropertyName(prop, false);

    if (!isPattern && !containsEsc && !isGenerator && this.isAsyncProp(prop)) {
      isAsync = true;
      isGenerator = this.eat(_types.types.star);
      this.parsePropertyName(prop, false);
    } else {
      isAsync = false;
    }

    this.parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refExpressionErrors, containsEsc);
    return prop;
  }

  isGetterOrSetterMethod(prop, isPattern) {
    return !isPattern && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.match(_types.types.string) || this.match(_types.types.num) || this.match(_types.types.bracketL) || this.match(_types.types.name) || !!this.state.type.keyword);
  }

  getGetterSetterExpectedParamCount(method) {
    return method.kind === "get" ? 0 : 1;
  }

  checkGetterSetterParams(method) {
    const paramCount = this.getGetterSetterExpectedParamCount(method);
    const start = method.start;

    if (method.params.length !== paramCount) {
      if (method.kind === "get") {
        this.raise(start, _location.Errors.BadGetterArity);
      } else {
        this.raise(start, _location.Errors.BadSetterArity);
      }
    }

    if (method.kind === "set" && method.params[method.params.length - 1].type === "RestElement") {
      this.raise(start, _location.Errors.BadSetterRestParameter);
    }
  }

  parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) {
    if (isAsync || isGenerator || this.match(_types.types.parenL)) {
      if (isPattern) this.unexpected();
      prop.kind = "method";
      prop.method = true;
      return this.parseMethod(prop, isGenerator, isAsync, false, false, "ObjectMethod");
    }

    if (!containsEsc && this.isGetterOrSetterMethod(prop, isPattern)) {
      if (isGenerator || isAsync) this.unexpected();
      prop.kind = prop.key.name;
      this.parsePropertyName(prop, false);
      this.parseMethod(prop, false, false, false, false, "ObjectMethod");
      this.checkGetterSetterParams(prop);
      return prop;
    }
  }

  parseObjectProperty(prop, startPos, startLoc, isPattern, refExpressionErrors) {
    prop.shorthand = false;

    if (this.eat(_types.types.colon)) {
      prop.value = isPattern ? this.parseMaybeDefault(this.state.start, this.state.startLoc) : this.parseMaybeAssign(false, refExpressionErrors);
      return this.finishNode(prop, "ObjectProperty");
    }

    if (!prop.computed && prop.key.type === "Identifier") {
      this.checkReservedWord(prop.key.name, prop.key.start, true, true);

      if (isPattern) {
        prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key.__clone());
      } else if (this.match(_types.types.eq) && refExpressionErrors) {
        if (refExpressionErrors.shorthandAssign === -1) {
          refExpressionErrors.shorthandAssign = this.state.start;
        }

        prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key.__clone());
      } else {
        prop.value = prop.key.__clone();
      }

      prop.shorthand = true;
      return this.finishNode(prop, "ObjectProperty");
    }
  }

  parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refExpressionErrors, containsEsc) {
    const node = this.parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) || this.parseObjectProperty(prop, startPos, startLoc, isPattern, refExpressionErrors);
    if (!node) this.unexpected();
    return node;
  }

  parsePropertyName(prop, isPrivateNameAllowed) {
    if (this.eat(_types.types.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(_types.types.bracketR);
    } else {
      const oldInPropertyName = this.state.inPropertyName;
      this.state.inPropertyName = true;
      prop.key = this.match(_types.types.num) || this.match(_types.types.string) || this.match(_types.types.bigint) ? this.parseExprAtom() : this.parseMaybePrivateName(isPrivateNameAllowed);

      if (prop.key.type !== "PrivateName") {
        prop.computed = false;
      }

      this.state.inPropertyName = oldInPropertyName;
    }

    return prop.key;
  }

  initFunction(node, isAsync) {
    node.id = null;
    node.generator = false;
    node.async = !!isAsync;
  }

  parseMethod(node, isGenerator, isAsync, isConstructor, allowDirectSuper, type, inClassScope = false) {
    const oldYieldPos = this.state.yieldPos;
    const oldAwaitPos = this.state.awaitPos;
    this.state.yieldPos = -1;
    this.state.awaitPos = -1;
    this.initFunction(node, isAsync);
    node.generator = !!isGenerator;
    const allowModifiers = isConstructor;
    this.scope.enter(_scopeflags.SCOPE_FUNCTION | _scopeflags.SCOPE_SUPER | (inClassScope ? _scopeflags.SCOPE_CLASS : 0) | (allowDirectSuper ? _scopeflags.SCOPE_DIRECT_SUPER : 0));
    this.prodParam.enter((0, _productionParameter.functionFlags)(isAsync, node.generator));
    this.parseFunctionParams(node, allowModifiers);
    this.parseFunctionBodyAndFinish(node, type, true);
    this.prodParam.exit();
    this.scope.exit();
    this.state.yieldPos = oldYieldPos;
    this.state.awaitPos = oldAwaitPos;
    return node;
  }

  parseArrowExpression(node, params, isAsync, trailingCommaPos) {
    this.scope.enter(_scopeflags.SCOPE_FUNCTION | _scopeflags.SCOPE_ARROW);
    this.prodParam.enter((0, _productionParameter.functionFlags)(isAsync, false));
    this.initFunction(node, isAsync);
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldYieldPos = this.state.yieldPos;
    const oldAwaitPos = this.state.awaitPos;

    if (params) {
      this.state.maybeInArrowParameters = true;
      this.setArrowFunctionParameters(node, params, trailingCommaPos);
    }

    this.state.maybeInArrowParameters = false;
    this.state.yieldPos = -1;
    this.state.awaitPos = -1;
    this.parseFunctionBody(node, true);
    this.prodParam.exit();
    this.scope.exit();
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    this.state.yieldPos = oldYieldPos;
    this.state.awaitPos = oldAwaitPos;
    return this.finishNode(node, "ArrowFunctionExpression");
  }

  setArrowFunctionParameters(node, params, trailingCommaPos) {
    node.params = this.toAssignableList(params, trailingCommaPos);
  }

  parseFunctionBodyAndFinish(node, type, isMethod = false) {
    this.parseFunctionBody(node, false, isMethod);
    this.finishNode(node, type);
  }

  parseFunctionBody(node, allowExpression, isMethod = false) {
    const isExpression = allowExpression && !this.match(_types.types.braceL);
    const oldInParameters = this.state.inParameters;
    this.state.inParameters = false;

    if (isExpression) {
      node.body = this.parseMaybeAssign();
      this.checkParams(node, false, allowExpression, false);
    } else {
      const oldStrict = this.state.strict;
      const oldLabels = this.state.labels;
      this.state.labels = [];
      this.prodParam.enter(this.prodParam.currentFlags() | _productionParameter.PARAM_RETURN);
      node.body = this.parseBlock(true, false, hasStrictModeDirective => {
        const nonSimple = !this.isSimpleParamList(node.params);

        if (hasStrictModeDirective && nonSimple) {
          const errorPos = (node.kind === "method" || node.kind === "constructor") && !!node.key ? node.key.end : node.start;
          this.raise(errorPos, _location.Errors.IllegalLanguageModeDirective);
        }

        const strictModeChanged = !oldStrict && this.state.strict;
        this.checkParams(node, !this.state.strict && !allowExpression && !isMethod && !nonSimple, allowExpression, strictModeChanged);

        if (this.state.strict && node.id) {
          this.checkLVal(node.id, _scopeflags.BIND_OUTSIDE, undefined, "function name", undefined, strictModeChanged);
        }
      });
      this.prodParam.exit();
      this.state.labels = oldLabels;
    }

    this.state.inParameters = oldInParameters;
  }

  isSimpleParamList(params) {
    for (let i = 0, len = params.length; i < len; i++) {
      if (params[i].type !== "Identifier") return false;
    }

    return true;
  }

  checkParams(node, allowDuplicates, isArrowFunction, strictModeChanged = true) {
    const nameHash = Object.create(null);

    for (let i = 0; i < node.params.length; i++) {
      this.checkLVal(node.params[i], _scopeflags.BIND_VAR, allowDuplicates ? null : nameHash, "function parameter list", undefined, strictModeChanged);
    }
  }

  parseExprList(close, allowEmpty, refExpressionErrors, nodeForExtra) {
    const elts = [];
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(_types.types.comma);

        if (this.match(close)) {
          if (nodeForExtra) {
            this.addExtra(nodeForExtra, "trailingComma", this.state.lastTokStart);
          }

          this.next();
          break;
        }
      }

      elts.push(this.parseExprListItem(allowEmpty, refExpressionErrors));
    }

    return elts;
  }

  parseExprListItem(allowEmpty, refExpressionErrors, refNeedsArrowPos, allowPlaceholder) {
    let elt;

    if (allowEmpty && this.match(_types.types.comma)) {
      elt = null;
    } else if (this.match(_types.types.ellipsis)) {
      const spreadNodeStartPos = this.state.start;
      const spreadNodeStartLoc = this.state.startLoc;
      elt = this.parseParenItem(this.parseSpread(refExpressionErrors, refNeedsArrowPos), spreadNodeStartPos, spreadNodeStartLoc);
    } else if (this.match(_types.types.question)) {
      this.expectPlugin("partialApplication");

      if (!allowPlaceholder) {
        this.raise(this.state.start, _location.Errors.UnexpectedArgumentPlaceholder);
      }

      const node = this.startNode();
      this.next();
      elt = this.finishNode(node, "ArgumentPlaceholder");
    } else {
      elt = this.parseMaybeAssign(false, refExpressionErrors, this.parseParenItem, refNeedsArrowPos);
    }

    return elt;
  }

  parseIdentifier(liberal) {
    const node = this.startNode();
    const name = this.parseIdentifierName(node.start, liberal);
    return this.createIdentifier(node, name);
  }

  createIdentifier(node, name) {
    node.name = name;
    node.loc.identifierName = name;
    return this.finishNode(node, "Identifier");
  }

  parseIdentifierName(pos, liberal) {
    let name;

    if (this.match(_types.types.name)) {
      name = this.state.value;
    } else if (this.state.type.keyword) {
      name = this.state.type.keyword;

      if ((name === "class" || name === "function") && (this.state.lastTokEnd !== this.state.lastTokStart + 1 || this.input.charCodeAt(this.state.lastTokStart) !== 46)) {
        this.state.context.pop();
      }
    } else {
      throw this.unexpected();
    }

    if (liberal) {
      this.state.type = _types.types.name;
    } else {
      this.checkReservedWord(name, this.state.start, !!this.state.type.keyword, false);
    }

    this.next();
    return name;
  }

  checkReservedWord(word, startLoc, checkKeywords, isBinding) {
    if (this.prodParam.hasYield && word === "yield") {
      this.raise(startLoc, _location.Errors.YieldBindingIdentifier);
      return;
    }

    if (word === "await") {
      if (this.prodParam.hasAwait) {
        this.raise(startLoc, _location.Errors.AwaitBindingIdentifier);
        return;
      }

      if (this.state.awaitPos === -1 && (this.state.maybeInArrowParameters || this.isAwaitAllowed())) {
        this.state.awaitPos = this.state.start;
      }
    }

    if (this.scope.inClass && !this.scope.inNonArrowFunction && word === "arguments") {
      this.raise(startLoc, _location.Errors.ArgumentsDisallowedInInitializer);
      return;
    }

    if (checkKeywords && (0, _identifier.isKeyword)(word)) {
      this.raise(startLoc, _location.Errors.UnexpectedKeyword, word);
      return;
    }

    const reservedTest = !this.state.strict ? _identifier.isReservedWord : isBinding ? _identifier.isStrictBindReservedWord : _identifier.isStrictReservedWord;

    if (reservedTest(word, this.inModule)) {
      if (!this.prodParam.hasAwait && word === "await") {
        this.raise(startLoc, _location.Errors.AwaitNotInAsyncFunction);
      } else {
        this.raise(startLoc, _location.Errors.UnexpectedReservedWord, word);
      }
    }
  }

  isAwaitAllowed() {
    if (this.scope.inFunction) return this.prodParam.hasAwait;
    if (this.options.allowAwaitOutsideFunction) return true;

    if (this.hasPlugin("topLevelAwait")) {
      return this.inModule && this.prodParam.hasAwait;
    }

    return false;
  }

  parseAwait() {
    const node = this.startNode();
    this.next();

    if (this.state.inParameters) {
      this.raise(node.start, _location.Errors.AwaitExpressionFormalParameter);
    } else if (this.state.awaitPos === -1) {
      this.state.awaitPos = node.start;
    }

    if (this.eat(_types.types.star)) {
      this.raise(node.start, _location.Errors.ObsoleteAwaitStar);
    }

    if (!this.scope.inFunction && !this.options.allowAwaitOutsideFunction) {
      if (this.hasPrecedingLineBreak() || this.match(_types.types.plusMin) || this.match(_types.types.parenL) || this.match(_types.types.bracketL) || this.match(_types.types.backQuote) || this.match(_types.types.regexp) || this.match(_types.types.slash) || this.hasPlugin("v8intrinsic") && this.match(_types.types.modulo)) {
        this.ambiguousScriptDifferentAst = true;
      } else {
        this.sawUnambiguousESM = true;
      }
    }

    if (!this.state.soloAwait) {
      node.argument = this.parseMaybeUnary();
    }

    return this.finishNode(node, "AwaitExpression");
  }

  parseYield(noIn) {
    const node = this.startNode();

    if (this.state.inParameters) {
      this.raise(node.start, _location.Errors.YieldInParameter);
    } else if (this.state.yieldPos === -1) {
      this.state.yieldPos = node.start;
    }

    this.next();

    if (this.match(_types.types.semi) || !this.match(_types.types.star) && !this.state.type.startsExpr || this.hasPrecedingLineBreak()) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = this.eat(_types.types.star);
      node.argument = this.parseMaybeAssign(noIn);
    }

    return this.finishNode(node, "YieldExpression");
  }

  checkPipelineAtInfixOperator(left, leftStartPos) {
    if (this.getPluginOption("pipelineOperator", "proposal") === "smart") {
      if (left.type === "SequenceExpression") {
        this.raise(leftStartPos, _location.Errors.PipelineHeadSequenceExpression);
      }
    }
  }

  parseSmartPipelineBody(childExpression, startPos, startLoc) {
    const pipelineStyle = this.checkSmartPipelineBodyStyle(childExpression);
    this.checkSmartPipelineBodyEarlyErrors(childExpression, pipelineStyle, startPos);
    return this.parseSmartPipelineBodyInStyle(childExpression, pipelineStyle, startPos, startLoc);
  }

  checkSmartPipelineBodyEarlyErrors(childExpression, pipelineStyle, startPos) {
    if (this.match(_types.types.arrow)) {
      throw this.raise(this.state.start, _location.Errors.PipelineBodyNoArrow);
    } else if (pipelineStyle === "PipelineTopicExpression" && childExpression.type === "SequenceExpression") {
      this.raise(startPos, _location.Errors.PipelineBodySequenceExpression);
    }
  }

  parseSmartPipelineBodyInStyle(childExpression, pipelineStyle, startPos, startLoc) {
    const bodyNode = this.startNodeAt(startPos, startLoc);

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
          this.raise(startPos, _location.Errors.PipelineTopicUnused);
        }

        bodyNode.expression = childExpression;
        break;

      default:
        throw new Error(`Internal @babel/parser error: Unknown pipeline style (${pipelineStyle})`);
    }

    return this.finishNode(bodyNode, pipelineStyle);
  }

  checkSmartPipelineBodyStyle(expression) {
    switch (expression.type) {
      default:
        return this.isSimpleReference(expression) ? "PipelineBareFunction" : "PipelineTopicExpression";
    }
  }

  isSimpleReference(expression) {
    switch (expression.type) {
      case "MemberExpression":
        return !expression.computed && this.isSimpleReference(expression.object);

      case "Identifier":
        return true;

      default:
        return false;
    }
  }

  withTopicPermittingContext(callback) {
    const outerContextTopicState = this.state.topicContext;
    this.state.topicContext = {
      maxNumOfResolvableTopics: 1,
      maxTopicIndex: null
    };

    try {
      return callback();
    } finally {
      this.state.topicContext = outerContextTopicState;
    }
  }

  withTopicForbiddingContext(callback) {
    const outerContextTopicState = this.state.topicContext;
    this.state.topicContext = {
      maxNumOfResolvableTopics: 0,
      maxTopicIndex: null
    };

    try {
      return callback();
    } finally {
      this.state.topicContext = outerContextTopicState;
    }
  }

  withSoloAwaitPermittingContext(callback) {
    const outerContextSoloAwaitState = this.state.soloAwait;
    this.state.soloAwait = true;

    try {
      return callback();
    } finally {
      this.state.soloAwait = outerContextSoloAwaitState;
    }
  }

  registerTopicReference() {
    this.state.topicContext.maxTopicIndex = 0;
  }

  primaryTopicReferenceIsAllowedInCurrentTopicContext() {
    return this.state.topicContext.maxNumOfResolvableTopics >= 1;
  }

  topicReferenceWasUsedInCurrentTopicContext() {
    return this.state.topicContext.maxTopicIndex != null && this.state.topicContext.maxTopicIndex >= 0;
  }

  parseFSharpPipelineBody(prec, noIn) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    this.state.potentialArrowAt = this.state.start;
    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.inFSharpPipelineDirectBody = true;
    const ret = this.parseExprOp(this.parseMaybeUnary(), startPos, startLoc, prec, noIn);
    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    return ret;
  }

}

exports.default = ExpressionParser;