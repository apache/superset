"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var N = _interopRequireWildcard(require("../types"));

var _context = require("../tokenizer/context");

var _identifier = require("../util/identifier");

var _scopeflags = require("../util/scopeflags");

var _location = require("../parser/location");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const reservedTypes = new Set(["_", "any", "bool", "boolean", "empty", "extends", "false", "interface", "mixed", "null", "number", "static", "string", "true", "typeof", "void"]);
const FlowErrors = Object.freeze({
  AmbiguousConditionalArrow: "Ambiguous expression: wrap the arrow functions in parentheses to disambiguate.",
  AmbiguousDeclareModuleKind: "Found both `declare module.exports` and `declare export` in the same module. Modules can only have 1 since they are either an ES module or they are a CommonJS module",
  AssignReservedType: "Cannot overwrite reserved type %0",
  DuplicateDeclareModuleExports: "Duplicate `declare module.exports` statement",
  EnumBooleanMemberNotInitialized: "Boolean enum members need to be initialized. Use either `%0 = true,` or `%0 = false,` in enum `%1`.",
  EnumDuplicateMemberName: "Enum member names need to be unique, but the name `%0` has already been used before in enum `%1`.",
  EnumInconsistentMemberValues: "Enum `%0` has inconsistent member initializers. Either use no initializers, or consistently use literals (either booleans, numbers, or strings) for all member initializers.",
  EnumInvalidExplicitType: "Enum type `%1` is not valid. Use one of `boolean`, `number`, `string`, or `symbol` in enum `%0`.",
  EnumInvalidExplicitTypeUnknownSupplied: "Supplied enum type is not valid. Use one of `boolean`, `number`, `string`, or `symbol` in enum `%0`.",
  EnumInvalidMemberInitializerPrimaryType: "Enum `%0` has type `%2`, so the initializer of `%1` needs to be a %2 literal.",
  EnumInvalidMemberInitializerSymbolType: "Symbol enum members cannot be initialized. Use `%1,` in enum `%0`.",
  EnumInvalidMemberInitializerUnknownType: "The enum member initializer for `%1` needs to be a literal (either a boolean, number, or string) in enum `%0`.",
  EnumInvalidMemberName: "Enum member names cannot start with lowercase 'a' through 'z'. Instead of using `%0`, consider using `%1`, in enum `%2`.",
  EnumNumberMemberNotInitialized: "Number enum members need to be initialized, e.g. `%1 = 1` in enum `%0`.",
  EnumStringMemberInconsistentlyInitailized: "String enum members need to consistently either all use initializers, or use no initializers, in enum `%0`.",
  ImportTypeShorthandOnlyInPureImport: "The `type` and `typeof` keywords on named imports can only be used on regular `import` statements. It cannot be used with `import type` or `import typeof` statements",
  InexactInsideExact: "Explicit inexact syntax cannot appear inside an explicit exact object type",
  InexactInsideNonObject: "Explicit inexact syntax cannot appear in class or interface definitions",
  InexactVariance: "Explicit inexact syntax cannot have variance",
  InvalidNonTypeImportInDeclareModule: "Imports within a `declare module` body must always be `import type` or `import typeof`",
  MissingTypeParamDefault: "Type parameter declaration needs a default, since a preceding type parameter declaration has a default.",
  NestedDeclareModule: "`declare module` cannot be used inside another `declare module`",
  NestedFlowComment: "Cannot have a flow comment inside another flow comment",
  OptionalBindingPattern: "A binding pattern parameter cannot be optional in an implementation signature.",
  SpreadVariance: "Spread properties cannot have variance",
  TypeBeforeInitializer: "Type annotations must come before default assignments, e.g. instead of `age = 25: number` use `age: number = 25`",
  TypeCastInPattern: "The type cast expression is expected to be wrapped with parenthesis",
  UnexpectedExplicitInexactInObject: "Explicit inexact syntax must appear at the end of an inexact object",
  UnexpectedReservedType: "Unexpected reserved type %0",
  UnexpectedReservedUnderscore: "`_` is only allowed as a type argument to call or new",
  UnexpectedSpaceBetweenModuloChecks: "Spaces between ´%´ and ´checks´ are not allowed here.",
  UnexpectedSpreadType: "Spread operator cannot appear in class or interface definitions",
  UnexpectedSubtractionOperand: 'Unexpected token, expected "number" or "bigint"',
  UnexpectedTokenAfterTypeParameter: "Expected an arrow function after this type parameter declaration",
  UnsupportedDeclareExportKind: "`declare export %0` is not supported. Use `%1` instead",
  UnsupportedStatementInDeclareModule: "Only declares and type imports are allowed inside declare module",
  UnterminatedFlowComment: "Unterminated flow-comment"
});

function isEsModuleType(bodyElement) {
  return bodyElement.type === "DeclareExportAllDeclaration" || bodyElement.type === "DeclareExportDeclaration" && (!bodyElement.declaration || bodyElement.declaration.type !== "TypeAlias" && bodyElement.declaration.type !== "InterfaceDeclaration");
}

function hasTypeImportKind(node) {
  return node.importKind === "type" || node.importKind === "typeof";
}

function isMaybeDefaultImport(state) {
  return (state.type === _types.types.name || !!state.type.keyword) && state.value !== "from";
}

const exportSuggestions = {
  const: "declare export var",
  let: "declare export var",
  type: "export type",
  interface: "export interface"
};

function partition(list, test) {
  const list1 = [];
  const list2 = [];

  for (let i = 0; i < list.length; i++) {
    (test(list[i], i, list) ? list1 : list2).push(list[i]);
  }

  return [list1, list2];
}

const FLOW_PRAGMA_REGEX = /\*?\s*@((?:no)?flow)\b/;

