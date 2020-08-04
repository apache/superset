"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var N = _interopRequireWildcard(require("../types"));

var _types2 = require("../tokenizer/types");

var _expression = _interopRequireDefault(require("./expression"));

var _location = require("./location");

var _identifier = require("../util/identifier");

var _whitespace = require("../util/whitespace");

var _scopeflags = require("../util/scopeflags");

var _util = require("./util");

var _productionParameter = require("../util/production-parameter");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const loopLabel = {
  kind: "loop"
},
      switchLabel = {
  kind: "switch"
};
const FUNC_NO_FLAGS = 0b000,
      FUNC_STATEMENT = 0b001,
      FUNC_HANGING_STATEMENT = 0b010,
      FUNC_NULLABLE_ID = 0b100;

class StatementParser extends _expression.default {
  parseTopLevel(file, program) {
    program.sourceType = this.options.sourceType;
    program.interpreter = this.parseInterpreterDirective();
    this.parseBlockBody(program, true, true, _types2.types.eof);

    if (this.inModule && !this.options.allowUndeclaredExports && this.scope.undefinedExports.size > 0) {
      for (let _i = 0, _Array$from = Array.from(this.scope.undefinedExports); _i < _Array$from.length; _i++) {
        const [name] = _Array$from[_i];
        const pos = this.scope.undefinedExports.get(name);
        this.raise(pos, _location.Errors.ModuleExportUndefined, name);
      }
    }

    file.program = this.finishNode(program, "Program");
    file.comments = this.state.comments;
    if (this.options.tokens) file.tokens = this.tokens;
    return this.finishNode(file, "File");
  }

  stmtToDirective(stmt) {
    const expr = stmt.expression;
    const directiveLiteral = this.startNodeAt(expr.start, expr.loc.start);
    const directive = this.startNodeAt(stmt.start, stmt.loc.start);
    const raw = this.input.slice(expr.start, expr.end);
    const val = directiveLiteral.value = raw.slice(1, -1);
    this.addExtra(directiveLiteral, "raw", raw);
    this.addExtra(directiveLiteral, "rawValue", val);
    directive.value = this.finishNodeAt(directiveLiteral, "DirectiveLiteral", expr.end, expr.loc.end);
    return this.finishNodeAt(directive, "Directive", stmt.end, stmt.loc.end);
  }

  parseInterpreterDirective() {
    if (!this.match(_types2.types.interpreterDirective)) {
      return null;
    }

    const node = this.startNode();
    node.value = this.state.value;
    this.next();
    return this.finishNode(node, "InterpreterDirective");
  }

  isLet(context) {
    if (!this.isContextual("let")) {
      return false;
    }

    const next = this.nextTokenStart();
    const nextCh = this.input.charCodeAt(next);
    if (nextCh === 91) return true;
    if (context) return false;
    if (nextCh === 123) return true;

    if ((0, _identifier.isIdentifierStart)(nextCh)) {
      let pos = next + 1;

      while ((0, _identifier.isIdentifierChar)(this.input.charCodeAt(pos))) {
        ++pos;
      }

      const ident = this.input.slice(next, pos);
      if (!_identifier.keywordRelationalOperator.test(ident)) return true;
    }

    return false;
  }

  parseStatement(context, topLevel) {
    if (this.match(_types2.types.at)) {
      this.parseDecorators(true);
    }

    return this.parseStatementContent(context, topLevel);
  }

