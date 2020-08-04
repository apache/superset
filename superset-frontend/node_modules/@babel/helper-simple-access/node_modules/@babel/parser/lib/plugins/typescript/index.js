"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../../tokenizer/types");

var _context = require("../../tokenizer/context");

var N = _interopRequireWildcard(require("../../types"));

var _scopeflags = require("../../util/scopeflags");

var _scope = _interopRequireDefault(require("./scope"));

var _productionParameter = require("../../util/production-parameter");

var _location = require("../../parser/location");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function nonNull(x) {
  if (x == null) {
    throw new Error(`Unexpected ${x} value.`);
  }

  return x;
}

function assert(x) {
  if (!x) {
    throw new Error("Assert fail");
  }
}

const TSErrors = Object.freeze({
  ClassMethodHasDeclare: "Class methods cannot have the 'declare' modifier",
  ClassMethodHasReadonly: "Class methods cannot have the 'readonly' modifier",
  DeclareClassFieldHasInitializer: "'declare' class fields cannot have an initializer",
  DuplicateModifier: "Duplicate modifier: '%0'",
  EmptyHeritageClauseType: "'%0' list cannot be empty.",
  IndexSignatureHasAbstract: "Index signatures cannot have the 'abstract' modifier",
  IndexSignatureHasAccessibility: "Index signatures cannot have an accessibility modifier ('%0')",
  IndexSignatureHasStatic: "Index signatures cannot have the 'static' modifier",
  OptionalTypeBeforeRequired: "A required element cannot follow an optional element.",
  PatternIsOptional: "A binding pattern parameter cannot be optional in an implementation signature.",
  PrivateElementHasAbstract: "Private elements cannot have the 'abstract' modifier.",
  PrivateElementHasAccessibility: "Private elements cannot have an accessibility modifier ('%0')",
  TemplateTypeHasSubstitution: "Template literal types cannot have any substitution",
  TypeAnnotationAfterAssign: "Type annotations must come before default assignments, e.g. instead of `age = 25: number` use `age: number = 25`",
  UnexpectedReadonly: "'readonly' type modifier is only permitted on array and tuple literal types.",
  UnexpectedTypeAnnotation: "Did not expect a type annotation here.",
  UnexpectedTypeCastInParameter: "Unexpected type cast in parameter position.",
  UnsupportedImportTypeArgument: "Argument in a type import must be a string literal",
  UnsupportedParameterPropertyKind: "A parameter property may not be declared using a binding pattern.",
  UnsupportedSignatureParameterKind: "Name in a signature must be an Identifier, ObjectPattern or ArrayPattern, instead got %0"
});

