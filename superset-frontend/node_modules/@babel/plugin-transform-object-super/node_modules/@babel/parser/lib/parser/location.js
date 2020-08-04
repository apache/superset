"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Errors = void 0;

var _location = require("../util/location");

var _comments = _interopRequireDefault(require("./comments"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Errors = Object.freeze({
  ArgumentsDisallowedInInitializer: "'arguments' is not allowed in class field initializer",
  AsyncFunctionInSingleStatementContext: "Async functions can only be declared at the top level or inside a block",
  AwaitBindingIdentifier: "Can not use 'await' as identifier inside an async function",
  AwaitExpressionFormalParameter: "await is not allowed in async function parameters",
  AwaitNotInAsyncFunction: "Can not use keyword 'await' outside an async function",
  BadGetterArity: "getter must not have any formal parameters",
  BadSetterArity: "setter must have exactly one formal parameter",
  BadSetterRestParameter: "setter function argument must not be a rest parameter",
  ConstructorClassField: "Classes may not have a field named 'constructor'",
  ConstructorClassPrivateField: "Classes may not have a private field named '#constructor'",
  ConstructorIsAccessor: "Constructor can't have get/set modifier",
  ConstructorIsAsync: "Constructor can't be an async function",
  ConstructorIsGenerator: "Constructor can't be a generator",
  DeclarationMissingInitializer: "%0 require an initialization value",
  DecoratorBeforeExport: "Decorators must be placed *before* the 'export' keyword. You can set the 'decoratorsBeforeExport' option to false to use the 'export @decorator class {}' syntax",
  DecoratorConstructor: "Decorators can't be used with a constructor. Did you mean '@dec class { ... }'?",
  DecoratorExportClass: "Using the export keyword between a decorator and a class is not allowed. Please use `export @dec class` instead.",
  DecoratorSemicolon: "Decorators must not be followed by a semicolon",
  DeletePrivateField: "Deleting a private field is not allowed",
  DestructureNamedImport: "ES2015 named imports do not destructure. Use another statement for destructuring after the import.",
  DuplicateConstructor: "Duplicate constructor in the same class",
  DuplicateDefaultExport: "Only one default export allowed per module.",
  DuplicateExport: "`%0` has already been exported. Exported identifiers must be unique.",
  DuplicateProto: "Redefinition of __proto__ property",
  DuplicateRegExpFlags: "Duplicate regular expression flag",
  ElementAfterRest: "Rest element must be last element",
  EscapedCharNotAnIdentifier: "Invalid Unicode escape",
  ForInOfLoopInitializer: "%0 loop variable declaration may not have an initializer",
  GeneratorInSingleStatementContext: "Generators can only be declared at the top level or inside a block",
  IllegalBreakContinue: "Unsyntactic %0",
  IllegalLanguageModeDirective: "Illegal 'use strict' directive in function with non-simple parameter list",
  IllegalReturn: "'return' outside of function",
  ImportCallArgumentTrailingComma: "Trailing comma is disallowed inside import(...) arguments",
  ImportCallArity: "import() requires exactly one argument",
  ImportCallArityLtOne: "Dynamic imports require a parameter: import('a.js')",
  ImportCallNotNewExpression: "Cannot use new with import(...)",
  ImportCallSpreadArgument: "... is not allowed in import()",
  ImportMetaOutsideModule: `import.meta may appear only with 'sourceType: "module"'`,
  ImportOutsideModule: `'import' and 'export' may appear only with 'sourceType: "module"'`,
  InvalidCodePoint: "Code point out of bounds",
  InvalidDigit: "Expected number in radix %0",
  InvalidEscapeSequence: "Bad character escape sequence",
  InvalidEscapeSequenceTemplate: "Invalid escape sequence in template",
  InvalidEscapedReservedWord: "Escape sequence in keyword %0",
  InvalidIdentifier: "Invalid identifier %0",
  InvalidLhs: "Invalid left-hand side in %0",
  InvalidLhsBinding: "Binding invalid left-hand side in %0",
  InvalidNumber: "Invalid number",
  InvalidOrUnexpectedToken: "Unexpected character '%0'",
  InvalidParenthesizedAssignment: "Invalid parenthesized assignment pattern",
  InvalidPrivateFieldResolution: "Private name #%0 is not defined",
  InvalidPropertyBindingPattern: "Binding member expression",
  InvalidRestAssignmentPattern: "Invalid rest operator's argument",
  LabelRedeclaration: "Label '%0' is already declared",
  LetInLexicalBinding: "'let' is not allowed to be used as a name in 'let' or 'const' declarations.",
  MalformedRegExpFlags: "Invalid regular expression flag",
  MissingClassName: "A class name is required",
  MissingEqInAssignment: "Only '=' operator can be used for specifying default value.",
  MissingUnicodeEscape: "Expecting Unicode escape sequence \\uXXXX",
  MixingCoalesceWithLogical: "Nullish coalescing operator(??) requires parens when mixing with logical operators",
  ModuleExportUndefined: "Export '%0' is not defined",
  MultipleDefaultsInSwitch: "Multiple default clauses",
  NewlineAfterThrow: "Illegal newline after throw",
  NoCatchOrFinally: "Missing catch or finally clause",
  NumberIdentifier: "Identifier directly after number",
  NumericSeparatorInEscapeSequence: "Numeric separators are not allowed inside unicode escape sequences or hex escape sequences",
  ObsoleteAwaitStar: "await* has been removed from the async functions proposal. Use Promise.all() instead.",
  OptionalChainingNoNew: "constructors in/after an Optional Chain are not allowed",
  OptionalChainingNoTemplate: "Tagged Template Literals are not allowed in optionalChain",
  ParamDupe: "Argument name clash",
  PatternHasAccessor: "Object pattern can't contain getter or setter",
  PatternHasMethod: "Object pattern can't contain methods",
  PipelineBodyNoArrow: 'Unexpected arrow "=>" after pipeline body; arrow function in pipeline body must be parenthesized',
  PipelineBodySequenceExpression: "Pipeline body may not be a comma-separated sequence expression",
  PipelineHeadSequenceExpression: "Pipeline head should not be a comma-separated sequence expression",
  PipelineTopicUnused: "Pipeline is in topic style but does not use topic reference",
  PrimaryTopicNotAllowed: "Topic reference was used in a lexical context without topic binding",
  PrimaryTopicRequiresSmartPipeline: "Primary Topic Reference found but pipelineOperator not passed 'smart' for 'proposal' option.",
  PrivateNameRedeclaration: "Duplicate private name #%0",
  RestTrailingComma: "Unexpected trailing comma after rest element",
  SloppyFunction: "In non-strict mode code, functions can only be declared at top level, inside a block, or as the body of an if statement",
  StaticPrototype: "Classes may not have static property named prototype",
  StrictDelete: "Deleting local variable in strict mode",
  StrictEvalArguments: "Assigning to '%0' in strict mode",
  StrictEvalArgumentsBinding: "Binding '%0' in strict mode",
  StrictFunction: "In strict mode code, functions can only be declared at top level or inside a block",
  StrictOctalLiteral: "Octal literal in strict mode",
  StrictWith: "'with' in strict mode",
  SuperNotAllowed: "super() is only valid inside a class constructor of a subclass. Maybe a typo in the method name ('constructor') or not extending another class?",
  SuperPrivateField: "Private fields can't be accessed on super",
  TrailingDecorator: "You have trailing decorators with no method",
  UnexpectedArgumentPlaceholder: "Unexpected argument placeholder",
  UnexpectedAwaitAfterPipelineBody: 'Unexpected "await" after pipeline body; await must have parentheses in minimal proposal',
  UnexpectedDigitAfterHash: "Unexpected digit after hash token",
  UnexpectedImportExport: "'import' and 'export' may only appear at the top level",
  UnexpectedKeyword: "Unexpected keyword '%0'",
  UnexpectedLeadingDecorator: "Leading decorators must be attached to a class declaration",
  UnexpectedLexicalDeclaration: "Lexical declaration cannot appear in a single-statement context",
  UnexpectedNewTarget: "new.target can only be used in functions",
  UnexpectedNumericSeparator: "A numeric separator is only allowed between two digits",
  UnexpectedPrivateField: "Private names can only be used as the name of a class element (i.e. class C { #p = 42; #m() {} } )\n or a property of member expression (i.e. this.#p).",
  UnexpectedReservedWord: "Unexpected reserved word '%0'",
  UnexpectedSuper: "super is only allowed in object methods and classes",
  UnexpectedToken: "Unexpected token '%'",
  UnexpectedTokenUnaryExponentiation: "Illegal expression. Wrap left hand side or entire exponentiation in parentheses.",
  UnsupportedBind: "Binding should be performed on object property.",
  UnsupportedDecoratorExport: "You can only use decorators on an export when exporting a class",
  UnsupportedDefaultExport: "Only expressions, functions or classes are allowed as the `default` export.",
  UnsupportedImport: "import can only be used in import() or import.meta",
  UnsupportedMetaProperty: "The only valid meta property for %0 is %0.%1",
  UnsupportedParameterDecorator: "Stage 2 decorators cannot be used to decorate parameters",
  UnsupportedPropertyDecorator: "Stage 2 decorators disallow object literal property decorators",
  UnsupportedSuper: "super can only be used with function calls (i.e. super()) or in property accesses (i.e. super.prop or super[prop])",
  UnterminatedComment: "Unterminated comment",
  UnterminatedRegExp: "Unterminated regular expression",
  UnterminatedString: "Unterminated string constant",
  UnterminatedTemplate: "Unterminated template",
  VarRedeclaration: "Identifier '%0' has already been declared",
  YieldBindingIdentifier: "Can not use 'yield' as identifier inside a generator",
  YieldInParameter: "yield is not allowed in generator parameters",
  ZeroDigitNumericSeparator: "Numeric separator can not be used after leading 0"
});
exports.Errors = Errors;

class LocationParser extends _comments.default {
  getLocationForPosition(pos) {
    let loc;
    if (pos === this.state.start) loc = this.state.startLoc;else if (pos === this.state.lastTokStart) loc = this.state.lastTokStartLoc;else if (pos === this.state.end) loc = this.state.endLoc;else if (pos === this.state.lastTokEnd) loc = this.state.lastTokEndLoc;else loc = (0, _location.getLineInfo)(this.input, pos);
    return loc;
  }

  raise(pos, errorTemplate, ...params) {
    return this.raiseWithData(pos, undefined, errorTemplate, ...params);
  }

  raiseWithData(pos, data, errorTemplate, ...params) {
    const loc = this.getLocationForPosition(pos);
    const message = errorTemplate.replace(/%(\d+)/g, (_, i) => params[i]) + ` (${loc.line}:${loc.column})`;
    return this._raise(Object.assign({
      loc,
      pos
    }, data), message);
  }

  _raise(errorContext, message) {
    const err = new SyntaxError(message);
    Object.assign(err, errorContext);

    if (this.options.errorRecovery) {
      if (!this.isLookahead) this.state.errors.push(err);
      return err;
    } else {
      throw err;
    }
  }

}

exports.default = LocationParser;