  parseStatementContent(context, topLevel) {
    let starttype = this.state.type;
    const node = this.startNode();
    let kind;

    if (this.isLet(context)) {
      starttype = _types2.types._var;
      kind = "let";
    }

    switch (starttype) {
      case _types2.types._break:
      case _types2.types._continue:
        return this.parseBreakContinueStatement(node, starttype.keyword);

      case _types2.types._debugger:
        return this.parseDebuggerStatement(node);

      case _types2.types._do:
        return this.parseDoStatement(node);

      case _types2.types._for:
        return this.parseForStatement(node);

      case _types2.types._function:
        if (this.lookaheadCharCode() === 46) break;

        if (context) {
          if (this.state.strict) {
            this.raise(this.state.start, _location.Errors.StrictFunction);
          } else if (context !== "if" && context !== "label") {
            this.raise(this.state.start, _location.Errors.SloppyFunction);
          }
        }

        return this.parseFunctionStatement(node, false, !context);

      case _types2.types._class:
        if (context) this.unexpected();
        return this.parseClass(node, true);

      case _types2.types._if:
        return this.parseIfStatement(node);

      case _types2.types._return:
        return this.parseReturnStatement(node);

      case _types2.types._switch:
        return this.parseSwitchStatement(node);

      case _types2.types._throw:
        return this.parseThrowStatement(node);

      case _types2.types._try:
        return this.parseTryStatement(node);

      case _types2.types._const:
      case _types2.types._var:
        kind = kind || this.state.value;

        if (context && kind !== "var") {
          this.raise(this.state.start, _location.Errors.UnexpectedLexicalDeclaration);
        }

        return this.parseVarStatement(node, kind);

      case _types2.types._while:
        return this.parseWhileStatement(node);

      case _types2.types._with:
        return this.parseWithStatement(node);

      case _types2.types.braceL:
        return this.parseBlock();

      case _types2.types.semi:
        return this.parseEmptyStatement(node);

      case _types2.types._export:
      case _types2.types._import:
        {
          const nextTokenCharCode = this.lookaheadCharCode();

          if (nextTokenCharCode === 40 || nextTokenCharCode === 46) {
            break;
          }

          if (!this.options.allowImportExportEverywhere && !topLevel) {
            this.raise(this.state.start, _location.Errors.UnexpectedImportExport);
          }

          this.next();
          let result;

          if (starttype === _types2.types._import) {
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

      default:
        {
          if (this.isAsyncFunction()) {
            if (context) {
              this.raise(this.state.start, _location.Errors.AsyncFunctionInSingleStatementContext);
            }

            this.next();
            return this.parseFunctionStatement(node, true, !context);
          }
        }
    }

    const maybeName = this.state.value;
    const expr = this.parseExpression();

    if (starttype === _types2.types.name && expr.type === "Identifier" && this.eat(_types2.types.colon)) {
      return this.parseLabeledStatement(node, maybeName, expr, context);
    } else {
      return this.parseExpressionStatement(node, expr);
    }
  }

  assertModuleNodeAllowed(node) {
    if (!this.options.allowImportExportEverywhere && !this.inModule) {
      this.raiseWithData(node.start, {
        code: "BABEL_PARSER_SOURCETYPE_MODULE_REQUIRED"
      }, _location.Errors.ImportOutsideModule);
    }
  }

  takeDecorators(node) {
    const decorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    if (decorators.length) {
      node.decorators = decorators;
      this.resetStartLocationFromNode(node, decorators[0]);
      this.state.decoratorStack[this.state.decoratorStack.length - 1] = [];
    }
  }

  canHaveLeadingDecorator() {
    return this.match(_types2.types._class);
  }

  parseDecorators(allowExport) {
    const currentContextDecorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    while (this.match(_types2.types.at)) {
      const decorator = this.parseDecorator();
      currentContextDecorators.push(decorator);
    }

    if (this.match(_types2.types._export)) {
      if (!allowExport) {
        this.unexpected();
      }

      if (this.hasPlugin("decorators") && !this.getPluginOption("decorators", "decoratorsBeforeExport")) {
        this.raise(this.state.start, _location.Errors.DecoratorExportClass);
      }
    } else if (!this.canHaveLeadingDecorator()) {
      throw this.raise(this.state.start, _location.Errors.UnexpectedLeadingDecorator);
    }
  }

  parseDecorator() {
    this.expectOnePlugin(["decorators-legacy", "decorators"]);
    const node = this.startNode();
    this.next();

    if (this.hasPlugin("decorators")) {
      this.state.decoratorStack.push([]);
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      let expr;

      if (this.eat(_types2.types.parenL)) {
        expr = this.parseExpression();
        this.expect(_types2.types.parenR);
      } else {
        expr = this.parseIdentifier(false);

        while (this.eat(_types2.types.dot)) {
          const node = this.startNodeAt(startPos, startLoc);
          node.object = expr;
          node.property = this.parseIdentifier(true);
          node.computed = false;
          expr = this.finishNode(node, "MemberExpression");
        }
      }

      node.expression = this.parseMaybeDecoratorArguments(expr);
      this.state.decoratorStack.pop();
    } else {
      node.expression = this.parseExprSubscripts();
    }

    return this.finishNode(node, "Decorator");
  }

  parseMaybeDecoratorArguments(expr) {
    if (this.eat(_types2.types.parenL)) {
      const node = this.startNodeAtNode(expr);
      node.callee = expr;
      node.arguments = this.parseCallExpressionArguments(_types2.types.parenR, false);
      this.toReferencedList(node.arguments);
      return this.finishNode(node, "CallExpression");
    }

    return expr;
  }

  parseBreakContinueStatement(node, keyword) {
    const isBreak = keyword === "break";
    this.next();

    if (this.isLineTerminator()) {
      node.label = null;
    } else {
      node.label = this.parseIdentifier();
      this.semicolon();
    }

    this.verifyBreakContinue(node, keyword);
    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
  }

  verifyBreakContinue(node, keyword) {
    const isBreak = keyword === "break";
    let i;

    for (i = 0; i < this.state.labels.length; ++i) {
      const lab = this.state.labels[i];

      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
        if (node.label && isBreak) break;
      }
    }

    if (i === this.state.labels.length) {
      this.raise(node.start, _location.Errors.IllegalBreakContinue, keyword);
    }
  }

  parseDebuggerStatement(node) {
    this.next();
    this.semicolon();
    return this.finishNode(node, "DebuggerStatement");
  }

  parseHeaderExpression() {
    this.expect(_types2.types.parenL);
    const val = this.parseExpression();
    this.expect(_types2.types.parenR);
    return val;
  }

  parseDoStatement(node) {
    this.next();
    this.state.labels.push(loopLabel);
    node.body = this.withTopicForbiddingContext(() => this.parseStatement("do"));
    this.state.labels.pop();
    this.expect(_types2.types._while);
    node.test = this.parseHeaderExpression();
    this.eat(_types2.types.semi);
    return this.finishNode(node, "DoWhileStatement");
  }

  parseForStatement(node) {
    this.next();
    this.state.labels.push(loopLabel);
    let awaitAt = -1;

    if (this.isAwaitAllowed() && this.eatContextual("await")) {
      awaitAt = this.state.lastTokStart;
    }

    this.scope.enter(_scopeflags.SCOPE_OTHER);
    this.expect(_types2.types.parenL);

    if (this.match(_types2.types.semi)) {
      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }

      return this.parseFor(node, null);
    }

    const isLet = this.isLet();

    if (this.match(_types2.types._var) || this.match(_types2.types._const) || isLet) {
      const init = this.startNode();
      const kind = isLet ? "let" : this.state.value;
      this.next();
      this.parseVar(init, true, kind);
      this.finishNode(init, "VariableDeclaration");

      if ((this.match(_types2.types._in) || this.isContextual("of")) && init.declarations.length === 1) {
        return this.parseForIn(node, init, awaitAt);
      }

      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }

      return this.parseFor(node, init);
    }

    const refExpressionErrors = new _util.ExpressionErrors();
    const init = this.parseExpression(true, refExpressionErrors);