function keywordTypeFromName(value) {
  switch (value) {
    case "any":
      return "TSAnyKeyword";

    case "boolean":
      return "TSBooleanKeyword";

    case "bigint":
      return "TSBigIntKeyword";

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

var _default = superClass => class extends superClass {
  getScopeHandler() {
    return _scope.default;
  }

  tsIsIdentifier() {
    return this.match(_types.types.name);
  }

  tsNextTokenCanFollowModifier() {
    this.next();
    return !this.hasPrecedingLineBreak() && !this.match(_types.types.parenL) && !this.match(_types.types.parenR) && !this.match(_types.types.colon) && !this.match(_types.types.eq) && !this.match(_types.types.question) && !this.match(_types.types.bang);
  }

  tsParseModifier(allowedModifiers) {
    if (!this.match(_types.types.name)) {
      return undefined;
    }

    const modifier = this.state.value;

    if (allowedModifiers.indexOf(modifier) !== -1 && this.tsTryParse(this.tsNextTokenCanFollowModifier.bind(this))) {
      return modifier;
    }

    return undefined;
  }

  tsParseModifiers(modified, allowedModifiers) {
    for (;;) {
      const startPos = this.state.start;
      const modifier = this.tsParseModifier(allowedModifiers);
      if (!modifier) break;

      if (Object.hasOwnProperty.call(modified, modifier)) {
        this.raise(startPos, TSErrors.DuplicateModifier, modifier);
      }

      modified[modifier] = true;
    }
  }

  tsIsListTerminator(kind) {
    switch (kind) {
      case "EnumMembers":
      case "TypeMembers":
        return this.match(_types.types.braceR);

      case "HeritageClauseElement":
        return this.match(_types.types.braceL);

      case "TupleElementTypes":
        return this.match(_types.types.bracketR);

      case "TypeParametersOrArguments":
        return this.isRelational(">");
    }

    throw new Error("Unreachable");
  }

  tsParseList(kind, parseElement) {
    const result = [];

    while (!this.tsIsListTerminator(kind)) {
      result.push(parseElement());
    }

    return result;
  }

  tsParseDelimitedList(kind, parseElement) {
    return nonNull(this.tsParseDelimitedListWorker(kind, parseElement, true));
  }

  tsParseDelimitedListWorker(kind, parseElement, expectSuccess) {
    const result = [];

    for (;;) {
      if (this.tsIsListTerminator(kind)) {
        break;
      }

      const element = parseElement();

      if (element == null) {
        return undefined;
      }

      result.push(element);

      if (this.eat(_types.types.comma)) {
        continue;
      }

      if (this.tsIsListTerminator(kind)) {
        break;
      }

      if (expectSuccess) {
        this.expect(_types.types.comma);
      }

      return undefined;
    }

    return result;
  }

  tsParseBracketedList(kind, parseElement, bracket, skipFirstToken) {
    if (!skipFirstToken) {
      if (bracket) {
        this.expect(_types.types.bracketL);
      } else {
        this.expectRelational("<");
      }
    }

    const result = this.tsParseDelimitedList(kind, parseElement);

    if (bracket) {
      this.expect(_types.types.bracketR);
    } else {
      this.expectRelational(">");
    }

    return result;
  }

  tsParseImportType() {
    const node = this.startNode();
    this.expect(_types.types._import);
    this.expect(_types.types.parenL);

    if (!this.match(_types.types.string)) {
      this.raise(this.state.start, TSErrors.UnsupportedImportTypeArgument);
    }

    node.argument = this.parseExprAtom();
    this.expect(_types.types.parenR);

    if (this.eat(_types.types.dot)) {
      node.qualifier = this.tsParseEntityName(true);
    }

    if (this.isRelational("<")) {
      node.typeParameters = this.tsParseTypeArguments();
    }

    return this.finishNode(node, "TSImportType");
  }

  tsParseEntityName(allowReservedWords) {
    let entity = this.parseIdentifier();

    while (this.eat(_types.types.dot)) {
      const node = this.startNodeAtNode(entity);
      node.left = entity;
      node.right = this.parseIdentifier(allowReservedWords);
      entity = this.finishNode(node, "TSQualifiedName");
    }

    return entity;
  }

  tsParseTypeReference() {
    const node = this.startNode();
    node.typeName = this.tsParseEntityName(false);

    if (!this.hasPrecedingLineBreak() && this.isRelational("<")) {
      node.typeParameters = this.tsParseTypeArguments();
    }

    return this.finishNode(node, "TSTypeReference");
  }

  tsParseThisTypePredicate(lhs) {
    this.next();
    const node = this.startNodeAtNode(lhs);
    node.parameterName = lhs;
    node.typeAnnotation = this.tsParseTypeAnnotation(false);
    return this.finishNode(node, "TSTypePredicate");
  }

  tsParseThisTypeNode() {
    const node = this.startNode();
    this.next();
    return this.finishNode(node, "TSThisType");
  }

  tsParseTypeQuery() {
    const node = this.startNode();
    this.expect(_types.types._typeof);

    if (this.match(_types.types._import)) {
      node.exprName = this.tsParseImportType();
    } else {
      node.exprName = this.tsParseEntityName(true);
    }

    return this.finishNode(node, "TSTypeQuery");
  }

  tsParseTypeParameter() {
    const node = this.startNode();
    node.name = this.parseIdentifierName(node.start);
    node.constraint = this.tsEatThenParseType(_types.types._extends);
    node.default = this.tsEatThenParseType(_types.types.eq);
    return this.finishNode(node, "TSTypeParameter");
  }

  tsTryParseTypeParameters() {
    if (this.isRelational("<")) {
      return this.tsParseTypeParameters();
    }
  }

  tsParseTypeParameters() {
    const node = this.startNode();

    if (this.isRelational("<") || this.match(_types.types.jsxTagStart)) {
      this.next();
    } else {
      this.unexpected();
    }

    node.params = this.tsParseBracketedList("TypeParametersOrArguments", this.tsParseTypeParameter.bind(this), false, true);
    return this.finishNode(node, "TSTypeParameterDeclaration");
  }

  tsTryNextParseConstantContext() {
    if (this.lookahead().type === _types.types._const) {
      this.next();
      return this.tsParseTypeReference();
    }

    return null;
  }

  tsFillSignature(returnToken, signature) {
    const returnTokenRequired = returnToken === _types.types.arrow;
    signature.typeParameters = this.tsTryParseTypeParameters();
    this.expect(_types.types.parenL);
    signature.parameters = this.tsParseBindingListForSignature();

    if (returnTokenRequired) {
      signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
    } else if (this.match(returnToken)) {
      signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
    }
  }

  tsParseBindingListForSignature() {
    return this.parseBindingList(_types.types.parenR, 41).map(pattern => {
      if (pattern.type !== "Identifier" && pattern.type !== "RestElement" && pattern.type !== "ObjectPattern" && pattern.type !== "ArrayPattern") {
        this.raise(pattern.start, TSErrors.UnsupportedSignatureParameterKind, pattern.type);
      }

      return pattern;
    });
  }

  tsParseTypeMemberSemicolon() {
    if (!this.eat(_types.types.comma)) {
      this.semicolon();
    }
  }

  tsParseSignatureMember(kind, node) {
    this.tsFillSignature(_types.types.colon, node);
    this.tsParseTypeMemberSemicolon();
    return this.finishNode(node, kind);
  }

  tsIsUnambiguouslyIndexSignature() {
    this.next();
    return this.eat(_types.types.name) && this.match(_types.types.colon);
  }

  tsTryParseIndexSignature(node) {
    if (!(this.match(_types.types.bracketL) && this.tsLookAhead(this.tsIsUnambiguouslyIndexSignature.bind(this)))) {
      return undefined;
    }

    this.expect(_types.types.bracketL);
    const id = this.parseIdentifier();
    id.typeAnnotation = this.tsParseTypeAnnotation();
    this.resetEndLocation(id);
    this.expect(_types.types.bracketR);
    node.parameters = [id];
    const type = this.tsTryParseTypeAnnotation();
    if (type) node.typeAnnotation = type;
    this.tsParseTypeMemberSemicolon();
    return this.finishNode(node, "TSIndexSignature");
  }

  tsParsePropertyOrMethodSignature(node, readonly) {
    if (this.eat(_types.types.question)) node.optional = true;
    const nodeAny = node;

    if (!readonly && (this.match(_types.types.parenL) || this.isRelational("<"))) {
      const method = nodeAny;
      this.tsFillSignature(_types.types.colon, method);
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(method, "TSMethodSignature");
    } else {
      const property = nodeAny;
      if (readonly) property.readonly = true;
      const type = this.tsTryParseTypeAnnotation();
      if (type) property.typeAnnotation = type;
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(property, "TSPropertySignature");
    }
  }

  tsParseTypeMember() {
    const node = this.startNode();

    if (this.match(_types.types.parenL) || this.isRelational("<")) {
      return this.tsParseSignatureMember("TSCallSignatureDeclaration", node);
    }

    if (this.match(_types.types._new)) {
      const id = this.startNode();
      this.next();

      if (this.match(_types.types.parenL) || this.isRelational("<")) {
        return this.tsParseSignatureMember("TSConstructSignatureDeclaration", node);
      } else {
        node.key = this.createIdentifier(id, "new");
        return this.tsParsePropertyOrMethodSignature(node, false);
      }
    }

    const readonly = !!this.tsParseModifier(["readonly"]);
    const idx = this.tsTryParseIndexSignature(node);

    if (idx) {
      if (readonly) node.readonly = true;
      return idx;
    }

    this.parsePropertyName(node, false);
    return this.tsParsePropertyOrMethodSignature(node, readonly);
  }

  tsParseTypeLiteral() {
    const node = this.startNode();
    node.members = this.tsParseObjectTypeMembers();
    return this.finishNode(node, "TSTypeLiteral");
  }

  tsParseObjectTypeMembers() {
    this.expect(_types.types.braceL);
    const members = this.tsParseList("TypeMembers", this.tsParseTypeMember.bind(this));
    this.expect(_types.types.braceR);
    return members;
  }

  tsIsStartOfMappedType() {
    this.next();

    if (this.eat(_types.types.plusMin)) {
      return this.isContextual("readonly");
    }

    if (this.isContextual("readonly")) {
      this.next();
    }

    if (!this.match(_types.types.bracketL)) {
      return false;
    }

    this.next();

    if (!this.tsIsIdentifier()) {
      return false;
    }

    this.next();
    return this.match(_types.types._in);
  }

  tsParseMappedTypeParameter() {
    const node = this.startNode();
    node.name = this.parseIdentifierName(node.start);
    node.constraint = this.tsExpectThenParseType(_types.types._in);
    return this.finishNode(node, "TSTypeParameter");
  }

  tsParseMappedType() {
    const node = this.startNode();
    this.expect(_types.types.braceL);

    if (this.match(_types.types.plusMin)) {
      node.readonly = this.state.value;
      this.next();
      this.expectContextual("readonly");
    } else if (this.eatContextual("readonly")) {
      node.readonly = true;
    }

    this.expect(_types.types.bracketL);
    node.typeParameter = this.tsParseMappedTypeParameter();
    this.expect(_types.types.bracketR);

    if (this.match(_types.types.plusMin)) {
      node.optional = this.state.value;
      this.next();
      this.expect(_types.types.question);
    } else if (this.eat(_types.types.question)) {
      node.optional = true;
    }

    node.typeAnnotation = this.tsTryParseType();
    this.semicolon();
    this.expect(_types.types.braceR);
    return this.finishNode(node, "TSMappedType");
  }

  tsParseTupleType() {
    const node = this.startNode();
    node.elementTypes = this.tsParseBracketedList("TupleElementTypes", this.tsParseTupleElementType.bind(this), true, false);
    let seenOptionalElement = false;
    node.elementTypes.forEach(elementNode => {
      if (elementNode.type === "TSOptionalType") {
        seenOptionalElement = true;
      } else if (seenOptionalElement && elementNode.type !== "TSRestType") {
        this.raise(elementNode.start, TSErrors.OptionalTypeBeforeRequired);
      }
    });
    return this.finishNode(node, "TSTupleType");
  }

  tsParseTupleElementType() {
    if (this.match(_types.types.ellipsis)) {
      const restNode = this.startNode();
      this.next();
      restNode.typeAnnotation = this.tsParseType();

      if (this.match(_types.types.comma) && this.lookaheadCharCode() !== 93) {
        this.raiseRestNotLast(this.state.start);
      }

      return this.finishNode(restNode, "TSRestType");
    }

    const type = this.tsParseType();

    if (this.eat(_types.types.question)) {
      const optionalTypeNode = this.startNodeAtNode(type);
      optionalTypeNode.typeAnnotation = type;
      return this.finishNode(optionalTypeNode, "TSOptionalType");
    }

    return type;
  }

  tsParseParenthesizedType() {
    const node = this.startNode();
    this.expect(_types.types.parenL);
    node.typeAnnotation = this.tsParseType();
    this.expect(_types.types.parenR);
    return this.finishNode(node, "TSParenthesizedType");
  }

  tsParseFunctionOrConstructorType(type) {
    const node = this.startNode();

    if (type === "TSConstructorType") {
      this.expect(_types.types._new);
    }

    this.tsFillSignature(_types.types.arrow, node);
    return this.finishNode(node, type);
  }

  tsParseLiteralTypeNode() {
    const node = this.startNode();

    node.literal = (() => {
      switch (this.state.type) {
        case _types.types.num:
        case _types.types.string:
        case _types.types._true:
        case _types.types._false:
          return this.parseExprAtom();

        default:
          throw this.unexpected();
      }
    })();

    return this.finishNode(node, "TSLiteralType");
  }

  tsParseTemplateLiteralType() {
    const node = this.startNode();
    const templateNode = this.parseTemplate(false);

    if (templateNode.expressions.length > 0) {
      this.raise(templateNode.expressions[0].start, TSErrors.TemplateTypeHasSubstitution);
    }

    node.literal = templateNode;
    return this.finishNode(node, "TSLiteralType");
  }

  tsParseThisTypeOrThisTypePredicate() {
    const thisKeyword = this.tsParseThisTypeNode();

    if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
      return this.tsParseThisTypePredicate(thisKeyword);
    } else {
      return thisKeyword;
    }
  }

  tsParseNonArrayType() {
    switch (this.state.type) {
      case _types.types.name:
      case _types.types._void:
      case _types.types._null:
        {
          const type = this.match(_types.types._void) ? "TSVoidKeyword" : this.match(_types.types._null) ? "TSNullKeyword" : keywordTypeFromName(this.state.value);

          if (type !== undefined && this.lookaheadCharCode() !== 46) {
            const node = this.startNode();
            this.next();
            return this.finishNode(node, type);
          }

          return this.tsParseTypeReference();
        }

      case _types.types.string:
      case _types.types.num:
      case _types.types._true:
      case _types.types._false:
        return this.tsParseLiteralTypeNode();

      case _types.types.plusMin:
        if (this.state.value === "-") {
          const node = this.startNode();

          if (this.lookahead().type !== _types.types.num) {
            throw this.unexpected();
          }

          node.literal = this.parseMaybeUnary();
          return this.finishNode(node, "TSLiteralType");
        }

        break;

      case _types.types._this:
        return this.tsParseThisTypeOrThisTypePredicate();

      case _types.types._typeof:
        return this.tsParseTypeQuery();

      case _types.types._import:
        return this.tsParseImportType();

      case _types.types.braceL:
        return this.tsLookAhead(this.tsIsStartOfMappedType.bind(this)) ? this.tsParseMappedType() : this.tsParseTypeLiteral();

      case _types.types.bracketL:
        return this.tsParseTupleType();

      case _types.types.parenL:
        return this.tsParseParenthesizedType();

      case _types.types.backQuote:
        return this.tsParseTemplateLiteralType();
    }

    throw this.unexpected();
  }

  tsParseArrayTypeOrHigher() {
    let type = this.tsParseNonArrayType();

    while (!this.hasPrecedingLineBreak() && this.eat(_types.types.bracketL)) {
      if (this.match(_types.types.bracketR)) {
        const node = this.startNodeAtNode(type);
        node.elementType = type;
        this.expect(_types.types.bracketR);
        type = this.finishNode(node, "TSArrayType");
      } else {
        const node = this.startNodeAtNode(type);
        node.objectType = type;
        node.indexType = this.tsParseType();
        this.expect(_types.types.bracketR);
        type = this.finishNode(node, "TSIndexedAccessType");
      }
    }

    return type;
  }

  tsParseTypeOperator(operator) {
    const node = this.startNode();
    this.expectContextual(operator);
    node.operator = operator;
    node.typeAnnotation = this.tsParseTypeOperatorOrHigher();

    if (operator === "readonly") {
      this.tsCheckTypeAnnotationForReadOnly(node);
    }

    return this.finishNode(node, "TSTypeOperator");
  }

  tsCheckTypeAnnotationForReadOnly(node) {
    switch (node.typeAnnotation.type) {
      case "TSTupleType":
      case "TSArrayType":
        return;

      default:
        this.raise(node.start, TSErrors.UnexpectedReadonly);
    }
  }

  tsParseInferType() {
    const node = this.startNode();
    this.expectContextual("infer");
    const typeParameter = this.startNode();
    typeParameter.name = this.parseIdentifierName(typeParameter.start);
    node.typeParameter = this.finishNode(typeParameter, "TSTypeParameter");
    return this.finishNode(node, "TSInferType");
  }

  tsParseTypeOperatorOrHigher() {
    const operator = ["keyof", "unique", "readonly"].find(kw => this.isContextual(kw));
    return operator ? this.tsParseTypeOperator(operator) : this.isContextual("infer") ? this.tsParseInferType() : this.tsParseArrayTypeOrHigher();
  }

  tsParseUnionOrIntersectionType(kind, parseConstituentType, operator) {
    this.eat(operator);
    let type = parseConstituentType();

    if (this.match(operator)) {
      const types = [type];

      while (this.eat(operator)) {
        types.push(parseConstituentType());
      }

      const node = this.startNodeAtNode(type);
      node.types = types;
      type = this.finishNode(node, kind);
    }

    return type;
  }

  tsParseIntersectionTypeOrHigher() {
    return this.tsParseUnionOrIntersectionType("TSIntersectionType", this.tsParseTypeOperatorOrHigher.bind(this), _types.types.bitwiseAND);
  }

  tsParseUnionTypeOrHigher() {
    return this.tsParseUnionOrIntersectionType("TSUnionType", this.tsParseIntersectionTypeOrHigher.bind(this), _types.types.bitwiseOR);
  }

  tsIsStartOfFunctionType() {
    if (this.isRelational("<")) {
      return true;
    }

    return this.match(_types.types.parenL) && this.tsLookAhead(this.tsIsUnambiguouslyStartOfFunctionType.bind(this));
  }

  tsSkipParameterStart() {
    if (this.match(_types.types.name) || this.match(_types.types._this)) {
      this.next();
      return true;
    }

    if (this.match(_types.types.braceL)) {
      let braceStackCounter = 1;
      this.next();

      while (braceStackCounter > 0) {
        if (this.match(_types.types.braceL)) {
          ++braceStackCounter;
        } else if (this.match(_types.types.braceR)) {
          --braceStackCounter;
        }

        this.next();
      }

      return true;
    }

    if (this.match(_types.types.bracketL)) {
      let braceStackCounter = 1;
      this.next();

      while (braceStackCounter > 0) {
        if (this.match(_types.types.bracketL)) {
          ++braceStackCounter;
        } else if (this.match(_types.types.bracketR)) {
          --braceStackCounter;
        }

        this.next();
      }

      return true;
    }

    return false;
  }

  tsIsUnambiguouslyStartOfFunctionType() {
    this.next();

    if (this.match(_types.types.parenR) || this.match(_types.types.ellipsis)) {
      return true;
    }

    if (this.tsSkipParameterStart()) {
      if (this.match(_types.types.colon) || this.match(_types.types.comma) || this.match(_types.types.question) || this.match(_types.types.eq)) {
        return true;
      }

      if (this.match(_types.types.parenR)) {
        this.next();

        if (this.match(_types.types.arrow)) {
          return true;
        }
      }
    }

    return false;
  }

  tsParseTypeOrTypePredicateAnnotation(returnToken) {
    return this.tsInType(() => {
      const t = this.startNode();
      this.expect(returnToken);
      const asserts = this.tsTryParse(this.tsParseTypePredicateAsserts.bind(this));

      if (asserts && this.match(_types.types._this)) {
        let thisTypePredicate = this.tsParseThisTypeOrThisTypePredicate();

        if (thisTypePredicate.type === "TSThisType") {
          const node = this.startNodeAtNode(t);
          node.parameterName = thisTypePredicate;
          node.asserts = true;
          thisTypePredicate = this.finishNode(node, "TSTypePredicate");
        } else {
          thisTypePredicate.asserts = true;
        }

        t.typeAnnotation = thisTypePredicate;
        return this.finishNode(t, "TSTypeAnnotation");
      }

      const typePredicateVariable = this.tsIsIdentifier() && this.tsTryParse(this.tsParseTypePredicatePrefix.bind(this));

      if (!typePredicateVariable) {
        if (!asserts) {
          return this.tsParseTypeAnnotation(false, t);
        }

        const node = this.startNodeAtNode(t);
        node.parameterName = this.parseIdentifier();
        node.asserts = asserts;
        t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
        return this.finishNode(t, "TSTypeAnnotation");
      }

      const type = this.tsParseTypeAnnotation(false);
      const node = this.startNodeAtNode(t);
      node.parameterName = typePredicateVariable;
      node.typeAnnotation = type;
      node.asserts = asserts;
      t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
      return this.finishNode(t, "TSTypeAnnotation");
    });
  }

  tsTryParseTypeOrTypePredicateAnnotation() {
    return this.match(_types.types.colon) ? this.tsParseTypeOrTypePredicateAnnotation(_types.types.colon) : undefined;
  }

  tsTryParseTypeAnnotation() {
    return this.match(_types.types.colon) ? this.tsParseTypeAnnotation() : undefined;
  }

  tsTryParseType() {
    return this.tsEatThenParseType(_types.types.colon);
  }

  tsParseTypePredicatePrefix() {
    const id = this.parseIdentifier();

    if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
      this.next();
      return id;
    }
  }

  tsParseTypePredicateAsserts() {
    if (!this.match(_types.types.name) || this.state.value !== "asserts" || this.hasPrecedingLineBreak()) {
      return false;
    }

    const containsEsc = this.state.containsEsc;
    this.next();

    if (!this.match(_types.types.name) && !this.match(_types.types._this)) {
      return false;
    }

    if (containsEsc) {
      this.raise(this.state.lastTokStart, _location.Errors.InvalidEscapedReservedWord, "asserts");
    }

    return true;
  }

  tsParseTypeAnnotation(eatColon = true, t = this.startNode()) {
    this.tsInType(() => {
      if (eatColon) this.expect(_types.types.colon);
      t.typeAnnotation = this.tsParseType();
    });
    return this.finishNode(t, "TSTypeAnnotation");
  }

  tsParseType() {
    assert(this.state.inType);
    const type = this.tsParseNonConditionalType();

    if (this.hasPrecedingLineBreak() || !this.eat(_types.types._extends)) {
      return type;
    }

    const node = this.startNodeAtNode(type);
    node.checkType = type;
    node.extendsType = this.tsParseNonConditionalType();
    this.expect(_types.types.question);
    node.trueType = this.tsParseType();
    this.expect(_types.types.colon);
    node.falseType = this.tsParseType();
    return this.finishNode(node, "TSConditionalType");
  }

  tsParseNonConditionalType() {
    if (this.tsIsStartOfFunctionType()) {
      return this.tsParseFunctionOrConstructorType("TSFunctionType");
    }

    if (this.match(_types.types._new)) {
      return this.tsParseFunctionOrConstructorType("TSConstructorType");
    }

    return this.tsParseUnionTypeOrHigher();
  }

  tsParseTypeAssertion() {
    const node = this.startNode();

    const _const = this.tsTryNextParseConstantContext();

    node.typeAnnotation = _const || this.tsNextThenParseType();
    this.expectRelational(">");
    node.expression = this.parseMaybeUnary();
    return this.finishNode(node, "TSTypeAssertion");
  }

  tsParseHeritageClause(descriptor) {
    const originalStart = this.state.start;
    const delimitedList = this.tsParseDelimitedList("HeritageClauseElement", this.tsParseExpressionWithTypeArguments.bind(this));

    if (!delimitedList.length) {
      this.raise(originalStart, TSErrors.EmptyHeritageClauseType, descriptor);
    }

    return delimitedList;
  }

  tsParseExpressionWithTypeArguments() {
    const node = this.startNode();
    node.expression = this.tsParseEntityName(false);

    if (this.isRelational("<")) {
      node.typeParameters = this.tsParseTypeArguments();
    }

    return this.finishNode(node, "TSExpressionWithTypeArguments");
  }

  tsParseInterfaceDeclaration(node) {
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, _scopeflags.BIND_TS_INTERFACE, undefined, "typescript interface declaration");
    node.typeParameters = this.tsTryParseTypeParameters();

    if (this.eat(_types.types._extends)) {
      node.extends = this.tsParseHeritageClause("extends");
    }

    const body = this.startNode();
    body.body = this.tsInType(this.tsParseObjectTypeMembers.bind(this));
    node.body = this.finishNode(body, "TSInterfaceBody");
    return this.finishNode(node, "TSInterfaceDeclaration");
  }

  tsParseTypeAliasDeclaration(node) {
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, _scopeflags.BIND_TS_TYPE, undefined, "typescript type alias");
    node.typeParameters = this.tsTryParseTypeParameters();
    node.typeAnnotation = this.tsExpectThenParseType(_types.types.eq);
    this.semicolon();
    return this.finishNode(node, "TSTypeAliasDeclaration");
  }

  tsInNoContext(cb) {
    const oldContext = this.state.context;
    this.state.context = [oldContext[0]];

    try {
      return cb();
    } finally {
      this.state.context = oldContext;
    }
  }

  tsInType(cb) {
    const oldInType = this.state.inType;
    this.state.inType = true;

    try {
      return cb();
    } finally {
      this.state.inType = oldInType;
    }
  }

  tsEatThenParseType(token) {
    return !this.match(token) ? undefined : this.tsNextThenParseType();
  }

  tsExpectThenParseType(token) {
    return this.tsDoThenParseType(() => this.expect(token));
  }

  tsNextThenParseType() {
    return this.tsDoThenParseType(() => this.next());
  }

  tsDoThenParseType(cb) {
    return this.tsInType(() => {
      cb();
      return this.tsParseType();
    });
  }

  tsParseEnumMember() {
    const node = this.startNode();
    node.id = this.match(_types.types.string) ? this.parseExprAtom() : this.parseIdentifier(true);

    if (this.eat(_types.types.eq)) {
      node.initializer = this.parseMaybeAssign();
    }

    return this.finishNode(node, "TSEnumMember");
  }

  tsParseEnumDeclaration(node, isConst) {
    if (isConst) node.const = true;
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, isConst ? _scopeflags.BIND_TS_CONST_ENUM : _scopeflags.BIND_TS_ENUM, undefined, "typescript enum declaration");
    this.expect(_types.types.braceL);
    node.members = this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
    this.expect(_types.types.braceR);
    return this.finishNode(node, "TSEnumDeclaration");
  }

  tsParseModuleBlock() {
    const node = this.startNode();
    this.scope.enter(_scopeflags.SCOPE_OTHER);
    this.expect(_types.types.braceL);
    this.parseBlockOrModuleBlockBody(node.body = [], undefined, true, _types.types.braceR);
    this.scope.exit();
    return this.finishNode(node, "TSModuleBlock");
  }

  tsParseModuleOrNamespaceDeclaration(node, nested = false) {
    node.id = this.parseIdentifier();

    if (!nested) {
      this.checkLVal(node.id, _scopeflags.BIND_TS_NAMESPACE, null, "module or namespace declaration");
    }

    if (this.eat(_types.types.dot)) {
      const inner = this.startNode();
      this.tsParseModuleOrNamespaceDeclaration(inner, true);
      node.body = inner;
    } else {
      this.scope.enter(_scopeflags.SCOPE_TS_MODULE);
      this.prodParam.enter(_productionParameter.PARAM);
      node.body = this.tsParseModuleBlock();
      this.prodParam.exit();
      this.scope.exit();
    }

    return this.finishNode(node, "TSModuleDeclaration");
  }

  tsParseAmbientExternalModuleDeclaration(node) {
    if (this.isContextual("global")) {
      node.global = true;
      node.id = this.parseIdentifier();
    } else if (this.match(_types.types.string)) {
      node.id = this.parseExprAtom();
    } else {
      this.unexpected();
    }

    if (this.match(_types.types.braceL)) {
      this.scope.enter(_scopeflags.SCOPE_TS_MODULE);
      this.prodParam.enter(_productionParameter.PARAM);
      node.body = this.tsParseModuleBlock();
      this.prodParam.exit();
      this.scope.exit();
    } else {
      this.semicolon();
    }

    return this.finishNode(node, "TSModuleDeclaration");
  }

  tsParseImportEqualsDeclaration(node, isExport) {
    node.isExport = isExport || false;
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, _scopeflags.BIND_LEXICAL, undefined, "import equals declaration");
    this.expect(_types.types.eq);
    node.moduleReference = this.tsParseModuleReference();
    this.semicolon();
    return this.finishNode(node, "TSImportEqualsDeclaration");
  }

  tsIsExternalModuleReference() {
    return this.isContextual("require") && this.lookaheadCharCode() === 40;
  }

  tsParseModuleReference() {
    return this.tsIsExternalModuleReference() ? this.tsParseExternalModuleReference() : this.tsParseEntityName(false);
  }

  tsParseExternalModuleReference() {
    const node = this.startNode();
    this.expectContextual("require");
    this.expect(_types.types.parenL);

    if (!this.match(_types.types.string)) {
      throw this.unexpected();
    }

    node.expression = this.parseExprAtom();
    this.expect(_types.types.parenR);
    return this.finishNode(node, "TSExternalModuleReference");
  }

  tsLookAhead(f) {
    const state = this.state.clone();
    const res = f();
    this.state = state;
    return res;
  }

  tsTryParseAndCatch(f) {
    const result = this.tryParse(abort => f() || abort());
    if (result.aborted || !result.node) return undefined;
    if (result.error) this.state = result.failState;
    return result.node;
  }

  tsTryParse(f) {
    const state = this.state.clone();
    const result = f();

    if (result !== undefined && result !== false) {
      return result;
    } else {
      this.state = state;
      return undefined;
    }
  }

  tsTryParseDeclare(nany) {
    if (this.isLineTerminator()) {
      return;
    }

    let starttype = this.state.type;
    let kind;

    if (this.isContextual("let")) {
      starttype = _types.types._var;
      kind = "let";
    }

    switch (starttype) {
      case _types.types._function:
        return this.parseFunctionStatement(nany, false, true);

      case _types.types._class:
        nany.declare = true;
        return this.parseClass(nany, true, false);

      case _types.types._const:
        if (this.match(_types.types._const) && this.isLookaheadContextual("enum")) {
          this.expect(_types.types._const);
          this.expectContextual("enum");
          return this.tsParseEnumDeclaration(nany, true);
        }

      case _types.types._var:
        kind = kind || this.state.value;
        return this.parseVarStatement(nany, kind);

      case _types.types.name:
        {
          const value = this.state.value;

          if (value === "global") {
            return this.tsParseAmbientExternalModuleDeclaration(nany);
          } else {
            return this.tsParseDeclaration(nany, value, true);
          }
        }
    }
  }

  tsTryParseExportDeclaration() {
    return this.tsParseDeclaration(this.startNode(), this.state.value, true);
  }

  tsParseExpressionStatement(node, expr) {
    switch (expr.name) {
      case "declare":
        {
          const declaration = this.tsTryParseDeclare(node);

          if (declaration) {
            declaration.declare = true;
            return declaration;
          }

          break;
        }

      case "global":
        if (this.match(_types.types.braceL)) {
          this.scope.enter(_scopeflags.SCOPE_TS_MODULE);
          this.prodParam.enter(_productionParameter.PARAM);
          const mod = node;
          mod.global = true;
          mod.id = expr;
          mod.body = this.tsParseModuleBlock();
          this.scope.exit();
          this.prodParam.exit();
          return this.finishNode(mod, "TSModuleDeclaration");
        }

        break;

      default:
        return this.tsParseDeclaration(node, expr.name, false);
    }
  }

  tsParseDeclaration(node, value, next) {
    switch (value) {
      case "abstract":
        if (this.tsCheckLineTerminatorAndMatch(_types.types._class, next)) {
          const cls = node;
          cls.abstract = true;

          if (next) {
            this.next();

            if (!this.match(_types.types._class)) {
              this.unexpected(null, _types.types._class);
            }
          }

          return this.parseClass(cls, true, false);
        }

        break;

      case "enum":
        if (next || this.match(_types.types.name)) {
          if (next) this.next();
          return this.tsParseEnumDeclaration(node, false);
        }

        break;

      case "interface":
        if (this.tsCheckLineTerminatorAndMatch(_types.types.name, next)) {
          if (next) this.next();
          return this.tsParseInterfaceDeclaration(node);
        }

        break;

      case "module":
        if (next) this.next();

        if (this.match(_types.types.string)) {
          return this.tsParseAmbientExternalModuleDeclaration(node);
        } else if (this.tsCheckLineTerminatorAndMatch(_types.types.name, next)) {
          return this.tsParseModuleOrNamespaceDeclaration(node);
        }

        break;

      case "namespace":
        if (this.tsCheckLineTerminatorAndMatch(_types.types.name, next)) {
          if (next) this.next();
          return this.tsParseModuleOrNamespaceDeclaration(node);
        }

        break;

      case "type":
        if (this.tsCheckLineTerminatorAndMatch(_types.types.name, next)) {
          if (next) this.next();
          return this.tsParseTypeAliasDeclaration(node);
        }

        break;
    }
  }

  tsCheckLineTerminatorAndMatch(tokenType, next) {
    return (next || this.match(tokenType)) && !this.isLineTerminator();
  }

  tsTryParseGenericAsyncArrowFunction(startPos, startLoc) {
    if (!this.isRelational("<")) {
      return undefined;
    }

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldYieldPos = this.state.yieldPos;
    const oldAwaitPos = this.state.awaitPos;
    this.state.maybeInArrowParameters = true;
    this.state.yieldPos = -1;
    this.state.awaitPos = -1;
    const res = this.tsTryParseAndCatch(() => {
      const node = this.startNodeAt(startPos, startLoc);
      node.typeParameters = this.tsParseTypeParameters();
      super.parseFunctionParams(node);
      node.returnType = this.tsTryParseTypeOrTypePredicateAnnotation();
      this.expect(_types.types.arrow);
      return node;
    });
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    this.state.yieldPos = oldYieldPos;
    this.state.awaitPos = oldAwaitPos;

    if (!res) {
      return undefined;
    }

    return this.parseArrowExpression(res, null, true);
  }

  tsParseTypeArguments() {
    const node = this.startNode();
    node.params = this.tsInType(() => this.tsInNoContext(() => {
      this.expectRelational("<");
      return this.tsParseDelimitedList("TypeParametersOrArguments", this.tsParseType.bind(this));
    }));
    this.state.exprAllowed = false;
    this.expectRelational(">");
    return this.finishNode(node, "TSTypeParameterInstantiation");
  }

  tsIsDeclarationStart() {
    if (this.match(_types.types.name)) {
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
  }

  isExportDefaultSpecifier() {
    if (this.tsIsDeclarationStart()) return false;
    return super.isExportDefaultSpecifier();
  }

  parseAssignableListItem(allowModifiers, decorators) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let accessibility;
    let readonly = false;

    if (allowModifiers) {
      accessibility = this.parseAccessModifier();
      readonly = !!this.tsParseModifier(["readonly"]);
    }

    const left = this.parseMaybeDefault();
    this.parseAssignableListItemTypes(left);
    const elt = this.parseMaybeDefault(left.start, left.loc.start, left);

    if (accessibility || readonly) {
      const pp = this.startNodeAt(startPos, startLoc);

      if (decorators.length) {
        pp.decorators = decorators;
      }

      if (accessibility) pp.accessibility = accessibility;
      if (readonly) pp.readonly = readonly;

      if (elt.type !== "Identifier" && elt.type !== "AssignmentPattern") {
        this.raise(pp.start, TSErrors.UnsupportedParameterPropertyKind);
      }

      pp.parameter = elt;
      return this.finishNode(pp, "TSParameterProperty");
    }

    if (decorators.length) {
      left.decorators = decorators;
    }

    return elt;
  }

  parseFunctionBodyAndFinish(node, type, isMethod = false) {
    if (this.match(_types.types.colon)) {
      node.returnType = this.tsParseTypeOrTypePredicateAnnotation(_types.types.colon);
    }

    const bodilessType = type === "FunctionDeclaration" ? "TSDeclareFunction" : type === "ClassMethod" ? "TSDeclareMethod" : undefined;

    if (bodilessType && !this.match(_types.types.braceL) && this.isLineTerminator()) {
      this.finishNode(node, bodilessType);
      return;
    }

    super.parseFunctionBodyAndFinish(node, type, isMethod);
  }

  registerFunctionStatementId(node) {
    if (!node.body && node.id) {
      this.checkLVal(node.id, _scopeflags.BIND_TS_AMBIENT, null, "function name");
    } else {
      super.registerFunctionStatementId(...arguments);
    }
  }

  parseSubscript(base, startPos, startLoc, noCalls, state) {
    if (!this.hasPrecedingLineBreak() && this.match(_types.types.bang)) {
      this.state.exprAllowed = false;
      this.next();
      const nonNullExpression = this.startNodeAt(startPos, startLoc);
      nonNullExpression.expression = base;
      return this.finishNode(nonNullExpression, "TSNonNullExpression");
    }

    if (this.isRelational("<")) {
      const result = this.tsTryParseAndCatch(() => {
        if (!noCalls && this.atPossibleAsync(base)) {
          const asyncArrowFn = this.tsTryParseGenericAsyncArrowFunction(startPos, startLoc);

          if (asyncArrowFn) {
            return asyncArrowFn;
          }
        }

        const node = this.startNodeAt(startPos, startLoc);
        node.callee = base;
        const typeArguments = this.tsParseTypeArguments();

        if (typeArguments) {
          if (!noCalls && this.eat(_types.types.parenL)) {
            node.arguments = this.parseCallExpressionArguments(_types.types.parenR, false);
            node.typeParameters = typeArguments;
            return this.finishCallExpression(node, state.optionalChainMember);
          } else if (this.match(_types.types.backQuote)) {
            return this.parseTaggedTemplateExpression(startPos, startLoc, base, state, typeArguments);
          }
        }

        this.unexpected();
      });
      if (result) return result;
    }

    return super.parseSubscript(base, startPos, startLoc, noCalls, state);
  }

  parseNewArguments(node) {
    if (this.isRelational("<")) {
      const typeParameters = this.tsTryParseAndCatch(() => {
        const args = this.tsParseTypeArguments();
        if (!this.match(_types.types.parenL)) this.unexpected();
        return args;
      });

      if (typeParameters) {
        node.typeParameters = typeParameters;
      }
    }

    super.parseNewArguments(node);
  }

  parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn) {
    if (nonNull(_types.types._in.binop) > minPrec && !this.hasPrecedingLineBreak() && this.isContextual("as")) {
      const node = this.startNodeAt(leftStartPos, leftStartLoc);
      node.expression = left;

      const _const = this.tsTryNextParseConstantContext();

      if (_const) {
        node.typeAnnotation = _const;
      } else {
        node.typeAnnotation = this.tsNextThenParseType();
      }

      this.finishNode(node, "TSAsExpression");
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
    }

    return super.parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn);
  }

  checkReservedWord(word, startLoc, checkKeywords, isBinding) {}

  checkDuplicateExports() {}

  parseImport(node) {
    if (this.match(_types.types.name) && this.lookahead().type === _types.types.eq) {
      return this.tsParseImportEqualsDeclaration(node);
    }

    return super.parseImport(node);
  }

  parseExport(node) {
    if (this.match(_types.types._import)) {
      this.expect(_types.types._import);
      return this.tsParseImportEqualsDeclaration(node, true);
    } else if (this.eat(_types.types.eq)) {
      const assign = node;
      assign.expression = this.parseExpression();
      this.semicolon();
      return this.finishNode(assign, "TSExportAssignment");
    } else if (this.eatContextual("as")) {
      const decl = node;
      this.expectContextual("namespace");
      decl.id = this.parseIdentifier();
      this.semicolon();
      return this.finishNode(decl, "TSNamespaceExportDeclaration");
    } else {
      return super.parseExport(node);
    }
  }

  isAbstractClass() {
    return this.isContextual("abstract") && this.lookahead().type === _types.types._class;
  }

  parseExportDefaultExpression() {
    if (this.isAbstractClass()) {
      const cls = this.startNode();
      this.next();
      this.parseClass(cls, true, true);
      cls.abstract = true;
      return cls;
    }

    if (this.state.value === "interface") {
      const result = this.tsParseDeclaration(this.startNode(), this.state.value, true);
      if (result) return result;
    }

    return super.parseExportDefaultExpression();
  }

  parseStatementContent(context, topLevel) {
    if (this.state.type === _types.types._const) {
      const ahead = this.lookahead();

      if (ahead.type === _types.types.name && ahead.value === "enum") {
        const node = this.startNode();
        this.expect(_types.types._const);
        this.expectContextual("enum");
        return this.tsParseEnumDeclaration(node, true);
      }
    }

    return super.parseStatementContent(context, topLevel);
  }

  parseAccessModifier() {
    return this.tsParseModifier(["public", "protected", "private"]);
  }

  parseClassMember(classBody, member, state, constructorAllowsSuper) {
    this.tsParseModifiers(member, ["declare"]);
    const accessibility = this.parseAccessModifier();
    if (accessibility) member.accessibility = accessibility;
    this.tsParseModifiers(member, ["declare"]);
    super.parseClassMember(classBody, member, state, constructorAllowsSuper);
  }

  parseClassMemberWithIsStatic(classBody, member, state, isStatic, constructorAllowsSuper) {
    this.tsParseModifiers(member, ["abstract", "readonly", "declare"]);
    const idx = this.tsTryParseIndexSignature(member);

    if (idx) {
      classBody.body.push(idx);

      if (member.abstract) {
        this.raise(member.start, TSErrors.IndexSignatureHasAbstract);
      }

      if (isStatic) {
        this.raise(member.start, TSErrors.IndexSignatureHasStatic);
      }

      if (member.accessibility) {
        this.raise(member.start, TSErrors.IndexSignatureHasAccessibility, member.accessibility);
      }

      return;
    }

    super.parseClassMemberWithIsStatic(classBody, member, state, isStatic, constructorAllowsSuper);
  }

  parsePostMemberNameModifiers(methodOrProp) {
    const optional = this.eat(_types.types.question);
    if (optional) methodOrProp.optional = true;

    if (methodOrProp.readonly && this.match(_types.types.parenL)) {
      this.raise(methodOrProp.start, TSErrors.ClassMethodHasReadonly);
    }

    if (methodOrProp.declare && this.match(_types.types.parenL)) {
      this.raise(methodOrProp.start, TSErrors.ClassMethodHasDeclare);
    }
  }

  parseExpressionStatement(node, expr) {
    const decl = expr.type === "Identifier" ? this.tsParseExpressionStatement(node, expr) : undefined;
    return decl || super.parseExpressionStatement(node, expr);
  }

  shouldParseExportDeclaration() {
    if (this.tsIsDeclarationStart()) return true;
    return super.shouldParseExportDeclaration();
  }

  parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos) {
    if (!refNeedsArrowPos || !this.match(_types.types.question)) {
      return super.parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos);
    }

    const result = this.tryParse(() => super.parseConditional(expr, noIn, startPos, startLoc));

    if (!result.node) {
      refNeedsArrowPos.start = result.error.pos || this.state.start;
      return expr;
    }

    if (result.error) this.state = result.failState;
    return result.node;
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
      typeCastNode.typeAnnotation = this.tsParseTypeAnnotation();
      return this.finishNode(typeCastNode, "TSTypeCastExpression");
    }

    return node;
  }

  parseExportDeclaration(node) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const isDeclare = this.eatContextual("declare");
    let declaration;

    if (this.match(_types.types.name)) {
      declaration = this.tsTryParseExportDeclaration();
    }

    if (!declaration) {
      declaration = super.parseExportDeclaration(node);
    }

    if (declaration && isDeclare) {
      this.resetStartLocation(declaration, startPos, startLoc);
      declaration.declare = true;
    }

    return declaration;
  }

  parseClassId(node, isStatement, optionalId) {
    if ((!isStatement || optionalId) && this.isContextual("implements")) {
      return;
    }

    super.parseClassId(node, isStatement, optionalId, node.declare ? _scopeflags.BIND_TS_AMBIENT : _scopeflags.BIND_CLASS);
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) node.typeParameters = typeParameters;
  }

  parseClassPropertyAnnotation(node) {
    if (!node.optional && this.eat(_types.types.bang)) {
      node.definite = true;
    }

    const type = this.tsTryParseTypeAnnotation();
    if (type) node.typeAnnotation = type;
  }

  parseClassProperty(node) {
    this.parseClassPropertyAnnotation(node);

    if (node.declare && this.match(_types.types.equal)) {
      this.raise(this.state.start, TSErrors.DeclareClassFieldHasInitializer);
    }

    return super.parseClassProperty(node);
  }

  parseClassPrivateProperty(node) {
    if (node.abstract) {
      this.raise(node.start, TSErrors.PrivateElementHasAbstract);
    }

    if (node.accessibility) {
      this.raise(node.start, TSErrors.PrivateElementHasAccessibility, node.accessibility);
    }

    this.parseClassPropertyAnnotation(node);
    return super.parseClassPrivateProperty(node);
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) method.typeParameters = typeParameters;
    super.pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper);
  }

  pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) method.typeParameters = typeParameters;
    super.pushClassPrivateMethod(classBody, method, isGenerator, isAsync);
  }

  parseClassSuper(node) {
    super.parseClassSuper(node);

    if (node.superClass && this.isRelational("<")) {
      node.superTypeParameters = this.tsParseTypeArguments();
    }

    if (this.eatContextual("implements")) {
      node.implements = this.tsParseHeritageClause("implements");
    }
  }

  parseObjPropValue(prop, ...args) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) prop.typeParameters = typeParameters;
    super.parseObjPropValue(prop, ...args);
  }

  parseFunctionParams(node, allowModifiers) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) node.typeParameters = typeParameters;
    super.parseFunctionParams(node, allowModifiers);
  }

  parseVarId(decl, kind) {
    super.parseVarId(decl, kind);

    if (decl.id.type === "Identifier" && this.eat(_types.types.bang)) {
      decl.definite = true;
    }

    const type = this.tsTryParseTypeAnnotation();

    if (type) {
      decl.id.typeAnnotation = type;
      this.resetEndLocation(decl.id);
    }
  }

  parseAsyncArrowFromCallExpression(node, call) {
    if (this.match(_types.types.colon)) {
      node.returnType = this.tsParseTypeAnnotation();
    }

    return super.parseAsyncArrowFromCallExpression(node, call);
  }

  parseMaybeAssign(...args) {
    let state;
    let jsx;
    let typeCast;

    if (this.match(_types.types.jsxTagStart)) {
      state = this.state.clone();
      jsx = this.tryParse(() => super.parseMaybeAssign(...args), state);
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

    if (!(jsx && jsx.error) && !this.isRelational("<")) {
      return super.parseMaybeAssign(...args);
    }

    let typeParameters;
    state = state || this.state.clone();
    const arrow = this.tryParse(abort => {
      typeParameters = this.tsParseTypeParameters();
      const expr = super.parseMaybeAssign(...args);

      if (expr.type !== "ArrowFunctionExpression" || expr.extra && expr.extra.parenthesized) {
        abort();
      }

      if (typeParameters && typeParameters.params.length !== 0) {
        this.resetStartLocationFromNode(expr, typeParameters);
      }

      expr.typeParameters = typeParameters;
      return expr;
    }, state);
    if (!arrow.error && !arrow.aborted) return arrow.node;

    if (!jsx) {
      assert(!this.hasPlugin("jsx"));
      typeCast = this.tryParse(() => super.parseMaybeAssign(...args), state);
      if (!typeCast.error) return typeCast.node;
    }

    if (jsx && jsx.node) {
      this.state = jsx.failState;
      return jsx.node;
    }

    if (arrow.node) {
      this.state = arrow.failState;
      return arrow.node;
    }

    if (typeCast && typeCast.node) {
      this.state = typeCast.failState;
      return typeCast.node;
    }

    if (jsx && jsx.thrown) throw jsx.error;
    if (arrow.thrown) throw arrow.error;
    if (typeCast && typeCast.thrown) throw typeCast.error;
    throw jsx && jsx.error || arrow.error || typeCast && typeCast.error;
  }

  parseMaybeUnary(refExpressionErrors) {
    if (!this.hasPlugin("jsx") && this.isRelational("<")) {
      return this.tsParseTypeAssertion();
    } else {
      return super.parseMaybeUnary(refExpressionErrors);
    }
  }

  parseArrow(node) {
    if (this.match(_types.types.colon)) {
      const result = this.tryParse(abort => {
        const returnType = this.tsParseTypeOrTypePredicateAnnotation(_types.types.colon);
        if (this.canInsertSemicolon() || !this.match(_types.types.arrow)) abort();
        return returnType;
      });
      if (result.aborted) return;

      if (!result.thrown) {
        if (result.error) this.state = result.failState;
        node.returnType = result.node;
      }
    }

    return super.parseArrow(node);
  }

  parseAssignableListItemTypes(param) {
    if (this.eat(_types.types.question)) {
      if (param.type !== "Identifier") {
        this.raise(param.start, TSErrors.PatternIsOptional);
      }

      param.optional = true;
    }

    const type = this.tsTryParseTypeAnnotation();
    if (type) param.typeAnnotation = type;
    this.resetEndLocation(param);
    return param;
  }

  toAssignable(node) {
    switch (node.type) {
      case "TSTypeCastExpression":
        return super.toAssignable(this.typeCastToParameter(node));

      case "TSParameterProperty":
        return super.toAssignable(node);

      case "TSAsExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
        node.expression = this.toAssignable(node.expression);
        return node;

      default:
        return super.toAssignable(node);
    }
  }

  checkLVal(expr, bindingType = _scopeflags.BIND_NONE, checkClashes, contextDescription) {
    switch (expr.type) {
      case "TSTypeCastExpression":
        return;

      case "TSParameterProperty":
        this.checkLVal(expr.parameter, bindingType, checkClashes, "parameter property");
        return;

      case "TSAsExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
        this.checkLVal(expr.expression, bindingType, checkClashes, contextDescription);
        return;

      default:
        super.checkLVal(expr, bindingType, checkClashes, contextDescription);
        return;
    }
  }

  parseBindingAtom() {
    switch (this.state.type) {
      case _types.types._this:
        return this.parseIdentifier(true);

      default:
        return super.parseBindingAtom();
    }
  }

  parseMaybeDecoratorArguments(expr) {
    if (this.isRelational("<")) {
      const typeArguments = this.tsParseTypeArguments();

      if (this.match(_types.types.parenL)) {
        const call = super.parseMaybeDecoratorArguments(expr);
        call.typeParameters = typeArguments;
        return call;
      }

      this.unexpected(this.state.start, _types.types.parenL);
    }

    return super.parseMaybeDecoratorArguments(expr);
  }

  isClassMethod() {
    return this.isRelational("<") || super.isClassMethod();
  }

  isClassProperty() {
    return this.match(_types.types.bang) || this.match(_types.types.colon) || super.isClassProperty();
  }

  parseMaybeDefault(...args) {
    const node = super.parseMaybeDefault(...args);

    if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
      this.raise(node.typeAnnotation.start, TSErrors.TypeAnnotationAfterAssign);
    }

    return node;
  }

  getTokenFromCode(code) {
    if (this.state.inType && (code === 62 || code === 60)) {
      return this.finishOp(_types.types.relational, 1);
    } else {
      return super.getTokenFromCode(code);
    }
  }

  toAssignableList(exprList) {
    for (let i = 0; i < exprList.length; i++) {
      const expr = exprList[i];
      if (!expr) continue;

      switch (expr.type) {
        case "TSTypeCastExpression":
          exprList[i] = this.typeCastToParameter(expr);
          break;

        case "TSAsExpression":
        case "TSTypeAssertion":
          if (!this.state.maybeInArrowParameters) {
            exprList[i] = this.typeCastToParameter(expr);
          } else {
            this.raise(expr.start, TSErrors.UnexpectedTypeCastInParameter);
          }

          break;
      }
    }

    return super.toAssignableList(...arguments);
  }

  typeCastToParameter(node) {
    node.expression.typeAnnotation = node.typeAnnotation;
    this.resetEndLocation(node.expression, node.typeAnnotation.end, node.typeAnnotation.loc.end);
    return node.expression;
  }

  toReferencedList(exprList, isInParens) {
    for (let i = 0; i < exprList.length; i++) {
      const expr = exprList[i];

      if (expr && expr.type === "TSTypeCastExpression") {
        this.raise(expr.start, TSErrors.UnexpectedTypeAnnotation);
      }
    }

    return exprList;
  }

  shouldParseArrow() {
    return this.match(_types.types.colon) || super.shouldParseArrow();
  }

  shouldParseAsyncArrow() {
    return this.match(_types.types.colon) || super.shouldParseAsyncArrow();
  }

  canHaveLeadingDecorator() {
    return super.canHaveLeadingDecorator() || this.isAbstractClass();
  }

  jsxParseOpeningElementAfterName(node) {
    if (this.isRelational("<")) {
      const typeArguments = this.tsTryParseAndCatch(() => this.tsParseTypeArguments());
      if (typeArguments) node.typeParameters = typeArguments;
    }

    return super.jsxParseOpeningElementAfterName(node);
  }

  getGetterSetterExpectedParamCount(method) {
    const baseCount = super.getGetterSetterExpectedParamCount(method);
    const firstParam = method.params[0];
    const hasContextParam = firstParam && firstParam.type === "Identifier" && firstParam.name === "this";
    return hasContextParam ? baseCount + 1 : baseCount;
  }

};

exports.default = _default;