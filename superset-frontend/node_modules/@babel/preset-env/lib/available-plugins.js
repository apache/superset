"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pluginSyntaxAsyncGenerators = _interopRequireDefault(require("@babel/plugin-syntax-async-generators"));

var _pluginSyntaxDynamicImport = _interopRequireDefault(require("@babel/plugin-syntax-dynamic-import"));

var _pluginSyntaxJsonStrings = _interopRequireDefault(require("@babel/plugin-syntax-json-strings"));

var _pluginSyntaxNullishCoalescingOperator = _interopRequireDefault(require("@babel/plugin-syntax-nullish-coalescing-operator"));

var _pluginSyntaxObjectRestSpread = _interopRequireDefault(require("@babel/plugin-syntax-object-rest-spread"));

var _pluginSyntaxOptionalCatchBinding = _interopRequireDefault(require("@babel/plugin-syntax-optional-catch-binding"));

var _pluginSyntaxOptionalChaining = _interopRequireDefault(require("@babel/plugin-syntax-optional-chaining"));

var _pluginSyntaxTopLevelAwait = _interopRequireDefault(require("@babel/plugin-syntax-top-level-await"));

var _pluginProposalAsyncGeneratorFunctions = _interopRequireDefault(require("@babel/plugin-proposal-async-generator-functions"));

var _pluginProposalDynamicImport = _interopRequireDefault(require("@babel/plugin-proposal-dynamic-import"));

var _pluginProposalJsonStrings = _interopRequireDefault(require("@babel/plugin-proposal-json-strings"));

var _pluginProposalNullishCoalescingOperator = _interopRequireDefault(require("@babel/plugin-proposal-nullish-coalescing-operator"));

var _pluginProposalObjectRestSpread = _interopRequireDefault(require("@babel/plugin-proposal-object-rest-spread"));

var _pluginProposalOptionalCatchBinding = _interopRequireDefault(require("@babel/plugin-proposal-optional-catch-binding"));

var _pluginProposalOptionalChaining = _interopRequireDefault(require("@babel/plugin-proposal-optional-chaining"));

var _pluginProposalUnicodePropertyRegex = _interopRequireDefault(require("@babel/plugin-proposal-unicode-property-regex"));

var _pluginTransformAsyncToGenerator = _interopRequireDefault(require("@babel/plugin-transform-async-to-generator"));

var _pluginTransformArrowFunctions = _interopRequireDefault(require("@babel/plugin-transform-arrow-functions"));

var _pluginTransformBlockScopedFunctions = _interopRequireDefault(require("@babel/plugin-transform-block-scoped-functions"));

var _pluginTransformBlockScoping = _interopRequireDefault(require("@babel/plugin-transform-block-scoping"));

var _pluginTransformClasses = _interopRequireDefault(require("@babel/plugin-transform-classes"));

var _pluginTransformComputedProperties = _interopRequireDefault(require("@babel/plugin-transform-computed-properties"));

var _pluginTransformDestructuring = _interopRequireDefault(require("@babel/plugin-transform-destructuring"));

var _pluginTransformDotallRegex = _interopRequireDefault(require("@babel/plugin-transform-dotall-regex"));

var _pluginTransformDuplicateKeys = _interopRequireDefault(require("@babel/plugin-transform-duplicate-keys"));

var _pluginTransformExponentiationOperator = _interopRequireDefault(require("@babel/plugin-transform-exponentiation-operator"));

var _pluginTransformForOf = _interopRequireDefault(require("@babel/plugin-transform-for-of"));

var _pluginTransformFunctionName = _interopRequireDefault(require("@babel/plugin-transform-function-name"));

var _pluginTransformLiterals = _interopRequireDefault(require("@babel/plugin-transform-literals"));

var _pluginTransformMemberExpressionLiterals = _interopRequireDefault(require("@babel/plugin-transform-member-expression-literals"));

var _pluginTransformModulesAmd = _interopRequireDefault(require("@babel/plugin-transform-modules-amd"));

var _pluginTransformModulesCommonjs = _interopRequireDefault(require("@babel/plugin-transform-modules-commonjs"));

var _pluginTransformModulesSystemjs = _interopRequireDefault(require("@babel/plugin-transform-modules-systemjs"));

var _pluginTransformModulesUmd = _interopRequireDefault(require("@babel/plugin-transform-modules-umd"));

var _pluginTransformNamedCapturingGroupsRegex = _interopRequireDefault(require("@babel/plugin-transform-named-capturing-groups-regex"));

var _pluginTransformNewTarget = _interopRequireDefault(require("@babel/plugin-transform-new-target"));

var _pluginTransformObjectSuper = _interopRequireDefault(require("@babel/plugin-transform-object-super"));