    if (this.match(_types2.types._in) || this.isContextual("of")) {
      this.toAssignable(init);
      const description = this.isContextual("of") ? "for-of statement" : "for-in statement";
      this.checkLVal(init, undefined, undefined, description);
      return this.parseForIn(node, init, awaitAt);
    } else {
      this.checkExpressionErrors(refExpressionErrors, true);
    }

    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }

    return this.parseFor(node, init);
  }

  parseFunctionStatement(node, isAsync, declarationPosition) {
    this.next();
    return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), isAsync);
  }

  parseIfStatement(node) {
    this.next();
    node.test = this.parseHeaderExpression();
    node.consequent = this.parseStatement("if");
    node.alternate = this.eat(_types2.types._else) ? this.parseStatement("if") : null;
    return this.finishNode(node, "IfStatement");
  }

  parseReturnStatement(node) {
    if (!this.prodParam.hasReturn && !this.options.allowReturnOutsideFunction) {
      this.raise(this.state.start, _location.Errors.IllegalReturn);
    }

    this.next();

    if (this.isLineTerminator()) {
      node.argument = null;
    } else {
      node.argument = this.parseExpression();
      this.semicolon();
    }

    return this.finishNode(node, "ReturnStatement");
  }

  parseSwitchStatement(node) {
    this.next();
    node.discriminant = this.parseHeaderExpression();
    const cases = node.cases = [];
    this.expect(_types2.types.braceL);
    this.state.labels.push(switchLabel);
    this.scope.enter(_scopeflags.SCOPE_OTHER);
    let cur;

    for (let sawDefault; !this.match(_types2.types.braceR);) {
      if (this.match(_types2.types._case) || this.match(_types2.types._default)) {
        const isCase = this.match(_types2.types._case);
        if (cur) this.finishNode(cur, "SwitchCase");
        cases.push(cur = this.startNode());
        cur.consequent = [];
        this.next();

        if (isCase) {
          cur.test = this.parseExpression();
        } else {
          if (sawDefault) {
            this.raise(this.state.lastTokStart, _location.Errors.MultipleDefaultsInSwitch);
          }

          sawDefault = true;
          cur.test = null;
        }

        this.expect(_types2.types.colon);
      } else {
        if (cur) {
          cur.consequent.push(this.parseStatement(null));
        } else {
          this.unexpected();
        }
      }
    }

    this.scope.exit();
    if (cur) this.finishNode(cur, "SwitchCase");
    this.next();
    this.state.labels.pop();
    return this.finishNode(node, "SwitchStatement");
  }

  parseThrowStatement(node) {
    this.next();

    if (_whitespace.lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start))) {
      this.raise(this.state.lastTokEnd, _location.Errors.NewlineAfterThrow);
    }

    node.argument = this.parseExpression();
    this.semicolon();
    return this.finishNode(node, "ThrowStatement");
  }

  parseTryStatement(node) {
    this.next();
    node.block = this.parseBlock();
    node.handler = null;

    if (this.match(_types2.types._catch)) {
      const clause = this.startNode();
      this.next();

      if (this.match(_types2.types.parenL)) {
        this.expect(_types2.types.parenL);
        clause.param = this.parseBindingAtom();
        const simple = clause.param.type === "Identifier";
        this.scope.enter(simple ? _scopeflags.SCOPE_SIMPLE_CATCH : 0);
        this.checkLVal(clause.param, _scopeflags.BIND_LEXICAL, null, "catch clause");
        this.expect(_types2.types.parenR);
      } else {
        clause.param = null;
        this.scope.enter(_scopeflags.SCOPE_OTHER);
      }

      clause.body = this.withTopicForbiddingContext(() => this.parseBlock(false, false));
      this.scope.exit();
      node.handler = this.finishNode(clause, "CatchClause");
    }

    node.finalizer = this.eat(_types2.types._finally) ? this.parseBlock() : null;

    if (!node.handler && !node.finalizer) {
      this.raise(node.start, _location.Errors.NoCatchOrFinally);
    }

    return this.finishNode(node, "TryStatement");
  }

  parseVarStatement(node, kind) {
    this.next();
    this.parseVar(node, false, kind);
    this.semicolon();
    return this.finishNode(node, "VariableDeclaration");
  }

  parseWhileStatement(node) {
    this.next();
    node.test = this.parseHeaderExpression();
    this.state.labels.push(loopLabel);
    node.body = this.withTopicForbiddingContext(() => this.parseStatement("while"));
    this.state.labels.pop();
    return this.finishNode(node, "WhileStatement");
  }

  parseWithStatement(node) {
    if (this.state.strict) {
      this.raise(this.state.start, _location.Errors.StrictWith);
    }

    this.next();
    node.object = this.parseHeaderExpression();
    node.body = this.withTopicForbiddingContext(() => this.parseStatement("with"));
    return this.finishNode(node, "WithStatement");
  }

  parseEmptyStatement(node) {
    this.next();
    return this.finishNode(node, "EmptyStatement");
  }

  parseLabeledStatement(node, maybeName, expr, context) {
    for (let _i2 = 0, _this$state$labels = this.state.labels; _i2 < _this$state$labels.length; _i2++) {
      const label = _this$state$labels[_i2];

      if (label.name === maybeName) {
        this.raise(expr.start, _location.Errors.LabelRedeclaration, maybeName);
      }
    }

    const kind = this.state.type.isLoop ? "loop" : this.match(_types2.types._switch) ? "switch" : null;

    for (let i = this.state.labels.length - 1; i >= 0; i--) {
      const label = this.state.labels[i];

      if (label.statementStart === node.start) {
        label.statementStart = this.state.start;
        label.kind = kind;
      } else {
        break;
      }
    }

    this.state.labels.push({
      name: maybeName,
      kind: kind,
      statementStart: this.state.start
    });
    node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
    this.state.labels.pop();
    node.label = expr;
    return this.finishNode(node, "LabeledStatement");
  }

  parseExpressionStatement(node, expr) {
    node.expression = expr;
    this.semicolon();
    return this.finishNode(node, "ExpressionStatement");
  }

  parseBlock(allowDirectives = false, createNewLexicalScope = true, afterBlockParse) {
    const node = this.startNode();
    this.expect(_types2.types.braceL);

    if (createNewLexicalScope) {
      this.scope.enter(_scopeflags.SCOPE_OTHER);
    }

    this.parseBlockBody(node, allowDirectives, false, _types2.types.braceR, afterBlockParse);

    if (createNewLexicalScope) {
      this.scope.exit();
    }

    return this.finishNode(node, "BlockStatement");
  }

  isValidDirective(stmt) {
    return stmt.type === "ExpressionStatement" && stmt.expression.type === "StringLiteral" && !stmt.expression.extra.parenthesized;
  }

  parseBlockBody(node, allowDirectives, topLevel, end, afterBlockParse) {
    const body = node.body = [];
    const directives = node.directives = [];
    this.parseBlockOrModuleBlockBody(body, allowDirectives ? directives : undefined, topLevel, end, afterBlockParse);
  }

  parseBlockOrModuleBlockBody(body, directives, topLevel, end, afterBlockParse) {
    const octalPositions = [];
    let parsedNonDirective = false;
    let oldStrict = null;

    while (!this.eat(end)) {
      if (!parsedNonDirective && this.state.octalPositions.length) {
        octalPositions.push(...this.state.octalPositions);
      }

      const stmt = this.parseStatement(null, topLevel);

      if (directives && !parsedNonDirective && this.isValidDirective(stmt)) {
        const directive = this.stmtToDirective(stmt);
        directives.push(directive);

        if (oldStrict === null && directive.value.value === "use strict") {
          oldStrict = this.state.strict;
          this.setStrict(true);
        }

        continue;
      }

      parsedNonDirective = true;
      body.push(stmt);
    }

    if (this.state.strict && octalPositions.length) {
      for (let _i3 = 0; _i3 < octalPositions.length; _i3++) {
        const pos = octalPositions[_i3];
        this.raise(pos, _location.Errors.StrictOctalLiteral);
      }
    }

    if (afterBlockParse) {
      afterBlockParse.call(this, oldStrict !== null);
    }

    if (oldStrict === false) {
      this.setStrict(false);
    }
  }

  parseFor(node, init) {
    node.init = init;
    this.expect(_types2.types.semi);
    node.test = this.match(_types2.types.semi) ? null : this.parseExpression();
    this.expect(_types2.types.semi);
    node.update = this.match(_types2.types.parenR) ? null : this.parseExpression();
    this.expect(_types2.types.parenR);
    node.body = this.withTopicForbiddingContext(() => this.parseStatement("for"));
    this.scope.exit();
    this.state.labels.pop();
    return this.finishNode(node, "ForStatement");
  }

  parseForIn(node, init, awaitAt) {
    const isForIn = this.match(_types2.types._in);
    this.next();

    if (isForIn) {
      if (awaitAt > -1) this.unexpected(awaitAt);
    } else {
      node.await = awaitAt > -1;
    }

    if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.state.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
      this.raise(init.start, _location.Errors.ForInOfLoopInitializer, isForIn ? "for-in" : "for-of");
    } else if (init.type === "AssignmentPattern") {
      this.raise(init.start, _location.Errors.InvalidLhs, "for-loop");
    }

    node.left = init;
    node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
    this.expect(_types2.types.parenR);
    node.body = this.withTopicForbiddingContext(() => this.parseStatement("for"));
    this.scope.exit();
    this.state.labels.pop();
    return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
  }

  parseVar(node, isFor, kind) {
    const declarations = node.declarations = [];
    const isTypescript = this.hasPlugin("typescript");
    node.kind = kind;

    for (;;) {
      const decl = this.startNode();
      this.parseVarId(decl, kind);

      if (this.eat(_types2.types.eq)) {
        decl.init = this.parseMaybeAssign(isFor);
      } else {
        if (kind === "const" && !(this.match(_types2.types._in) || this.isContextual("of"))) {
          if (!isTypescript) {
            this.unexpected();
          }
        } else if (decl.id.type !== "Identifier" && !(isFor && (this.match(_types2.types._in) || this.isContextual("of")))) {
          this.raise(this.state.lastTokEnd, _location.Errors.DeclarationMissingInitializer, "Complex binding patterns");
        }

        decl.init = null;
      }

      declarations.push(this.finishNode(decl, "VariableDeclarator"));
      if (!this.eat(_types2.types.comma)) break;
    }

    return node;
  }

  parseVarId(decl, kind) {
    decl.id = this.parseBindingAtom();
    this.checkLVal(decl.id, kind === "var" ? _scopeflags.BIND_VAR : _scopeflags.BIND_LEXICAL, undefined, "variable declaration", kind !== "var");
  }

  parseFunction(node, statement = FUNC_NO_FLAGS, isAsync = false) {
    const isStatement = statement & FUNC_STATEMENT;
    const isHangingStatement = statement & FUNC_HANGING_STATEMENT;
    const requireId = !!isStatement && !(statement & FUNC_NULLABLE_ID);
    this.initFunction(node, isAsync);

    if (this.match(_types2.types.star) && isHangingStatement) {
      this.raise(this.state.start, _location.Errors.GeneratorInSingleStatementContext);
    }

    node.generator = this.eat(_types2.types.star);

    if (isStatement) {
      node.id = this.parseFunctionId(requireId);
    }

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldYieldPos = this.state.yieldPos;
    const oldAwaitPos = this.state.awaitPos;
    this.state.maybeInArrowParameters = false;
    this.state.yieldPos = -1;
    this.state.awaitPos = -1;
    this.scope.enter(_scopeflags.SCOPE_FUNCTION);
    this.prodParam.enter((0, _productionParameter.functionFlags)(isAsync, node.generator));

    if (!isStatement) {
      node.id = this.parseFunctionId();
    }

    this.parseFunctionParams(node);
    this.withTopicForbiddingContext(() => {
      this.parseFunctionBodyAndFinish(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
    });
    this.prodParam.exit();
    this.scope.exit();

    if (isStatement && !isHangingStatement) {
      this.registerFunctionStatementId(node);
    }

    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    this.state.yieldPos = oldYieldPos;
    this.state.awaitPos = oldAwaitPos;
    return node;
  }

  parseFunctionId(requireId) {
    return requireId || this.match(_types2.types.name) ? this.parseIdentifier() : null;
  }

  parseFunctionParams(node, allowModifiers) {
    const oldInParameters = this.state.inParameters;
    this.state.inParameters = true;
    this.expect(_types2.types.parenL);
    node.params = this.parseBindingList(_types2.types.parenR, 41, false, allowModifiers);
    this.state.inParameters = oldInParameters;
    this.checkYieldAwaitInDefaultParams();
  }

  registerFunctionStatementId(node) {
    if (!node.id) return;
    this.scope.declareName(node.id.name, this.state.strict || node.generator || node.async ? this.scope.treatFunctionsAsVar ? _scopeflags.BIND_VAR : _scopeflags.BIND_LEXICAL : _scopeflags.BIND_FUNCTION, node.id.start);
  }

  parseClass(node, isStatement, optionalId) {
    this.next();
    this.takeDecorators(node);
    const oldStrict = this.state.strict;
    this.state.strict = true;
    this.parseClassId(node, isStatement, optionalId);
    this.parseClassSuper(node);
    node.body = this.parseClassBody(!!node.superClass);
    this.state.strict = oldStrict;
    return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
  }

  isClassProperty() {
    return this.match(_types2.types.eq) || this.match(_types2.types.semi) || this.match(_types2.types.braceR);
  }

  isClassMethod() {
    return this.match(_types2.types.parenL);
  }

  isNonstaticConstructor(method) {
    return !method.computed && !method.static && (method.key.name === "constructor" || method.key.value === "constructor");
  }

  parseClassBody(constructorAllowsSuper) {
    this.classScope.enter();
    const state = {
      hadConstructor: false
    };
    let decorators = [];
    const classBody = this.startNode();
    classBody.body = [];
    this.expect(_types2.types.braceL);
    this.withTopicForbiddingContext(() => {
      while (!this.eat(_types2.types.braceR)) {
        if (this.eat(_types2.types.semi)) {
          if (decorators.length > 0) {
            throw this.raise(this.state.lastTokEnd, _location.Errors.DecoratorSemicolon);
          }

          continue;
        }

        if (this.match(_types2.types.at)) {
          decorators.push(this.parseDecorator());
          continue;
        }

        const member = this.startNode();

        if (decorators.length) {
          member.decorators = decorators;
          this.resetStartLocationFromNode(member, decorators[0]);
          decorators = [];
        }

        this.parseClassMember(classBody, member, state, constructorAllowsSuper);

        if (member.kind === "constructor" && member.decorators && member.decorators.length > 0) {
          this.raise(member.start, _location.Errors.DecoratorConstructor);
        }
      }
    });

    if (decorators.length) {
      throw this.raise(this.state.start, _location.Errors.TrailingDecorator);
    }

    this.classScope.exit();
    return this.finishNode(classBody, "ClassBody");
  }

  parseClassMember(classBody, member, state, constructorAllowsSuper) {
    let isStatic = false;
    const containsEsc = this.state.containsEsc;

    if (this.match(_types2.types.name) && this.state.value === "static") {
      const key = this.parseIdentifier(true);

      if (this.isClassMethod()) {
        const method = member;
        method.kind = "method";
        method.computed = false;
        method.key = key;
        method.static = false;
        this.pushClassMethod(classBody, method, false, false, false, false);
        return;
      } else if (this.isClassProperty()) {
        const prop = member;
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

    this.parseClassMemberWithIsStatic(classBody, member, state, isStatic, constructorAllowsSuper);
  }

  parseClassMemberWithIsStatic(classBody, member, state, isStatic, constructorAllowsSuper) {
    const publicMethod = member;
    const privateMethod = member;
    const publicProp = member;
    const privateProp = member;
    const method = publicMethod;
    const publicMember = publicMethod;
    member.static = isStatic;

    if (this.eat(_types2.types.star)) {
      method.kind = "method";
      this.parseClassPropertyName(method);

      if (method.key.type === "PrivateName") {
        this.pushClassPrivateMethod(classBody, privateMethod, true, false);
        return;
      }

      if (this.isNonstaticConstructor(publicMethod)) {
        this.raise(publicMethod.key.start, _location.Errors.ConstructorIsGenerator);
      }

      this.pushClassMethod(classBody, publicMethod, true, false, false, false);
      return;
    }

    const containsEsc = this.state.containsEsc;
    const key = this.parseClassPropertyName(member);
    const isPrivate = key.type === "PrivateName";
    const isSimple = key.type === "Identifier";
    const maybeQuestionTokenStart = this.state.start;
    this.parsePostMemberNameModifiers(publicMember);

    if (this.isClassMethod()) {
      method.kind = "method";

      if (isPrivate) {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
        return;
      }

      const isConstructor = this.isNonstaticConstructor(publicMethod);
      let allowsDirectSuper = false;

      if (isConstructor) {
        publicMethod.kind = "constructor";

        if (state.hadConstructor && !this.hasPlugin("typescript")) {
          this.raise(key.start, _location.Errors.DuplicateConstructor);
        }

        state.hadConstructor = true;
        allowsDirectSuper = constructorAllowsSuper;
      }

      this.pushClassMethod(classBody, publicMethod, false, false, isConstructor, allowsDirectSuper);
    } else if (this.isClassProperty()) {
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else if (isSimple && key.name === "async" && !containsEsc && !this.isLineTerminator()) {
      const isGenerator = this.eat(_types2.types.star);

      if (publicMember.optional) {
        this.unexpected(maybeQuestionTokenStart);
      }

      method.kind = "method";
      this.parseClassPropertyName(method);
      this.parsePostMemberNameModifiers(publicMember);

      if (method.key.type === "PrivateName") {
        this.pushClassPrivateMethod(classBody, privateMethod, isGenerator, true);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, _location.Errors.ConstructorIsAsync);
        }

        this.pushClassMethod(classBody, publicMethod, isGenerator, true, false, false);
      }
    } else if (isSimple && (key.name === "get" || key.name === "set") && !containsEsc && !(this.match(_types2.types.star) && this.isLineTerminator())) {
      method.kind = key.name;
      this.parseClassPropertyName(publicMethod);

      if (method.key.type === "PrivateName") {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, _location.Errors.ConstructorIsAccessor);
        }

        this.pushClassMethod(classBody, publicMethod, false, false, false, false);
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
  }

  parseClassPropertyName(member) {
    const key = this.parsePropertyName(member, true);

    if (!member.computed && member.static && (key.name === "prototype" || key.value === "prototype")) {
      this.raise(key.start, _location.Errors.StaticPrototype);
    }

    if (key.type === "PrivateName" && key.id.name === "constructor") {
      this.raise(key.start, _location.Errors.ConstructorClassPrivateField);
    }

    return key;
  }

  pushClassProperty(classBody, prop) {
    if (!prop.computed && (prop.key.name === "constructor" || prop.key.value === "constructor")) {
      this.raise(prop.key.start, _location.Errors.ConstructorClassField);
    }

    classBody.body.push(this.parseClassProperty(prop));
  }

  pushClassPrivateProperty(classBody, prop) {
    this.expectPlugin("classPrivateProperties", prop.key.start);
    const node = this.parseClassPrivateProperty(prop);
    classBody.body.push(node);
    this.classScope.declarePrivateName(node.key.id.name, _scopeflags.CLASS_ELEMENT_OTHER, node.key.start);
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper) {
    classBody.body.push(this.parseMethod(method, isGenerator, isAsync, isConstructor, allowsDirectSuper, "ClassMethod", true));
  }

  pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
    this.expectPlugin("classPrivateMethods", method.key.start);
    const node = this.parseMethod(method, isGenerator, isAsync, false, false, "ClassPrivateMethod", true);
    classBody.body.push(node);
    const kind = node.kind === "get" ? node.static ? _scopeflags.CLASS_ELEMENT_STATIC_GETTER : _scopeflags.CLASS_ELEMENT_INSTANCE_GETTER : node.kind === "set" ? node.static ? _scopeflags.CLASS_ELEMENT_STATIC_SETTER : _scopeflags.CLASS_ELEMENT_INSTANCE_SETTER : _scopeflags.CLASS_ELEMENT_OTHER;
    this.classScope.declarePrivateName(node.key.id.name, kind, node.key.start);
  }

  parsePostMemberNameModifiers(methodOrProp) {}

  parseAccessModifier() {
    return undefined;
  }

  parseClassPrivateProperty(node) {
    this.scope.enter(_scopeflags.SCOPE_CLASS | _scopeflags.SCOPE_SUPER);
    this.prodParam.enter(_productionParameter.PARAM);
    node.value = this.eat(_types2.types.eq) ? this.parseMaybeAssign() : null;
    this.semicolon();
    this.prodParam.exit();
    this.scope.exit();
    return this.finishNode(node, "ClassPrivateProperty");
  }

  parseClassProperty(node) {
    if (!node.typeAnnotation) {
      this.expectPlugin("classProperties");
    }

    this.scope.enter(_scopeflags.SCOPE_CLASS | _scopeflags.SCOPE_SUPER);
    this.prodParam.enter(_productionParameter.PARAM);

    if (this.match(_types2.types.eq)) {
      this.expectPlugin("classProperties");
      this.next();
      node.value = this.parseMaybeAssign();
    } else {
      node.value = null;
    }

    this.semicolon();
    this.prodParam.exit();
    this.scope.exit();
    return this.finishNode(node, "ClassProperty");
  }

  parseClassId(node, isStatement, optionalId, bindingType = _scopeflags.BIND_CLASS) {
    if (this.match(_types2.types.name)) {
      node.id = this.parseIdentifier();

      if (isStatement) {
        this.checkLVal(node.id, bindingType, undefined, "class name");
      }
    } else {
      if (optionalId || !isStatement) {
        node.id = null;
      } else {
        this.unexpected(null, _location.Errors.MissingClassName);
      }
    }
  }

  parseClassSuper(node) {
    node.superClass = this.eat(_types2.types._extends) ? this.parseExprSubscripts() : null;
  }

  parseExport(node) {
    const hasDefault = this.maybeParseExportDefaultSpecifier(node);
    const parseAfterDefault = !hasDefault || this.eat(_types2.types.comma);
    const hasStar = parseAfterDefault && this.eatExportStar(node);
    const hasNamespace = hasStar && this.maybeParseExportNamespaceSpecifier(node);
    const parseAfterNamespace = parseAfterDefault && (!hasNamespace || this.eat(_types2.types.comma));
    const isFromRequired = hasDefault || hasStar;

    if (hasStar && !hasNamespace) {
      if (hasDefault) this.unexpected();
      this.parseExportFrom(node, true);
      return this.finishNode(node, "ExportAllDeclaration");
    }

    const hasSpecifiers = this.maybeParseExportNamedSpecifiers(node);

    if (hasDefault && parseAfterDefault && !hasStar && !hasSpecifiers || hasNamespace && parseAfterNamespace && !hasSpecifiers) {
      throw this.unexpected(null, _types2.types.braceL);
    }

    let hasDeclaration;

    if (isFromRequired || hasSpecifiers) {
      hasDeclaration = false;
      this.parseExportFrom(node, isFromRequired);
    } else {
      hasDeclaration = this.maybeParseExportDeclaration(node);
    }

    if (isFromRequired || hasSpecifiers || hasDeclaration) {
      this.checkExport(node, true, false, !!node.source);
      return this.finishNode(node, "ExportNamedDeclaration");
    }

    if (this.eat(_types2.types._default)) {
      node.declaration = this.parseExportDefaultExpression();
      this.checkExport(node, true, true);
      return this.finishNode(node, "ExportDefaultDeclaration");
    }

    throw this.unexpected(null, _types2.types.braceL);
  }

  eatExportStar(node) {
    return this.eat(_types2.types.star);
  }

  maybeParseExportDefaultSpecifier(node) {
    if (this.isExportDefaultSpecifier()) {
      this.expectPlugin("exportDefaultFrom");
      const specifier = this.startNode();
      specifier.exported = this.parseIdentifier(true);
      node.specifiers = [this.finishNode(specifier, "ExportDefaultSpecifier")];
      return true;
    }

    return false;
  }

  maybeParseExportNamespaceSpecifier(node) {
    if (this.isContextual("as")) {
      if (!node.specifiers) node.specifiers = [];
      const specifier = this.startNodeAt(this.state.lastTokStart, this.state.lastTokStartLoc);
      this.next();
      specifier.exported = this.parseIdentifier(true);
      node.specifiers.push(this.finishNode(specifier, "ExportNamespaceSpecifier"));
      return true;
    }

    return false;
  }

  maybeParseExportNamedSpecifiers(node) {
    if (this.match(_types2.types.braceL)) {
      if (!node.specifiers) node.specifiers = [];
      node.specifiers.push(...this.parseExportSpecifiers());
      node.source = null;
      node.declaration = null;
      return true;
    }

    return false;
  }

  maybeParseExportDeclaration(node) {
    if (this.shouldParseExportDeclaration()) {
      if (this.isContextual("async")) {
        const next = this.nextTokenStart();

        if (!this.isUnparsedContextual(next, "function")) {
          this.unexpected(next, _types2.types._function);
        }
      }

      node.specifiers = [];
      node.source = null;
      node.declaration = this.parseExportDeclaration(node);
      return true;
    }

    return false;
  }

  isAsyncFunction() {
    if (!this.isContextual("async")) return false;
    const next = this.nextTokenStart();
    return !_whitespace.lineBreak.test(this.input.slice(this.state.pos, next)) && this.isUnparsedContextual(next, "function");
  }

  parseExportDefaultExpression() {
    const expr = this.startNode();
    const isAsync = this.isAsyncFunction();

    if (this.match(_types2.types._function) || isAsync) {
      this.next();

      if (isAsync) {
        this.next();
      }

      return this.parseFunction(expr, FUNC_STATEMENT | FUNC_NULLABLE_ID, isAsync);
    } else if (this.match(_types2.types._class)) {
      return this.parseClass(expr, true, true);
    } else if (this.match(_types2.types.at)) {
      if (this.hasPlugin("decorators") && this.getPluginOption("decorators", "decoratorsBeforeExport")) {
        this.raise(this.state.start, _location.Errors.DecoratorBeforeExport);
      }

      this.parseDecorators(false);
      return this.parseClass(expr, true, true);
    } else if (this.match(_types2.types._const) || this.match(_types2.types._var) || this.isLet()) {
      throw this.raise(this.state.start, _location.Errors.UnsupportedDefaultExport);
    } else {
      const res = this.parseMaybeAssign();
      this.semicolon();
      return res;
    }
  }

  parseExportDeclaration(node) {
    return this.parseStatement(null);
  }

  isExportDefaultSpecifier() {
    if (this.match(_types2.types.name)) {
      return this.state.value !== "async" && this.state.value !== "let";
    }

    if (!this.match(_types2.types._default)) {
      return false;
    }

    const next = this.nextTokenStart();
    return this.input.charCodeAt(next) === 44 || this.isUnparsedContextual(next, "from");
  }

  parseExportFrom(node, expect) {
    if (this.eatContextual("from")) {
      node.source = this.parseImportSource();
      this.checkExport(node);
    } else {
      if (expect) {
        this.unexpected();
      } else {
        node.source = null;
      }
    }

    this.semicolon();
  }

  shouldParseExportDeclaration() {
    if (this.match(_types2.types.at)) {
      this.expectOnePlugin(["decorators", "decorators-legacy"]);

      if (this.hasPlugin("decorators")) {
        if (this.getPluginOption("decorators", "decoratorsBeforeExport")) {
          this.unexpected(this.state.start, _location.Errors.DecoratorBeforeExport);
        } else {
          return true;
        }
      }
    }

    return this.state.type.keyword === "var" || this.state.type.keyword === "const" || this.state.type.keyword === "function" || this.state.type.keyword === "class" || this.isLet() || this.isAsyncFunction();
  }

  checkExport(node, checkNames, isDefault, isFrom) {
    if (checkNames) {
      if (isDefault) {
        this.checkDuplicateExports(node, "default");
      } else if (node.specifiers && node.specifiers.length) {
        for (let _i4 = 0, _node$specifiers = node.specifiers; _i4 < _node$specifiers.length; _i4++) {
          const specifier = _node$specifiers[_i4];
          this.checkDuplicateExports(specifier, specifier.exported.name);

          if (!isFrom && specifier.local) {
            this.checkReservedWord(specifier.local.name, specifier.local.start, true, false);
            this.scope.checkLocalExport(specifier.local);
          }
        }
      } else if (node.declaration) {
        if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
          const id = node.declaration.id;
          if (!id) throw new Error("Assertion failure");
          this.checkDuplicateExports(node, id.name);
        } else if (node.declaration.type === "VariableDeclaration") {
          for (let _i5 = 0, _node$declaration$dec = node.declaration.declarations; _i5 < _node$declaration$dec.length; _i5++) {
            const declaration = _node$declaration$dec[_i5];
            this.checkDeclaration(declaration.id);
          }
        }
      }
    }

    const currentContextDecorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    if (currentContextDecorators.length) {
      const isClass = node.declaration && (node.declaration.type === "ClassDeclaration" || node.declaration.type === "ClassExpression");

      if (!node.declaration || !isClass) {
        throw this.raise(node.start, _location.Errors.UnsupportedDecoratorExport);
      }

      this.takeDecorators(node.declaration);
    }
  }

  checkDeclaration(node) {
    if (node.type === "Identifier") {
      this.checkDuplicateExports(node, node.name);
    } else if (node.type === "ObjectPattern") {
      for (let _i6 = 0, _node$properties = node.properties; _i6 < _node$properties.length; _i6++) {
        const prop = _node$properties[_i6];
        this.checkDeclaration(prop);
      }
    } else if (node.type === "ArrayPattern") {
      for (let _i7 = 0, _node$elements = node.elements; _i7 < _node$elements.length; _i7++) {
        const elem = _node$elements[_i7];

        if (elem) {
          this.checkDeclaration(elem);
        }
      }
    } else if (node.type === "ObjectProperty") {
      this.checkDeclaration(node.value);
    } else if (node.type === "RestElement") {
      this.checkDeclaration(node.argument);
    } else if (node.type === "AssignmentPattern") {
      this.checkDeclaration(node.left);
    }
  }

  checkDuplicateExports(node, name) {
    if (this.state.exportedIdentifiers.indexOf(name) > -1) {
      this.raise(node.start, name === "default" ? _location.Errors.DuplicateDefaultExport : _location.Errors.DuplicateExport, name);
    }

    this.state.exportedIdentifiers.push(name);
  }

  parseExportSpecifiers() {
    const nodes = [];
    let first = true;
    this.expect(_types2.types.braceL);

    while (!this.eat(_types2.types.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(_types2.types.comma);
        if (this.eat(_types2.types.braceR)) break;
      }

      const node = this.startNode();
      node.local = this.parseIdentifier(true);
      node.exported = this.eatContextual("as") ? this.parseIdentifier(true) : node.local.__clone();
      nodes.push(this.finishNode(node, "ExportSpecifier"));
    }

    return nodes;
  }

  parseImport(node) {
    node.specifiers = [];

    if (!this.match(_types2.types.string)) {
      const hasDefault = this.maybeParseDefaultImportSpecifier(node);
      const parseNext = !hasDefault || this.eat(_types2.types.comma);
      const hasStar = parseNext && this.maybeParseStarImportSpecifier(node);
      if (parseNext && !hasStar) this.parseNamedImportSpecifiers(node);
      this.expectContextual("from");
    }

    node.source = this.parseImportSource();
    this.semicolon();
    return this.finishNode(node, "ImportDeclaration");
  }

  parseImportSource() {
    if (!this.match(_types2.types.string)) this.unexpected();
    return this.parseExprAtom();
  }

  shouldParseDefaultImport(node) {
    return this.match(_types2.types.name);
  }

  parseImportSpecifierLocal(node, specifier, type, contextDescription) {
    specifier.local = this.parseIdentifier();
    this.checkLVal(specifier.local, _scopeflags.BIND_LEXICAL, undefined, contextDescription);
    node.specifiers.push(this.finishNode(specifier, type));
  }

  maybeParseDefaultImportSpecifier(node) {
    if (this.shouldParseDefaultImport(node)) {
      this.parseImportSpecifierLocal(node, this.startNode(), "ImportDefaultSpecifier", "default import specifier");
      return true;
    }

    return false;
  }

  maybeParseStarImportSpecifier(node) {
    if (this.match(_types2.types.star)) {
      const specifier = this.startNode();
      this.next();
      this.expectContextual("as");
      this.parseImportSpecifierLocal(node, specifier, "ImportNamespaceSpecifier", "import namespace specifier");
      return true;
    }

    return false;
  }

  parseNamedImportSpecifiers(node) {
    let first = true;
    this.expect(_types2.types.braceL);

    while (!this.eat(_types2.types.braceR)) {
      if (first) {
        first = false;
      } else {
        if (this.eat(_types2.types.colon)) {
          throw this.raise(this.state.start, _location.Errors.DestructureNamedImport);
        }

        this.expect(_types2.types.comma);
        if (this.eat(_types2.types.braceR)) break;
      }

      this.parseImportSpecifier(node);
    }
  }

  parseImportSpecifier(node) {
    const specifier = this.startNode();
    specifier.imported = this.parseIdentifier(true);

    if (this.eatContextual("as")) {
      specifier.local = this.parseIdentifier();
    } else {
      this.checkReservedWord(specifier.imported.name, specifier.start, true, true);
      specifier.local = specifier.imported.__clone();
    }

    this.checkLVal(specifier.local, _scopeflags.BIND_LEXICAL, undefined, "import specifier");
    node.specifiers.push(this.finishNode(specifier, "ImportSpecifier"));
  }

}

exports.default = StatementParser;