var _default = superClass => class extends superClass {
  constructor(options, input) {
    super(options, input);
    this.flowPragma = undefined;
  }

  shouldParseTypes() {
    return this.getPluginOption("flow", "all") || this.flowPragma === "flow";
  }

  shouldParseEnums() {
    return !!this.getPluginOption("flow", "enums");
  }

  finishToken(type, val) {
    if (type !== _types.types.string && type !== _types.types.semi && type !== _types.types.interpreterDirective) {
      if (this.flowPragma === undefined) {
        this.flowPragma = null;
      }
    }

    return super.finishToken(type, val);
  }

  addComment(comment) {
    if (this.flowPragma === undefined) {
      const matches = FLOW_PRAGMA_REGEX.exec(comment.value);

      if (!matches) {} else if (matches[1] === "flow") {
        this.flowPragma = "flow";
      } else if (matches[1] === "noflow") {
        this.flowPragma = "noflow";
      } else {
        throw new Error("Unexpected flow pragma");
      }
    }

    return super.addComment(comment);
  }

  flowParseTypeInitialiser(tok) {
    const oldInType = this.state.inType;
    this.state.inType = true;
    this.expect(tok || _types.types.colon);
    const type = this.flowParseType();
    this.state.inType = oldInType;
    return type;
  }

  flowParsePredicate() {
    const node = this.startNode();
    const moduloLoc = this.state.startLoc;
    const moduloPos = this.state.start;
    this.expect(_types.types.modulo);
    const checksLoc = this.state.startLoc;
    this.expectContextual("checks");

    if (moduloLoc.line !== checksLoc.line || moduloLoc.column !== checksLoc.column - 1) {
      this.raise(moduloPos, FlowErrors.UnexpectedSpaceBetweenModuloChecks);
    }

    if (this.eat(_types.types.parenL)) {
      node.value = this.parseExpression();
      this.expect(_types.types.parenR);
      return this.finishNode(node, "DeclaredPredicate");
    } else {
      return this.finishNode(node, "InferredPredicate");
    }
  }

  flowParseTypeAndPredicateInitialiser() {
    const oldInType = this.state.inType;
    this.state.inType = true;
    this.expect(_types.types.colon);
    let type = null;
    let predicate = null;

    if (this.match(_types.types.modulo)) {
      this.state.inType = oldInType;
      predicate = this.flowParsePredicate();
    } else {
      type = this.flowParseType();
      this.state.inType = oldInType;

      if (this.match(_types.types.modulo)) {
        predicate = this.flowParsePredicate();
      }
    }

    return [type, predicate];
  }

  flowParseDeclareClass(node) {
    this.next();
    this.flowParseInterfaceish(node, true);
    return this.finishNode(node, "DeclareClass");
  }

  flowParseDeclareFunction(node) {
    this.next();
    const id = node.id = this.parseIdentifier();
    const typeNode = this.startNode();
    const typeContainer = this.startNode();

    if (this.isRelational("<")) {
      typeNode.typeParameters = this.flowParseTypeParameterDeclaration();
    } else {
      typeNode.typeParameters = null;
    }

    this.expect(_types.types.parenL);
    const tmp = this.flowParseFunctionTypeParams();
    typeNode.params = tmp.params;
    typeNode.rest = tmp.rest;
    this.expect(_types.types.parenR);
    [typeNode.returnType, node.predicate] = this.flowParseTypeAndPredicateInitialiser();
    typeContainer.typeAnnotation = this.finishNode(typeNode, "FunctionTypeAnnotation");
    id.typeAnnotation = this.finishNode(typeContainer, "TypeAnnotation");
    this.resetEndLocation(id);
    this.semicolon();
    return this.finishNode(node, "DeclareFunction");
  }

  flowParseDeclare(node, insideModule) {
    if (this.match(_types.types._class)) {
      return this.flowParseDeclareClass(node);
    } else if (this.match(_types.types._function)) {
      return this.flowParseDeclareFunction(node);
    } else if (this.match(_types.types._var)) {
      return this.flowParseDeclareVariable(node);
    } else if (this.eatContextual("module")) {
      if (this.match(_types.types.dot)) {
        return this.flowParseDeclareModuleExports(node);
      } else {
        if (insideModule) {
          this.raise(this.state.lastTokStart, FlowErrors.NestedDeclareModule);
        }

        return this.flowParseDeclareModule(node);
      }
    } else if (this.isContextual("type")) {
      return this.flowParseDeclareTypeAlias(node);
    } else if (this.isContextual("opaque")) {
      return this.flowParseDeclareOpaqueType(node);
    } else if (this.isContextual("interface")) {
      return this.flowParseDeclareInterface(node);
    } else if (this.match(_types.types._export)) {
      return this.flowParseDeclareExportDeclaration(node, insideModule);
    } else {
      throw this.unexpected();
    }
  }

  flowParseDeclareVariable(node) {
    this.next();
    node.id = this.flowParseTypeAnnotatableIdentifier(true);
    this.scope.declareName(node.id.name, _scopeflags.BIND_VAR, node.id.start);
    this.semicolon();
    return this.finishNode(node, "DeclareVariable");
  }

  flowParseDeclareModule(node) {
    this.scope.enter(_scopeflags.SCOPE_OTHER);

    if (this.match(_types.types.string)) {
      node.id = this.parseExprAtom();
    } else {
      node.id = this.parseIdentifier();
    }

    const bodyNode = node.body = this.startNode();
    const body = bodyNode.body = [];
    this.expect(_types.types.braceL);

    while (!this.match(_types.types.braceR)) {
      let bodyNode = this.startNode();

      if (this.match(_types.types._import)) {
        this.next();

        if (!this.isContextual("type") && !this.match(_types.types._typeof)) {
          this.raise(this.state.lastTokStart, FlowErrors.InvalidNonTypeImportInDeclareModule);
        }

        this.parseImport(bodyNode);
      } else {
        this.expectContextual("declare", FlowErrors.UnsupportedStatementInDeclareModule);
        bodyNode = this.flowParseDeclare(bodyNode, true);
      }

      body.push(bodyNode);
    }

    this.scope.exit();
    this.expect(_types.types.braceR);
    this.finishNode(bodyNode, "BlockStatement");
    let kind = null;
    let hasModuleExport = false;
    body.forEach(bodyElement => {
      if (isEsModuleType(bodyElement)) {
        if (kind === "CommonJS") {
          this.raise(bodyElement.start, FlowErrors.AmbiguousDeclareModuleKind);
        }

        kind = "ES";
      } else if (bodyElement.type === "DeclareModuleExports") {
        if (hasModuleExport) {
          this.raise(bodyElement.start, FlowErrors.DuplicateDeclareModuleExports);
        }

        if (kind === "ES") {
          this.raise(bodyElement.start, FlowErrors.AmbiguousDeclareModuleKind);
        }

        kind = "CommonJS";
        hasModuleExport = true;
      }
    });
    node.kind = kind || "CommonJS";
    return this.finishNode(node, "DeclareModule");
  }

  flowParseDeclareExportDeclaration(node, insideModule) {
    this.expect(_types.types._export);

    if (this.eat(_types.types._default)) {
      if (this.match(_types.types._function) || this.match(_types.types._class)) {
        node.declaration = this.flowParseDeclare(this.startNode());
      } else {
        node.declaration = this.flowParseType();
        this.semicolon();
      }

      node.default = true;
      return this.finishNode(node, "DeclareExportDeclaration");
    } else {
      if (this.match(_types.types._const) || this.isLet() || (this.isContextual("type") || this.isContextual("interface")) && !insideModule) {
        const label = this.state.value;
        const suggestion = exportSuggestions[label];
        throw this.raise(this.state.start, FlowErrors.UnsupportedDeclareExportKind, label, suggestion);
      }

      if (this.match(_types.types._var) || this.match(_types.types._function) || this.match(_types.types._class) || this.isContextual("opaque")) {
          node.declaration = this.flowParseDeclare(this.startNode());
          node.default = false;
          return this.finishNode(node, "DeclareExportDeclaration");
        } else if (this.match(_types.types.star) || this.match(_types.types.braceL) || this.isContextual("interface") || this.isContextual("type") || this.isContextual("opaque")) {
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
  }

  flowParseDeclareModuleExports(node) {
    this.next();
    this.expectContextual("exports");
    node.typeAnnotation = this.flowParseTypeAnnotation();
    this.semicolon();
    return this.finishNode(node, "DeclareModuleExports");
  }

  flowParseDeclareTypeAlias(node) {
    this.next();
    this.flowParseTypeAlias(node);
    node.type = "DeclareTypeAlias";
    return node;
  }

  flowParseDeclareOpaqueType(node) {
    this.next();
    this.flowParseOpaqueType(node, true);
    node.type = "DeclareOpaqueType";
    return node;
  }

  flowParseDeclareInterface(node) {
    this.next();
    this.flowParseInterfaceish(node);
    return this.finishNode(node, "DeclareInterface");
  }

  flowParseInterfaceish(node, isClass = false) {
    node.id = this.flowParseRestrictedIdentifier(!isClass, true);
    this.scope.declareName(node.id.name, isClass ? _scopeflags.BIND_FUNCTION : _scopeflags.BIND_LEXICAL, node.id.start);

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterDeclaration();
    } else {
      node.typeParameters = null;
    }

    node.extends = [];
    node.implements = [];
    node.mixins = [];

    if (this.eat(_types.types._extends)) {
      do {
        node.extends.push(this.flowParseInterfaceExtends());
      } while (!isClass && this.eat(_types.types.comma));
    }

    if (this.isContextual("mixins")) {
      this.next();

      do {
        node.mixins.push(this.flowParseInterfaceExtends());
      } while (this.eat(_types.types.comma));
    }

    if (this.isContextual("implements")) {
      this.next();

      do {
        node.implements.push(this.flowParseInterfaceExtends());
      } while (this.eat(_types.types.comma));
    }

    node.body = this.flowParseObjectType({
      allowStatic: isClass,
      allowExact: false,
      allowSpread: false,
      allowProto: isClass,
      allowInexact: false
    });
  }

  flowParseInterfaceExtends() {
    const node = this.startNode();
    node.id = this.flowParseQualifiedTypeIdentifier();

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterInstantiation();
    } else {
      node.typeParameters = null;
    }

    return this.finishNode(node, "InterfaceExtends");
  }

  flowParseInterface(node) {
    this.flowParseInterfaceish(node);
    return this.finishNode(node, "InterfaceDeclaration");
  }

  checkNotUnderscore(word) {
    if (word === "_") {
      this.raise(this.state.start, FlowErrors.UnexpectedReservedUnderscore);
    }
  }

  checkReservedType(word, startLoc, declaration) {
    if (!reservedTypes.has(word)) return;
    this.raise(startLoc, declaration ? FlowErrors.AssignReservedType : FlowErrors.UnexpectedReservedType, word);
  }

  flowParseRestrictedIdentifier(liberal, declaration) {
    this.checkReservedType(this.state.value, this.state.start, declaration);
    return this.parseIdentifier(liberal);
  }

  flowParseTypeAlias(node) {
    node.id = this.flowParseRestrictedIdentifier(false, true);
    this.scope.declareName(node.id.name, _scopeflags.BIND_LEXICAL, node.id.start);

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterDeclaration();
    } else {
      node.typeParameters = null;
    }

    node.right = this.flowParseTypeInitialiser(_types.types.eq);
    this.semicolon();
    return this.finishNode(node, "TypeAlias");
  }

  flowParseOpaqueType(node, declare) {
    this.expectContextual("type");
    node.id = this.flowParseRestrictedIdentifier(true, true);
    this.scope.declareName(node.id.name, _scopeflags.BIND_LEXICAL, node.id.start);

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterDeclaration();
    } else {
      node.typeParameters = null;
    }

    node.supertype = null;

    if (this.match(_types.types.colon)) {
      node.supertype = this.flowParseTypeInitialiser(_types.types.colon);
    }

    node.impltype = null;

    if (!declare) {
      node.impltype = this.flowParseTypeInitialiser(_types.types.eq);
    }

    this.semicolon();
    return this.finishNode(node, "OpaqueType");
  }

  flowParseTypeParameter(requireDefault = false) {
    const nodeStart = this.state.start;
    const node = this.startNode();
    const variance = this.flowParseVariance();
    const ident = this.flowParseTypeAnnotatableIdentifier();
    node.name = ident.name;
    node.variance = variance;
    node.bound = ident.typeAnnotation;

    if (this.match(_types.types.eq)) {
      this.eat(_types.types.eq);
      node.default = this.flowParseType();
    } else {
      if (requireDefault) {
        this.raise(nodeStart, FlowErrors.MissingTypeParamDefault);
      }
    }

    return this.finishNode(node, "TypeParameter");
  }

  flowParseTypeParameterDeclaration() {
    const oldInType = this.state.inType;
    const node = this.startNode();
    node.params = [];
    this.state.inType = true;

    if (this.isRelational("<") || this.match(_types.types.jsxTagStart)) {
      this.next();
    } else {
      this.unexpected();
    }

    let defaultRequired = false;

    do {
      const typeParameter = this.flowParseTypeParameter(defaultRequired);
      node.params.push(typeParameter);

      if (typeParameter.default) {
        defaultRequired = true;
      }

      if (!this.isRelational(">")) {
        this.expect(_types.types.comma);
      }
    } while (!this.isRelational(">"));

    this.expectRelational(">");
    this.state.inType = oldInType;
    return this.finishNode(node, "TypeParameterDeclaration");
  }

  flowParseTypeParameterInstantiation() {
    const node = this.startNode();
    const oldInType = this.state.inType;
    node.params = [];
    this.state.inType = true;
    this.expectRelational("<");
    const oldNoAnonFunctionType = this.state.noAnonFunctionType;
    this.state.noAnonFunctionType = false;

    while (!this.isRelational(">")) {
      node.params.push(this.flowParseType());

      if (!this.isRelational(">")) {
        this.expect(_types.types.comma);
      }
    }

    this.state.noAnonFunctionType = oldNoAnonFunctionType;
    this.expectRelational(">");
    this.state.inType = oldInType;
    return this.finishNode(node, "TypeParameterInstantiation");
  }

  flowParseTypeParameterInstantiationCallOrNew() {
    const node = this.startNode();
    const oldInType = this.state.inType;
    node.params = [];
    this.state.inType = true;
    this.expectRelational("<");

    while (!this.isRelational(">")) {
      node.params.push(this.flowParseTypeOrImplicitInstantiation());

      if (!this.isRelational(">")) {
        this.expect(_types.types.comma);
      }
    }

    this.expectRelational(">");
    this.state.inType = oldInType;
    return this.finishNode(node, "TypeParameterInstantiation");
  }

  flowParseInterfaceType() {
    const node = this.startNode();
    this.expectContextual("interface");
    node.extends = [];

    if (this.eat(_types.types._extends)) {
      do {
        node.extends.push(this.flowParseInterfaceExtends());
      } while (this.eat(_types.types.comma));
    }

    node.body = this.flowParseObjectType({
      allowStatic: false,
      allowExact: false,
      allowSpread: false,
      allowProto: false,
      allowInexact: false
    });
    return this.finishNode(node, "InterfaceTypeAnnotation");
  }

  flowParseObjectPropertyKey() {
    return this.match(_types.types.num) || this.match(_types.types.string) ? this.parseExprAtom() : this.parseIdentifier(true);
  }

  flowParseObjectTypeIndexer(node, isStatic, variance) {
    node.static = isStatic;

    if (this.lookahead().type === _types.types.colon) {
      node.id = this.flowParseObjectPropertyKey();
      node.key = this.flowParseTypeInitialiser();
    } else {
      node.id = null;
      node.key = this.flowParseType();
    }

    this.expect(_types.types.bracketR);
    node.value = this.flowParseTypeInitialiser();
    node.variance = variance;
    return this.finishNode(node, "ObjectTypeIndexer");
  }

  flowParseObjectTypeInternalSlot(node, isStatic) {
    node.static = isStatic;
    node.id = this.flowParseObjectPropertyKey();
    this.expect(_types.types.bracketR);
    this.expect(_types.types.bracketR);

    if (this.isRelational("<") || this.match(_types.types.parenL)) {
      node.method = true;
      node.optional = false;
      node.value = this.flowParseObjectTypeMethodish(this.startNodeAt(node.start, node.loc.start));
    } else {
      node.method = false;

      if (this.eat(_types.types.question)) {
        node.optional = true;
      }

      node.value = this.flowParseTypeInitialiser();
    }

    return this.finishNode(node, "ObjectTypeInternalSlot");
  }

  flowParseObjectTypeMethodish(node) {
    node.params = [];
    node.rest = null;
    node.typeParameters = null;

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterDeclaration();
    }

    this.expect(_types.types.parenL);

    while (!this.match(_types.types.parenR) && !this.match(_types.types.ellipsis)) {
      node.params.push(this.flowParseFunctionTypeParam());

      if (!this.match(_types.types.parenR)) {
        this.expect(_types.types.comma);
      }
    }

    if (this.eat(_types.types.ellipsis)) {
      node.rest = this.flowParseFunctionTypeParam();
    }

    this.expect(_types.types.parenR);
    node.returnType = this.flowParseTypeInitialiser();
    return this.finishNode(node, "FunctionTypeAnnotation");
  }

  flowParseObjectTypeCallProperty(node, isStatic) {
    const valueNode = this.startNode();
    node.static = isStatic;
    node.value = this.flowParseObjectTypeMethodish(valueNode);
    return this.finishNode(node, "ObjectTypeCallProperty");
  }

  flowParseObjectType({
    allowStatic,
    allowExact,
    allowSpread,
    allowProto,
    allowInexact
  }) {
    const oldInType = this.state.inType;
    this.state.inType = true;
    const nodeStart = this.startNode();
    nodeStart.callProperties = [];
    nodeStart.properties = [];
    nodeStart.indexers = [];
    nodeStart.internalSlots = [];
    let endDelim;
    let exact;
    let inexact = false;

    if (allowExact && this.match(_types.types.braceBarL)) {
      this.expect(_types.types.braceBarL);
      endDelim = _types.types.braceBarR;
      exact = true;
    } else {
      this.expect(_types.types.braceL);
      endDelim = _types.types.braceR;
      exact = false;
    }

    nodeStart.exact = exact;

    while (!this.match(endDelim)) {
      let isStatic = false;
      let protoStart = null;
      let inexactStart = null;
      const node = this.startNode();

      if (allowProto && this.isContextual("proto")) {
        const lookahead = this.lookahead();

        if (lookahead.type !== _types.types.colon && lookahead.type !== _types.types.question) {
          this.next();
          protoStart = this.state.start;
          allowStatic = false;
        }
      }

      if (allowStatic && this.isContextual("static")) {
        const lookahead = this.lookahead();

        if (lookahead.type !== _types.types.colon && lookahead.type !== _types.types.question) {
          this.next();
          isStatic = true;
        }
      }

      const variance = this.flowParseVariance();

      if (this.eat(_types.types.bracketL)) {
        if (protoStart != null) {
          this.unexpected(protoStart);
        }

        if (this.eat(_types.types.bracketL)) {
          if (variance) {
            this.unexpected(variance.start);
          }

          nodeStart.internalSlots.push(this.flowParseObjectTypeInternalSlot(node, isStatic));
        } else {
          nodeStart.indexers.push(this.flowParseObjectTypeIndexer(node, isStatic, variance));
        }
      } else if (this.match(_types.types.parenL) || this.isRelational("<")) {
        if (protoStart != null) {
          this.unexpected(protoStart);
        }

        if (variance) {
          this.unexpected(variance.start);
        }

        nodeStart.callProperties.push(this.flowParseObjectTypeCallProperty(node, isStatic));
      } else {
        let kind = "init";

        if (this.isContextual("get") || this.isContextual("set")) {
          const lookahead = this.lookahead();

          if (lookahead.type === _types.types.name || lookahead.type === _types.types.string || lookahead.type === _types.types.num) {
            kind = this.state.value;
            this.next();
          }
        }

        const propOrInexact = this.flowParseObjectTypeProperty(node, isStatic, protoStart, variance, kind, allowSpread, allowInexact != null ? allowInexact : !exact);

        if (propOrInexact === null) {
          inexact = true;
          inexactStart = this.state.lastTokStart;
        } else {
          nodeStart.properties.push(propOrInexact);
        }
      }

      this.flowObjectTypeSemicolon();

      if (inexactStart && !this.match(_types.types.braceR) && !this.match(_types.types.braceBarR)) {
        this.raise(inexactStart, FlowErrors.UnexpectedExplicitInexactInObject);
      }
    }

    this.expect(endDelim);

    if (allowSpread) {
      nodeStart.inexact = inexact;
    }

    const out = this.finishNode(nodeStart, "ObjectTypeAnnotation");
    this.state.inType = oldInType;
    return out;
  }

  flowParseObjectTypeProperty(node, isStatic, protoStart, variance, kind, allowSpread, allowInexact) {
    if (this.eat(_types.types.ellipsis)) {
      const isInexactToken = this.match(_types.types.comma) || this.match(_types.types.semi) || this.match(_types.types.braceR) || this.match(_types.types.braceBarR);

      if (isInexactToken) {
        if (!allowSpread) {
          this.raise(this.state.lastTokStart, FlowErrors.InexactInsideNonObject);
        } else if (!allowInexact) {
          this.raise(this.state.lastTokStart, FlowErrors.InexactInsideExact);
        }

        if (variance) {
          this.raise(variance.start, FlowErrors.InexactVariance);
        }

        return null;
      }

      if (!allowSpread) {
        this.raise(this.state.lastTokStart, FlowErrors.UnexpectedSpreadType);
      }

      if (protoStart != null) {
        this.unexpected(protoStart);
      }

      if (variance) {
        this.raise(variance.start, FlowErrors.SpreadVariance);
      }

      node.argument = this.flowParseType();
      return this.finishNode(node, "ObjectTypeSpreadProperty");
    } else {
      node.key = this.flowParseObjectPropertyKey();
      node.static = isStatic;
      node.proto = protoStart != null;
      node.kind = kind;
      let optional = false;

      if (this.isRelational("<") || this.match(_types.types.parenL)) {
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

        if (this.eat(_types.types.question)) {
          optional = true;
        }

        node.value = this.flowParseTypeInitialiser();
        node.variance = variance;
      }

      node.optional = optional;
      return this.finishNode(node, "ObjectTypeProperty");
    }
  }

  flowCheckGetterSetterParams(property) {
    const paramCount = property.kind === "get" ? 0 : 1;
    const start = property.start;
    const length = property.value.params.length + (property.value.rest ? 1 : 0);

    if (length !== paramCount) {
      if (property.kind === "get") {
        this.raise(start, _location.Errors.BadGetterArity);
      } else {
        this.raise(start, _location.Errors.BadSetterArity);
      }
    }

    if (property.kind === "set" && property.value.rest) {
      this.raise(start, _location.Errors.BadSetterRestParameter);
    }
  }

  flowObjectTypeSemicolon() {
    if (!this.eat(_types.types.semi) && !this.eat(_types.types.comma) && !this.match(_types.types.braceR) && !this.match(_types.types.braceBarR)) {
      this.unexpected();
    }
  }

  flowParseQualifiedTypeIdentifier(startPos, startLoc, id) {
    startPos = startPos || this.state.start;
    startLoc = startLoc || this.state.startLoc;
    let node = id || this.flowParseRestrictedIdentifier(true);

    while (this.eat(_types.types.dot)) {
      const node2 = this.startNodeAt(startPos, startLoc);
      node2.qualification = node;
      node2.id = this.flowParseRestrictedIdentifier(true);
      node = this.finishNode(node2, "QualifiedTypeIdentifier");
    }

    return node;
  }

  flowParseGenericType(startPos, startLoc, id) {
    const node = this.startNodeAt(startPos, startLoc);
    node.typeParameters = null;
    node.id = this.flowParseQualifiedTypeIdentifier(startPos, startLoc, id);

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterInstantiation();
    }

    return this.finishNode(node, "GenericTypeAnnotation");
  }

  flowParseTypeofType() {
    const node = this.startNode();
    this.expect(_types.types._typeof);
    node.argument = this.flowParsePrimaryType();
    return this.finishNode(node, "TypeofTypeAnnotation");
  }

  flowParseTupleType() {
    const node = this.startNode();
    node.types = [];
    this.expect(_types.types.bracketL);

    while (this.state.pos < this.length && !this.match(_types.types.bracketR)) {
      node.types.push(this.flowParseType());
      if (this.match(_types.types.bracketR)) break;
      this.expect(_types.types.comma);
    }

    this.expect(_types.types.bracketR);
    return this.finishNode(node, "TupleTypeAnnotation");
  }

  flowParseFunctionTypeParam() {
    let name = null;
    let optional = false;
    let typeAnnotation = null;
    const node = this.startNode();
    const lh = this.lookahead();

    if (lh.type === _types.types.colon || lh.type === _types.types.question) {
      name = this.parseIdentifier();

      if (this.eat(_types.types.question)) {
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
  }

  reinterpretTypeAsFunctionTypeParam(type) {
    const node = this.startNodeAt(type.start, type.loc.start);
    node.name = null;
    node.optional = false;
    node.typeAnnotation = type;
    return this.finishNode(node, "FunctionTypeParam");
  }

  flowParseFunctionTypeParams(params = []) {
    let rest = null;

    while (!this.match(_types.types.parenR) && !this.match(_types.types.ellipsis)) {
      params.push(this.flowParseFunctionTypeParam());

      if (!this.match(_types.types.parenR)) {
        this.expect(_types.types.comma);
      }
    }

    if (this.eat(_types.types.ellipsis)) {
      rest = this.flowParseFunctionTypeParam();
    }

    return {
      params,
      rest
    };
  }

  flowIdentToTypeAnnotation(startPos, startLoc, node, id) {
    switch (id.name) {
      case "any":
        return this.finishNode(node, "AnyTypeAnnotation");

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
  }

  flowParsePrimaryType() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const node = this.startNode();
    let tmp;
    let type;
    let isGroupedType = false;
    const oldNoAnonFunctionType = this.state.noAnonFunctionType;

    switch (this.state.type) {
      case _types.types.name:
        if (this.isContextual("interface")) {
          return this.flowParseInterfaceType();
        }

        return this.flowIdentToTypeAnnotation(startPos, startLoc, node, this.parseIdentifier());

      case _types.types.braceL:
        return this.flowParseObjectType({
          allowStatic: false,
          allowExact: false,
          allowSpread: true,
          allowProto: false,
          allowInexact: true
        });

      case _types.types.braceBarL:
        return this.flowParseObjectType({
          allowStatic: false,
          allowExact: true,
          allowSpread: true,
          allowProto: false,
          allowInexact: false
        });

      case _types.types.bracketL:
        this.state.noAnonFunctionType = false;
        type = this.flowParseTupleType();
        this.state.noAnonFunctionType = oldNoAnonFunctionType;
        return type;

      case _types.types.relational:
        if (this.state.value === "<") {
          node.typeParameters = this.flowParseTypeParameterDeclaration();
          this.expect(_types.types.parenL);
          tmp = this.flowParseFunctionTypeParams();
          node.params = tmp.params;
          node.rest = tmp.rest;
          this.expect(_types.types.parenR);
          this.expect(_types.types.arrow);
          node.returnType = this.flowParseType();
          return this.finishNode(node, "FunctionTypeAnnotation");
        }

        break;

      case _types.types.parenL:
        this.next();

        if (!this.match(_types.types.parenR) && !this.match(_types.types.ellipsis)) {
          if (this.match(_types.types.name)) {
            const token = this.lookahead().type;
            isGroupedType = token !== _types.types.question && token !== _types.types.colon;
          } else {
            isGroupedType = true;
          }
        }

        if (isGroupedType) {
          this.state.noAnonFunctionType = false;
          type = this.flowParseType();
          this.state.noAnonFunctionType = oldNoAnonFunctionType;

          if (this.state.noAnonFunctionType || !(this.match(_types.types.comma) || this.match(_types.types.parenR) && this.lookahead().type === _types.types.arrow)) {
            this.expect(_types.types.parenR);
            return type;
          } else {
            this.eat(_types.types.comma);
          }
        }

        if (type) {
          tmp = this.flowParseFunctionTypeParams([this.reinterpretTypeAsFunctionTypeParam(type)]);
        } else {
          tmp = this.flowParseFunctionTypeParams();
        }

        node.params = tmp.params;
        node.rest = tmp.rest;
        this.expect(_types.types.parenR);
        this.expect(_types.types.arrow);
        node.returnType = this.flowParseType();
        node.typeParameters = null;
        return this.finishNode(node, "FunctionTypeAnnotation");

      case _types.types.string:
        return this.parseLiteral(this.state.value, "StringLiteralTypeAnnotation");

      case _types.types._true:
      case _types.types._false:
        node.value = this.match(_types.types._true);
        this.next();
        return this.finishNode(node, "BooleanLiteralTypeAnnotation");

      case _types.types.plusMin:
        if (this.state.value === "-") {
          this.next();

          if (this.match(_types.types.num)) {
            return this.parseLiteral(-this.state.value, "NumberLiteralTypeAnnotation", node.start, node.loc.start);
          }

          if (this.match(_types.types.bigint)) {
            return this.parseLiteral(-this.state.value, "BigIntLiteralTypeAnnotation", node.start, node.loc.start);
          }

          throw this.raise(this.state.start, FlowErrors.UnexpectedSubtractionOperand);
        }

        throw this.unexpected();

      case _types.types.num:
        return this.parseLiteral(this.state.value, "NumberLiteralTypeAnnotation");

      case _types.types.bigint:
        return this.parseLiteral(this.state.value, "BigIntLiteralTypeAnnotation");

      case _types.types._void:
        this.next();
        return this.finishNode(node, "VoidTypeAnnotation");

      case _types.types._null:
        this.next();
        return this.finishNode(node, "NullLiteralTypeAnnotation");

      case _types.types._this:
        this.next();
        return this.finishNode(node, "ThisTypeAnnotation");

      case _types.types.star:
        this.next();
        return this.finishNode(node, "ExistsTypeAnnotation");

      default:
        if (this.state.type.keyword === "typeof") {
          return this.flowParseTypeofType();
        } else if (this.state.type.keyword) {
          const label = this.state.type.label;
          this.next();
          return super.createIdentifier(node, label);
        }

    }

    throw this.unexpected();
  }

  flowParsePostfixType() {
    const startPos = this.state.start,
          startLoc = this.state.startLoc;
    let type = this.flowParsePrimaryType();

    while (this.match(_types.types.bracketL) && !this.canInsertSemicolon()) {
      const node = this.startNodeAt(startPos, startLoc);
      node.elementType = type;
      this.expect(_types.types.bracketL);
      this.expect(_types.types.bracketR);
      type = this.finishNode(node, "ArrayTypeAnnotation");
    }

    return type;
  }

  flowParsePrefixType() {
    const node = this.startNode();

    if (this.eat(_types.types.question)) {
      node.typeAnnotation = this.flowParsePrefixType();
      return this.finishNode(node, "NullableTypeAnnotation");
    } else {
      return this.flowParsePostfixType();
    }
  }

  flowParseAnonFunctionWithoutParens() {
    const param = this.flowParsePrefixType();

    if (!this.state.noAnonFunctionType && this.eat(_types.types.arrow)) {
      const node = this.startNodeAt(param.start, param.loc.start);
      node.params = [this.reinterpretTypeAsFunctionTypeParam(param)];
      node.rest = null;
      node.returnType = this.flowParseType();
      node.typeParameters = null;
      return this.finishNode(node, "FunctionTypeAnnotation");
    }

    return param;
  }

  flowParseIntersectionType() {
    const node = this.startNode();
    this.eat(_types.types.bitwiseAND);
    const type = this.flowParseAnonFunctionWithoutParens();
    node.types = [type];

    while (this.eat(_types.types.bitwiseAND)) {
      node.types.push(this.flowParseAnonFunctionWithoutParens());
    }

    return node.types.length === 1 ? type : this.finishNode(node, "IntersectionTypeAnnotation");
  }

  flowParseUnionType() {
    const node = this.startNode();
    this.eat(_types.types.bitwiseOR);
    const type = this.flowParseIntersectionType();
    node.types = [type];

    while (this.eat(_types.types.bitwiseOR)) {
      node.types.push(this.flowParseIntersectionType());
    }

    return node.types.length === 1 ? type : this.finishNode(node, "UnionTypeAnnotation");
  }

  flowParseType() {
    const oldInType = this.state.inType;
    this.state.inType = true;
    const type = this.flowParseUnionType();
    this.state.inType = oldInType;
    this.state.exprAllowed = this.state.exprAllowed || this.state.noAnonFunctionType;
    return type;
  }

  flowParseTypeOrImplicitInstantiation() {
    if (this.state.type === _types.types.name && this.state.value === "_") {
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      const node = this.parseIdentifier();
      return this.flowParseGenericType(startPos, startLoc, node);
    } else {
      return this.flowParseType();
    }
  }

  flowParseTypeAnnotation() {
    const node = this.startNode();
    node.typeAnnotation = this.flowParseTypeInitialiser();
    return this.finishNode(node, "TypeAnnotation");
  }

  flowParseTypeAnnotatableIdentifier(allowPrimitiveOverride) {
    const ident = allowPrimitiveOverride ? this.parseIdentifier() : this.flowParseRestrictedIdentifier();

    if (this.match(_types.types.colon)) {
      ident.typeAnnotation = this.flowParseTypeAnnotation();
      this.resetEndLocation(ident);
    }

    return ident;
  }

  typeCastToParameter(node) {
    node.expression.typeAnnotation = node.typeAnnotation;
    this.resetEndLocation(node.expression, node.typeAnnotation.end, node.typeAnnotation.loc.end);
    return node.expression;
  }

  flowParseVariance() {
    let variance = null;

    if (this.match(_types.types.plusMin)) {
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
  }

  parseFunctionBody(node, allowExpressionBody, isMethod = false) {
    if (allowExpressionBody) {
      return this.forwardNoArrowParamsConversionAt(node, () => super.parseFunctionBody(node, true, isMethod));
    }

    return super.parseFunctionBody(node, false, isMethod);
  }

  parseFunctionBodyAndFinish(node, type, isMethod = false) {
    if (this.match(_types.types.colon)) {
      const typeNode = this.startNode();
      [typeNode.typeAnnotation, node.predicate] = this.flowParseTypeAndPredicateInitialiser();
      node.returnType = typeNode.typeAnnotation ? this.finishNode(typeNode, "TypeAnnotation") : null;
    }

    super.parseFunctionBodyAndFinish(node, type, isMethod);
  }

  parseStatement(context, topLevel) {
    if (this.state.strict && this.match(_types.types.name) && this.state.value === "interface") {
      const node = this.startNode();
      this.next();
      return this.flowParseInterface(node);
    } else if (this.shouldParseEnums() && this.isContextual("enum")) {
      const node = this.startNode();
      this.next();
      return this.flowParseEnumDeclaration(node);
    } else {
      const stmt = super.parseStatement(context, topLevel);

      if (this.flowPragma === undefined && !this.isValidDirective(stmt)) {
        this.flowPragma = null;
      }

      return stmt;
    }
  }

  parseExpressionStatement(node, expr) {
    if (expr.type === "Identifier") {
      if (expr.name === "declare") {
        if (this.match(_types.types._class) || this.match(_types.types.name) || this.match(_types.types._function) || this.match(_types.types._var) || this.match(_types.types._export)) {
          return this.flowParseDeclare(node);
        }
      } else if (this.match(_types.types.name)) {
        if (expr.name === "interface") {
          return this.flowParseInterface(node);
        } else if (expr.name === "type") {
          return this.flowParseTypeAlias(node);
        } else if (expr.name === "opaque") {
          return this.flowParseOpaqueType(node, false);
        }
      }
    }

    return super.parseExpressionStatement(node, expr);
  }

  shouldParseExportDeclaration() {
    return this.isContextual("type") || this.isContextual("interface") || this.isContextual("opaque") || this.shouldParseEnums() && this.isContextual("enum") || super.shouldParseExportDeclaration();
  }

  isExportDefaultSpecifier() {
    if (this.match(_types.types.name) && (this.state.value === "type" || this.state.value === "interface" || this.state.value === "opaque" || this.shouldParseEnums() && this.state.value === "enum")) {
      return false;
    }

    return super.isExportDefaultSpecifier();
  }

  parseExportDefaultExpression() {
    if (this.shouldParseEnums() && this.isContextual("enum")) {
      const node = this.startNode();
      this.next();
      return this.flowParseEnumDeclaration(node);
    }

    return super.parseExportDefaultExpression();
  }

  parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos) {
    if (!this.match(_types.types.question)) return expr;

    if (refNeedsArrowPos) {
      const result = this.tryParse(() => super.parseConditional(expr, noIn, startPos, startLoc));

      if (!result.node) {
        refNeedsArrowPos.start = result.error.pos || this.state.start;
        return expr;
      }

      if (result.error) this.state = result.failState;
      return result.node;
    }

    this.expect(_types.types.question);
    const state = this.state.clone();
    const originalNoArrowAt = this.state.noArrowAt;
    const node = this.startNodeAt(startPos, startLoc);
    let {
      consequent,
      failed
    } = this.tryParseConditionalConsequent();
    let [valid, invalid] = this.getArrowLikeExpressions(consequent);

    if (failed || invalid.length > 0) {
      const noArrowAt = [...originalNoArrowAt];

      if (invalid.length > 0) {
        this.state = state;
        this.state.noArrowAt = noArrowAt;

        for (let i = 0; i < invalid.length; i++) {
          noArrowAt.push(invalid[i].start);
        }

        ({
          consequent,
          failed
        } = this.tryParseConditionalConsequent());
        [valid, invalid] = this.getArrowLikeExpressions(consequent);
      }

      if (failed && valid.length > 1) {
        this.raise(state.start, FlowErrors.AmbiguousConditionalArrow);
      }

      if (failed && valid.length === 1) {
        this.state = state;
        this.state.noArrowAt = noArrowAt.concat(valid[0].start);
        ({
          consequent,
          failed
        } = this.tryParseConditionalConsequent());
      }
    }

    this.getArrowLikeExpressions(consequent, true);
    this.state.noArrowAt = originalNoArrowAt;
    this.expect(_types.types.colon);
    node.test = expr;
    node.consequent = consequent;
    node.alternate = this.forwardNoArrowParamsConversionAt(node, () => this.parseMaybeAssign(noIn, undefined, undefined, undefined));
    return this.finishNode(node, "ConditionalExpression");
  }

  tryParseConditionalConsequent() {
    this.state.noArrowParamsConversionAt.push(this.state.start);
    const consequent = this.parseMaybeAssign();
    const failed = !this.match(_types.types.colon);
    this.state.noArrowParamsConversionAt.pop();
    return {
      consequent,
      failed
    };
  }

  getArrowLikeExpressions(node, disallowInvalid) {
    const stack = [node];
    const arrows = [];

    while (stack.length !== 0) {
      const node = stack.pop();

      if (node.type === "ArrowFunctionExpression") {
        if (node.typeParameters || !node.returnType) {
          this.finishArrowValidation(node);
        } else {
          arrows.push(node);
        }

        stack.push(node.body);
      } else if (node.type === "ConditionalExpression") {
        stack.push(node.consequent);
        stack.push(node.alternate);
      }
    }

    if (disallowInvalid) {
      arrows.forEach(node => this.finishArrowValidation(node));
      return [arrows, []];
    }

    return partition(arrows, node => node.params.every(param => this.isAssignable(param, true)));
  }

  finishArrowValidation(node) {
    var _node$extra;

    this.toAssignableList(node.params, (_node$extra = node.extra) == null ? void 0 : _node$extra.trailingComma);
    this.scope.enter(_scopeflags.SCOPE_FUNCTION | _scopeflags.SCOPE_ARROW);
    super.checkParams(node, false, true);
    this.scope.exit();
  }

  forwardNoArrowParamsConversionAt(node, parse) {
    let result;

    if (this.state.noArrowParamsConversionAt.indexOf(node.start) !== -1) {
      this.state.noArrowParamsConversionAt.push(this.state.start);
      result = parse();
      this.state.noArrowParamsConversionAt.pop();
    } else {
      result = parse();
    }

    return result;
  }

  parseParenItem(node, startPos, startLoc) {
    node = super.parseParenItem(node, startPos, startLoc);

    if (this.eat(_types.types.question)) {
      node.optional = true;
      this.resetEndLocation(node);
    }

    if (this.match(_types.types.colon)) {
      const typeCastNode = this.startNodeAt(startPos, startLoc);
      typeCastNode.expression = node;
      typeCastNode.typeAnnotation = this.flowParseTypeAnnotation();
      return this.finishNode(typeCastNode, "TypeCastExpression");
    }

    return node;
  }

  assertModuleNodeAllowed(node) {
    if (node.type === "ImportDeclaration" && (node.importKind === "type" || node.importKind === "typeof") || node.type === "ExportNamedDeclaration" && node.exportKind === "type" || node.type === "ExportAllDeclaration" && node.exportKind === "type") {
      return;
    }

    super.assertModuleNodeAllowed(node);
  }

  parseExport(node) {
    const decl = super.parseExport(node);

    if (decl.type === "ExportNamedDeclaration" || decl.type === "ExportAllDeclaration") {
      decl.exportKind = decl.exportKind || "value";
    }

    return decl;
  }

  parseExportDeclaration(node) {
    if (this.isContextual("type")) {
      node.exportKind = "type";
      const declarationNode = this.startNode();
      this.next();

      if (this.match(_types.types.braceL)) {
        node.specifiers = this.parseExportSpecifiers();
        this.parseExportFrom(node);
        return null;
      } else {
        return this.flowParseTypeAlias(declarationNode);
      }
    } else if (this.isContextual("opaque")) {
      node.exportKind = "type";
      const declarationNode = this.startNode();
      this.next();
      return this.flowParseOpaqueType(declarationNode, false);
    } else if (this.isContextual("interface")) {
      node.exportKind = "type";
      const declarationNode = this.startNode();
      this.next();
      return this.flowParseInterface(declarationNode);
    } else if (this.shouldParseEnums() && this.isContextual("enum")) {
      node.exportKind = "value";
      const declarationNode = this.startNode();
      this.next();
      return this.flowParseEnumDeclaration(declarationNode);
    } else {
      return super.parseExportDeclaration(node);
    }
  }

  eatExportStar(node) {
    if (super.eatExportStar(...arguments)) return true;

    if (this.isContextual("type") && this.lookahead().type === _types.types.star) {
      node.exportKind = "type";
      this.next();
      this.next();
      return true;
    }

    return false;
  }

  maybeParseExportNamespaceSpecifier(node) {
    const pos = this.state.start;
    const hasNamespace = super.maybeParseExportNamespaceSpecifier(node);

    if (hasNamespace && node.exportKind === "type") {
      this.unexpected(pos);
    }

    return hasNamespace;
  }

  parseClassId(node, isStatement, optionalId) {
    super.parseClassId(node, isStatement, optionalId);

    if (this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterDeclaration();
    }
  }

  getTokenFromCode(code) {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (code === 123 && next === 124) {
      return this.finishOp(_types.types.braceBarL, 2);
    } else if (this.state.inType && (code === 62 || code === 60)) {
      return this.finishOp(_types.types.relational, 1);
    } else if ((0, _identifier.isIteratorStart)(code, next)) {
      this.state.isIterator = true;
      return super.readWord();
    } else {
      return super.getTokenFromCode(code);
    }
  }

  isAssignable(node, isBinding) {
    switch (node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
        return true;

      case "ObjectExpression":
        {
          const last = node.properties.length - 1;
          return node.properties.every((prop, i) => {
            return prop.type !== "ObjectMethod" && (i === last || prop.type === "SpreadElement") && this.isAssignable(prop);
          });
        }

      case "ObjectProperty":
        return this.isAssignable(node.value);

      case "SpreadElement":
        return this.isAssignable(node.argument);

      case "ArrayExpression":
        return node.elements.every(element => this.isAssignable(element));

      case "AssignmentExpression":
        return node.operator === "=";

      case "ParenthesizedExpression":
      case "TypeCastExpression":
        return this.isAssignable(node.expression);

      case "MemberExpression":
      case "OptionalMemberExpression":
        return !isBinding;

      default:
        return false;
    }
  }

  toAssignable(node) {
    if (node.type === "TypeCastExpression") {
      return super.toAssignable(this.typeCastToParameter(node));
    } else {
      return super.toAssignable(node);
    }
  }

  toAssignableList(exprList, trailingCommaPos) {
    for (let i = 0; i < exprList.length; i++) {
      const expr = exprList[i];

      if (expr && expr.type === "TypeCastExpression") {
        exprList[i] = this.typeCastToParameter(expr);
      }
    }

    return super.toAssignableList(exprList, trailingCommaPos);
  }

  toReferencedList(exprList, isParenthesizedExpr) {
    for (let i = 0; i < exprList.length; i++) {
      const expr = exprList[i];

      if (expr && expr.type === "TypeCastExpression" && (!expr.extra || !expr.extra.parenthesized) && (exprList.length > 1 || !isParenthesizedExpr)) {
        this.raise(expr.typeAnnotation.start, FlowErrors.TypeCastInPattern);
      }
    }

    return exprList;
  }

  checkLVal(expr, bindingType = _scopeflags.BIND_NONE, checkClashes, contextDescription) {
    if (expr.type !== "TypeCastExpression") {
      return super.checkLVal(expr, bindingType, checkClashes, contextDescription);
    }
  }

  parseClassProperty(node) {
    if (this.match(_types.types.colon)) {
      node.typeAnnotation = this.flowParseTypeAnnotation();
    }

    return super.parseClassProperty(node);
  }

  parseClassPrivateProperty(node) {
    if (this.match(_types.types.colon)) {
      node.typeAnnotation = this.flowParseTypeAnnotation();
    }

    return super.parseClassPrivateProperty(node);
  }

  isClassMethod() {
    return this.isRelational("<") || super.isClassMethod();
  }

  isClassProperty() {
    return this.match(_types.types.colon) || super.isClassProperty();
  }

  isNonstaticConstructor(method) {
    return !this.match(_types.types.colon) && super.isNonstaticConstructor(method);
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper) {
    if (method.variance) {
      this.unexpected(method.variance.start);
    }

    delete method.variance;

    if (this.isRelational("<")) {
      method.typeParameters = this.flowParseTypeParameterDeclaration();
    }

    super.pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper);
  }

  pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
    if (method.variance) {
      this.unexpected(method.variance.start);
    }

    delete method.variance;

    if (this.isRelational("<")) {
      method.typeParameters = this.flowParseTypeParameterDeclaration();
    }

    super.pushClassPrivateMethod(classBody, method, isGenerator, isAsync);
  }

  parseClassSuper(node) {
    super.parseClassSuper(node);

    if (node.superClass && this.isRelational("<")) {
      node.superTypeParameters = this.flowParseTypeParameterInstantiation();
    }

    if (this.isContextual("implements")) {
      this.next();
      const implemented = node.implements = [];

      do {
        const node = this.startNode();
        node.id = this.flowParseRestrictedIdentifier(true);

        if (this.isRelational("<")) {
          node.typeParameters = this.flowParseTypeParameterInstantiation();
        } else {
          node.typeParameters = null;
        }

        implemented.push(this.finishNode(node, "ClassImplements"));
      } while (this.eat(_types.types.comma));
    }
  }

  parsePropertyName(node, isPrivateNameAllowed) {
    const variance = this.flowParseVariance();
    const key = super.parsePropertyName(node, isPrivateNameAllowed);
    node.variance = variance;
    return key;
  }

  parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refExpressionErrors, containsEsc) {
    if (prop.variance) {
      this.unexpected(prop.variance.start);
    }

    delete prop.variance;
    let typeParameters;

    if (this.isRelational("<")) {
      typeParameters = this.flowParseTypeParameterDeclaration();
      if (!this.match(_types.types.parenL)) this.unexpected();
    }

    super.parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refExpressionErrors, containsEsc);

    if (typeParameters) {
      (prop.value || prop).typeParameters = typeParameters;
    }
  }

  parseAssignableListItemTypes(param) {
    if (this.eat(_types.types.question)) {
      if (param.type !== "Identifier") {
        this.raise(param.start, FlowErrors.OptionalBindingPattern);
      }

      param.optional = true;
    }

    if (this.match(_types.types.colon)) {
      param.typeAnnotation = this.flowParseTypeAnnotation();
    }

    this.resetEndLocation(param);
    return param;
  }

  parseMaybeDefault(startPos, startLoc, left) {
    const node = super.parseMaybeDefault(startPos, startLoc, left);

    if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
      this.raise(node.typeAnnotation.start, FlowErrors.TypeBeforeInitializer);
    }

    return node;
  }

  shouldParseDefaultImport(node) {
    if (!hasTypeImportKind(node)) {
      return super.shouldParseDefaultImport(node);
    }

    return isMaybeDefaultImport(this.state);
  }

  parseImportSpecifierLocal(node, specifier, type, contextDescription) {
    specifier.local = hasTypeImportKind(node) ? this.flowParseRestrictedIdentifier(true, true) : this.parseIdentifier();
    this.checkLVal(specifier.local, _scopeflags.BIND_LEXICAL, undefined, contextDescription);
    node.specifiers.push(this.finishNode(specifier, type));
  }

  maybeParseDefaultImportSpecifier(node) {
    node.importKind = "value";
    let kind = null;

    if (this.match(_types.types._typeof)) {
      kind = "typeof";
    } else if (this.isContextual("type")) {
      kind = "type";
    }

    if (kind) {
      const lh = this.lookahead();

      if (kind === "type" && lh.type === _types.types.star) {
        this.unexpected(lh.start);
      }

      if (isMaybeDefaultImport(lh) || lh.type === _types.types.braceL || lh.type === _types.types.star) {
        this.next();
        node.importKind = kind;
      }
    }

    return super.maybeParseDefaultImportSpecifier(node);
  }

  parseImportSpecifier(node) {
    const specifier = this.startNode();
    const firstIdentLoc = this.state.start;
    const firstIdent = this.parseIdentifier(true);
    let specifierTypeKind = null;

    if (firstIdent.name === "type") {
      specifierTypeKind = "type";
    } else if (firstIdent.name === "typeof") {
      specifierTypeKind = "typeof";
    }

    let isBinding = false;

    if (this.isContextual("as") && !this.isLookaheadContextual("as")) {
      const as_ident = this.parseIdentifier(true);

      if (specifierTypeKind !== null && !this.match(_types.types.name) && !this.state.type.keyword) {
        specifier.imported = as_ident;
        specifier.importKind = specifierTypeKind;
        specifier.local = as_ident.__clone();
      } else {
        specifier.imported = firstIdent;
        specifier.importKind = null;
        specifier.local = this.parseIdentifier();
      }
    } else if (specifierTypeKind !== null && (this.match(_types.types.name) || this.state.type.keyword)) {
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

    const nodeIsTypeImport = hasTypeImportKind(node);
    const specifierIsTypeImport = hasTypeImportKind(specifier);

    if (nodeIsTypeImport && specifierIsTypeImport) {
      this.raise(firstIdentLoc, FlowErrors.ImportTypeShorthandOnlyInPureImport);
    }

    if (nodeIsTypeImport || specifierIsTypeImport) {
      this.checkReservedType(specifier.local.name, specifier.local.start, true);
    }

    if (isBinding && !nodeIsTypeImport && !specifierIsTypeImport) {
      this.checkReservedWord(specifier.local.name, specifier.start, true, true);
    }

    this.checkLVal(specifier.local, _scopeflags.BIND_LEXICAL, undefined, "import specifier");
    node.specifiers.push(this.finishNode(specifier, "ImportSpecifier"));
  }

  parseFunctionParams(node, allowModifiers) {
    const kind = node.kind;

    if (kind !== "get" && kind !== "set" && this.isRelational("<")) {
      node.typeParameters = this.flowParseTypeParameterDeclaration();
    }

    super.parseFunctionParams(node, allowModifiers);
  }

  parseVarId(decl, kind) {
    super.parseVarId(decl, kind);

    if (this.match(_types.types.colon)) {
      decl.id.typeAnnotation = this.flowParseTypeAnnotation();
      this.resetEndLocation(decl.id);
    }
  }

  parseAsyncArrowFromCallExpression(node, call) {
    if (this.match(_types.types.colon)) {
      const oldNoAnonFunctionType = this.state.noAnonFunctionType;
      this.state.noAnonFunctionType = true;
      node.returnType = this.flowParseTypeAnnotation();
      this.state.noAnonFunctionType = oldNoAnonFunctionType;
    }

    return super.parseAsyncArrowFromCallExpression(node, call);
  }

  shouldParseAsyncArrow() {
    return this.match(_types.types.colon) || super.shouldParseAsyncArrow();
  }

  parseMaybeAssign(noIn, refExpressionErrors, afterLeftParse, refNeedsArrowPos) {
    let state = null;
    let jsx;

    if (this.hasPlugin("jsx") && (this.match(_types.types.jsxTagStart) || this.isRelational("<"))) {
      state = this.state.clone();
      jsx = this.tryParse(() => super.parseMaybeAssign(noIn, refExpressionErrors, afterLeftParse, refNeedsArrowPos), state);
      if (!jsx.error) return jsx.node;
      const {
        context
      } = this.state;

      if (context[context.length - 1] === _context.types.j_oTag) {
        context.length -= 2;
      } else if (context[context.length - 1] === _context.types.j_expr) {
        context.length -= 1;
      }
    }

    if (jsx && jsx.error || this.isRelational("<")) {
      state = state || this.state.clone();
      let typeParameters;
      const arrow = this.tryParse(() => {
        typeParameters = this.flowParseTypeParameterDeclaration();
        const arrowExpression = this.forwardNoArrowParamsConversionAt(typeParameters, () => super.parseMaybeAssign(noIn, refExpressionErrors, afterLeftParse, refNeedsArrowPos));
        arrowExpression.typeParameters = typeParameters;
        this.resetStartLocationFromNode(arrowExpression, typeParameters);
        return arrowExpression;
      }, state);
      const arrowExpression = arrow.node && arrow.node.type === "ArrowFunctionExpression" ? arrow.node : null;
      if (!arrow.error && arrowExpression) return arrowExpression;

      if (jsx && jsx.node) {
        this.state = jsx.failState;
        return jsx.node;
      }

      if (arrowExpression) {
        this.state = arrow.failState;
        return arrowExpression;
      }

      if (jsx && jsx.thrown) throw jsx.error;
      if (arrow.thrown) throw arrow.error;
      throw this.raise(typeParameters.start, FlowErrors.UnexpectedTokenAfterTypeParameter);
    }

    return super.parseMaybeAssign(noIn, refExpressionErrors, afterLeftParse, refNeedsArrowPos);
  }

  parseArrow(node) {
    if (this.match(_types.types.colon)) {
      const result = this.tryParse(() => {
        const oldNoAnonFunctionType = this.state.noAnonFunctionType;
        this.state.noAnonFunctionType = true;
        const typeNode = this.startNode();
        [typeNode.typeAnnotation, node.predicate] = this.flowParseTypeAndPredicateInitialiser();
        this.state.noAnonFunctionType = oldNoAnonFunctionType;
        if (this.canInsertSemicolon()) this.unexpected();
        if (!this.match(_types.types.arrow)) this.unexpected();
        return typeNode;
      });
      if (result.thrown) return null;
      if (result.error) this.state = result.failState;
      node.returnType = result.node.typeAnnotation ? this.finishNode(result.node, "TypeAnnotation") : null;
    }

    return super.parseArrow(node);
  }

  shouldParseArrow() {
    return this.match(_types.types.colon) || super.shouldParseArrow();
  }

  setArrowFunctionParameters(node, params) {
    if (this.state.noArrowParamsConversionAt.indexOf(node.start) !== -1) {
      node.params = params;
    } else {
      super.setArrowFunctionParameters(node, params);
    }
  }

  checkParams(node, allowDuplicates, isArrowFunction) {
    if (isArrowFunction && this.state.noArrowParamsConversionAt.indexOf(node.start) !== -1) {
      return;
    }

    return super.checkParams(...arguments);
  }

  parseParenAndDistinguishExpression(canBeArrow) {
    return super.parseParenAndDistinguishExpression(canBeArrow && this.state.noArrowAt.indexOf(this.state.start) === -1);
  }

  parseSubscripts(base, startPos, startLoc, noCalls) {
    if (base.type === "Identifier" && base.name === "async" && this.state.noArrowAt.indexOf(startPos) !== -1) {
      this.next();
      const node = this.startNodeAt(startPos, startLoc);
      node.callee = base;
      node.arguments = this.parseCallExpressionArguments(_types.types.parenR, false);
      base = this.finishNode(node, "CallExpression");
    } else if (base.type === "Identifier" && base.name === "async" && this.isRelational("<")) {
      const state = this.state.clone();
      const arrow = this.tryParse(abort => this.parseAsyncArrowWithTypeParameters(startPos, startLoc) || abort(), state);
      if (!arrow.error && !arrow.aborted) return arrow.node;
      const result = this.tryParse(() => super.parseSubscripts(base, startPos, startLoc, noCalls), state);
      if (result.node && !result.error) return result.node;

      if (arrow.node) {
        this.state = arrow.failState;
        return arrow.node;
      }

      if (result.node) {
        this.state = result.failState;
        return result.node;
      }

      throw arrow.error || result.error;
    }

    return super.parseSubscripts(base, startPos, startLoc, noCalls);
  }

  parseSubscript(base, startPos, startLoc, noCalls, subscriptState) {
    if (this.match(_types.types.questionDot) && this.isLookaheadRelational("<")) {
      subscriptState.optionalChainMember = true;

      if (noCalls) {
        subscriptState.stop = true;
        return base;
      }

      this.next();
      const node = this.startNodeAt(startPos, startLoc);
      node.callee = base;
      node.typeArguments = this.flowParseTypeParameterInstantiation();
      this.expect(_types.types.parenL);
      node.arguments = this.parseCallExpressionArguments(_types.types.parenR, false);
      node.optional = true;
      return this.finishCallExpression(node, true);
    } else if (!noCalls && this.shouldParseTypes() && this.isRelational("<")) {
      const node = this.startNodeAt(startPos, startLoc);
      node.callee = base;
      const result = this.tryParse(() => {
        node.typeArguments = this.flowParseTypeParameterInstantiationCallOrNew();
        this.expect(_types.types.parenL);
        node.arguments = this.parseCallExpressionArguments(_types.types.parenR, false);
        if (subscriptState.optionalChainMember) node.optional = false;
        return this.finishCallExpression(node, subscriptState.optionalChainMember);
      });

      if (result.node) {
        if (result.error) this.state = result.failState;
        return result.node;
      }
    }

    return super.parseSubscript(base, startPos, startLoc, noCalls, subscriptState);
  }

  parseNewArguments(node) {
    let targs = null;

    if (this.shouldParseTypes() && this.isRelational("<")) {
      targs = this.tryParse(() => this.flowParseTypeParameterInstantiationCallOrNew()).node;
    }

    node.typeArguments = targs;
    super.parseNewArguments(node);
  }

  parseAsyncArrowWithTypeParameters(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);
    this.parseFunctionParams(node);
    if (!this.parseArrow(node)) return;
    return this.parseArrowExpression(node, undefined, true);
  }

  readToken_mult_modulo(code) {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (code === 42 && next === 47 && this.state.hasFlowComment) {
      this.state.hasFlowComment = false;
      this.state.pos += 2;
      this.nextToken();
      return;
    }

    super.readToken_mult_modulo(code);
  }

  readToken_pipe_amp(code) {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (code === 124 && next === 125) {
      this.finishOp(_types.types.braceBarR, 2);
      return;
    }

    super.readToken_pipe_amp(code);
  }

  parseTopLevel(file, program) {
    const fileNode = super.parseTopLevel(file, program);

    if (this.state.hasFlowComment) {
      this.raise(this.state.pos, FlowErrors.UnterminatedFlowComment);
    }

    return fileNode;
  }

  skipBlockComment() {
    if (this.hasPlugin("flowComments") && this.skipFlowComment()) {
      if (this.state.hasFlowComment) {
        this.unexpected(null, FlowErrors.NestedFlowComment);
      }

      this.hasFlowCommentCompletion();
      this.state.pos += this.skipFlowComment();
      this.state.hasFlowComment = true;
      return;
    }

    if (this.state.hasFlowComment) {
      const end = this.input.indexOf("*-/", this.state.pos += 2);

      if (end === -1) {
        throw this.raise(this.state.pos - 2, _location.Errors.UnterminatedComment);
      }

      this.state.pos = end + 3;
      return;
    }

    super.skipBlockComment();
  }

  skipFlowComment() {
    const {
      pos
    } = this.state;
    let shiftToFirstNonWhiteSpace = 2;

    while ([32, 9].includes(this.input.charCodeAt(pos + shiftToFirstNonWhiteSpace))) {
      shiftToFirstNonWhiteSpace++;
    }

    const ch2 = this.input.charCodeAt(shiftToFirstNonWhiteSpace + pos);
    const ch3 = this.input.charCodeAt(shiftToFirstNonWhiteSpace + pos + 1);

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
  }

  hasFlowCommentCompletion() {
    const end = this.input.indexOf("*/", this.state.pos);

    if (end === -1) {
      throw this.raise(this.state.pos, _location.Errors.UnterminatedComment);
    }
  }

  flowEnumErrorBooleanMemberNotInitialized(pos, {
    enumName,
    memberName
  }) {
    this.raise(pos, FlowErrors.EnumBooleanMemberNotInitialized, memberName, enumName);
  }

  flowEnumErrorInvalidMemberName(pos, {
    enumName,
    memberName
  }) {
    const suggestion = memberName[0].toUpperCase() + memberName.slice(1);
    this.raise(pos, FlowErrors.EnumInvalidMemberName, memberName, suggestion, enumName);
  }

  flowEnumErrorDuplicateMemberName(pos, {
    enumName,
    memberName
  }) {
    this.raise(pos, FlowErrors.EnumDuplicateMemberName, memberName, enumName);
  }

  flowEnumErrorInconsistentMemberValues(pos, {
    enumName
  }) {
    this.raise(pos, FlowErrors.EnumInconsistentMemberValues, enumName);
  }

  flowEnumErrorInvalidExplicitType(pos, {
    enumName,
    suppliedType
  }) {
    return this.raise(pos, suppliedType === null ? FlowErrors.EnumInvalidExplicitTypeUnknownSupplied : FlowErrors.EnumInvalidExplicitType, enumName, suppliedType);
  }

  flowEnumErrorInvalidMemberInitializer(pos, {
    enumName,
    explicitType,
    memberName
  }) {
    let message = null;

    switch (explicitType) {
      case "boolean":
      case "number":
      case "string":
        message = FlowErrors.EnumInvalidMemberInitializerPrimaryType;
        break;

      case "symbol":
        message = FlowErrors.EnumInvalidMemberInitializerSymbolType;
        break;

      default:
        message = FlowErrors.EnumInvalidMemberInitializerUnknownType;
    }

    return this.raise(pos, message, enumName, memberName, explicitType);
  }

  flowEnumErrorNumberMemberNotInitialized(pos, {
    enumName,
    memberName
  }) {
    this.raise(pos, FlowErrors.EnumNumberMemberNotInitialized, enumName, memberName);
  }

  flowEnumErrorStringMemberInconsistentlyInitailized(pos, {
    enumName
  }) {
    this.raise(pos, FlowErrors.EnumStringMemberInconsistentlyInitailized, enumName);
  }

  flowEnumMemberInit() {
    const startPos = this.state.start;

    const endOfInit = () => this.match(_types.types.comma) || this.match(_types.types.braceR);

    switch (this.state.type) {
      case _types.types.num:
        {
          const literal = this.parseLiteral(this.state.value, "NumericLiteral");

          if (endOfInit()) {
            return {
              type: "number",
              pos: literal.start,
              value: literal
            };
          }

          return {
            type: "invalid",
            pos: startPos
          };
        }

      case _types.types.string:
        {
          const literal = this.parseLiteral(this.state.value, "StringLiteral");

          if (endOfInit()) {
            return {
              type: "string",
              pos: literal.start,
              value: literal
            };
          }

          return {
            type: "invalid",
            pos: startPos
          };
        }

      case _types.types._true:
      case _types.types._false:
        {
          const literal = this.parseBooleanLiteral();

          if (endOfInit()) {
            return {
              type: "boolean",
              pos: literal.start,
              value: literal
            };
          }

          return {
            type: "invalid",
            pos: startPos
          };
        }

      default:
        return {
          type: "invalid",
          pos: startPos
        };
    }
  }

  flowEnumMemberRaw() {
    const pos = this.state.start;
    const id = this.parseIdentifier(true);
    const init = this.eat(_types.types.eq) ? this.flowEnumMemberInit() : {
      type: "none",
      pos
    };
    return {
      id,
      init
    };
  }

  flowEnumCheckExplicitTypeMismatch(pos, context, expectedType) {
    const {
      explicitType
    } = context;

    if (explicitType === null) {
      return;
    }

    if (explicitType !== expectedType) {
      this.flowEnumErrorInvalidMemberInitializer(pos, context);
    }
  }

  flowEnumMembers({
    enumName,
    explicitType
  }) {
    const seenNames = new Set();
    const members = {
      booleanMembers: [],
      numberMembers: [],
      stringMembers: [],
      defaultedMembers: []
    };

    while (!this.match(_types.types.braceR)) {
      const memberNode = this.startNode();
      const {
        id,
        init
      } = this.flowEnumMemberRaw();
      const memberName = id.name;

      if (memberName === "") {
        continue;
      }

      if (/^[a-z]/.test(memberName)) {
        this.flowEnumErrorInvalidMemberName(id.start, {
          enumName,
          memberName
        });
      }

      if (seenNames.has(memberName)) {
        this.flowEnumErrorDuplicateMemberName(id.start, {
          enumName,
          memberName
        });
      }

      seenNames.add(memberName);
      const context = {
        enumName,
        explicitType,
        memberName
      };
      memberNode.id = id;

      switch (init.type) {
        case "boolean":
          {
            this.flowEnumCheckExplicitTypeMismatch(init.pos, context, "boolean");
            memberNode.init = init.value;
            members.booleanMembers.push(this.finishNode(memberNode, "EnumBooleanMember"));
            break;
          }

        case "number":
          {
            this.flowEnumCheckExplicitTypeMismatch(init.pos, context, "number");
            memberNode.init = init.value;
            members.numberMembers.push(this.finishNode(memberNode, "EnumNumberMember"));
            break;
          }

        case "string":
          {
            this.flowEnumCheckExplicitTypeMismatch(init.pos, context, "string");
            memberNode.init = init.value;
            members.stringMembers.push(this.finishNode(memberNode, "EnumStringMember"));
            break;
          }

        case "invalid":
          {
            throw this.flowEnumErrorInvalidMemberInitializer(init.pos, context);
          }

        case "none":
          {
            switch (explicitType) {
              case "boolean":
                this.flowEnumErrorBooleanMemberNotInitialized(init.pos, context);
                break;

              case "number":
                this.flowEnumErrorNumberMemberNotInitialized(init.pos, context);
                break;

              default:
                members.defaultedMembers.push(this.finishNode(memberNode, "EnumDefaultedMember"));
            }
          }
      }

      if (!this.match(_types.types.braceR)) {
        this.expect(_types.types.comma);
      }
    }

    return members;
  }

  flowEnumStringMembers(initializedMembers, defaultedMembers, {
    enumName
  }) {
    if (initializedMembers.length === 0) {
      return defaultedMembers;
    } else if (defaultedMembers.length === 0) {
      return initializedMembers;
    } else if (defaultedMembers.length > initializedMembers.length) {
      for (let _i = 0; _i < initializedMembers.length; _i++) {
        const member = initializedMembers[_i];
        this.flowEnumErrorStringMemberInconsistentlyInitailized(member.start, {
          enumName
        });
      }

      return defaultedMembers;
    } else {
      for (let _i2 = 0; _i2 < defaultedMembers.length; _i2++) {
        const member = defaultedMembers[_i2];
        this.flowEnumErrorStringMemberInconsistentlyInitailized(member.start, {
          enumName
        });
      }

      return initializedMembers;
    }
  }

  flowEnumParseExplicitType({
    enumName
  }) {
    if (this.eatContextual("of")) {
      if (!this.match(_types.types.name)) {
        throw this.flowEnumErrorInvalidExplicitType(this.state.start, {
          enumName,
          suppliedType: null
        });
      }

      const {
        value
      } = this.state;
      this.next();

      if (value !== "boolean" && value !== "number" && value !== "string" && value !== "symbol") {
        this.flowEnumErrorInvalidExplicitType(this.state.start, {
          enumName,
          suppliedType: value
        });
      }

      return value;
    }

    return null;
  }

  flowEnumBody(node, {
    enumName,
    nameLoc
  }) {
    const explicitType = this.flowEnumParseExplicitType({
      enumName
    });
    this.expect(_types.types.braceL);
    const members = this.flowEnumMembers({
      enumName,
      explicitType
    });

    switch (explicitType) {
      case "boolean":
        node.explicitType = true;
        node.members = members.booleanMembers;
        this.expect(_types.types.braceR);
        return this.finishNode(node, "EnumBooleanBody");

      case "number":
        node.explicitType = true;
        node.members = members.numberMembers;
        this.expect(_types.types.braceR);
        return this.finishNode(node, "EnumNumberBody");

      case "string":
        node.explicitType = true;
        node.members = this.flowEnumStringMembers(members.stringMembers, members.defaultedMembers, {
          enumName
        });
        this.expect(_types.types.braceR);
        return this.finishNode(node, "EnumStringBody");

      case "symbol":
        node.members = members.defaultedMembers;
        this.expect(_types.types.braceR);
        return this.finishNode(node, "EnumSymbolBody");

      default:
        {
          const empty = () => {
            node.members = [];
            this.expect(_types.types.braceR);
            return this.finishNode(node, "EnumStringBody");
          };

          node.explicitType = false;
          const boolsLen = members.booleanMembers.length;
          const numsLen = members.numberMembers.length;
          const strsLen = members.stringMembers.length;
          const defaultedLen = members.defaultedMembers.length;

          if (!boolsLen && !numsLen && !strsLen && !defaultedLen) {
            return empty();
          } else if (!boolsLen && !numsLen) {
            node.members = this.flowEnumStringMembers(members.stringMembers, members.defaultedMembers, {
              enumName
            });
            this.expect(_types.types.braceR);
            return this.finishNode(node, "EnumStringBody");
          } else if (!numsLen && !strsLen && boolsLen >= defaultedLen) {
            for (let _i3 = 0, _members$defaultedMem = members.defaultedMembers; _i3 < _members$defaultedMem.length; _i3++) {
              const member = _members$defaultedMem[_i3];
              this.flowEnumErrorBooleanMemberNotInitialized(member.start, {
                enumName,
                memberName: member.id.name
              });
            }

            node.members = members.booleanMembers;
            this.expect(_types.types.braceR);
            return this.finishNode(node, "EnumBooleanBody");
          } else if (!boolsLen && !strsLen && numsLen >= defaultedLen) {
            for (let _i4 = 0, _members$defaultedMem2 = members.defaultedMembers; _i4 < _members$defaultedMem2.length; _i4++) {
              const member = _members$defaultedMem2[_i4];
              this.flowEnumErrorNumberMemberNotInitialized(member.start, {
                enumName,
                memberName: member.id.name
              });
            }

            node.members = members.numberMembers;
            this.expect(_types.types.braceR);
            return this.finishNode(node, "EnumNumberBody");
          } else {
            this.flowEnumErrorInconsistentMemberValues(nameLoc, {
              enumName
            });
            return empty();
          }
        }
    }
  }

  flowParseEnumDeclaration(node) {
    const id = this.parseIdentifier();
    node.id = id;
    node.body = this.flowEnumBody(this.startNode(), {
      enumName: id.name,
      nameLoc: id.start
    });
    return this.finishNode(node, "EnumDeclaration");
  }

};

exports.default = _default;