var _pluginTransformParameters = _interopRequireDefault(require("@babel/plugin-transform-parameters"));

var _pluginTransformPropertyLiterals = _interopRequireDefault(require("@babel/plugin-transform-property-literals"));

var _pluginTransformRegenerator = _interopRequireDefault(require("@babel/plugin-transform-regenerator"));

var _pluginTransformReservedWords = _interopRequireDefault(require("@babel/plugin-transform-reserved-words"));

var _pluginTransformShorthandProperties = _interopRequireDefault(require("@babel/plugin-transform-shorthand-properties"));

var _pluginTransformSpread = _interopRequireDefault(require("@babel/plugin-transform-spread"));

var _pluginTransformStickyRegex = _interopRequireDefault(require("@babel/plugin-transform-sticky-regex"));

var _pluginTransformTemplateLiterals = _interopRequireDefault(require("@babel/plugin-transform-template-literals"));

var _pluginTransformTypeofSymbol = _interopRequireDefault(require("@babel/plugin-transform-typeof-symbol"));

var _pluginTransformUnicodeRegex = _interopRequireDefault(require("@babel/plugin-transform-unicode-regex"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  "proposal-async-generator-functions": _pluginProposalAsyncGeneratorFunctions.default,
  "proposal-dynamic-import": _pluginProposalDynamicImport.default,
  "proposal-json-strings": _pluginProposalJsonStrings.default,
  "proposal-nullish-coalescing-operator": _pluginProposalNullishCoalescingOperator.default,
  "proposal-object-rest-spread": _pluginProposalObjectRestSpread.default,
  "proposal-optional-catch-binding": _pluginProposalOptionalCatchBinding.default,
  "proposal-optional-chaining": _pluginProposalOptionalChaining.default,
  "proposal-unicode-property-regex": _pluginProposalUnicodePropertyRegex.default,
  "syntax-async-generators": _pluginSyntaxAsyncGenerators.default,
  "syntax-dynamic-import": _pluginSyntaxDynamicImport.default,
  "syntax-json-strings": _pluginSyntaxJsonStrings.default,
  "syntax-nullish-coalescing-operator": _pluginSyntaxNullishCoalescingOperator.default,
  "syntax-object-rest-spread": _pluginSyntaxObjectRestSpread.default,
  "syntax-optional-catch-binding": _pluginSyntaxOptionalCatchBinding.default,
  "syntax-optional-chaining": _pluginSyntaxOptionalChaining.default,
  "syntax-top-level-await": _pluginSyntaxTopLevelAwait.default,
  "transform-arrow-functions": _pluginTransformArrowFunctions.default,
  "transform-async-to-generator": _pluginTransformAsyncToGenerator.default,
  "transform-block-scoped-functions": _pluginTransformBlockScopedFunctions.default,
  "transform-block-scoping": _pluginTransformBlockScoping.default,
  "transform-classes": _pluginTransformClasses.default,
  "transform-computed-properties": _pluginTransformComputedProperties.default,
  "transform-destructuring": _pluginTransformDestructuring.default,
  "transform-dotall-regex": _pluginTransformDotallRegex.default,
  "transform-duplicate-keys": _pluginTransformDuplicateKeys.default,
  "transform-exponentiation-operator": _pluginTransformExponentiationOperator.default,
  "transform-for-of": _pluginTransformForOf.default,
  "transform-function-name": _pluginTransformFunctionName.default,
  "transform-literals": _pluginTransformLiterals.default,
  "transform-member-expression-literals": _pluginTransformMemberExpressionLiterals.default,
  "transform-modules-amd": _pluginTransformModulesAmd.default,
  "transform-modules-commonjs": _pluginTransformModulesCommonjs.default,
  "transform-modules-systemjs": _pluginTransformModulesSystemjs.default,
  "transform-modules-umd": _pluginTransformModulesUmd.default,
  "transform-named-capturing-groups-regex": _pluginTransformNamedCapturingGroupsRegex.default,
  "transform-new-target": _pluginTransformNewTarget.default,
  "transform-object-super": _pluginTransformObjectSuper.default,
  "transform-parameters": _pluginTransformParameters.default,
  "transform-property-literals": _pluginTransformPropertyLiterals.default,
  "transform-regenerator": _pluginTransformRegenerator.default,
  "transform-reserved-words": _pluginTransformReservedWords.default,
  "transform-shorthand-properties": _pluginTransformShorthandProperties.default,
  "transform-spread": _pluginTransformSpread.default,
  "transform-sticky-regex": _pluginTransformStickyRegex.default,
  "transform-template-literals": _pluginTransformTemplateLiterals.default,
  "transform-typeof-symbol": _pluginTransformTypeofSymbol.default,
  "transform-unicode-regex": _pluginTransformUnicodeRegex.default
};
exports.default = _default;