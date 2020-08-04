"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getType = getType;
exports.intersection = intersection;
exports.filterStageFromList = filterStageFromList;
exports.getImportSource = getImportSource;
exports.getRequireSource = getRequireSource;
exports.isPolyfillSource = isPolyfillSource;
exports.getModulePath = getModulePath;
exports.createImport = createImport;
exports.isNamespaced = isNamespaced;
exports.has = void 0;

var t = _interopRequireWildcard(require("@babel/types"));

var _helperModuleImports = require("@babel/helper-module-imports");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const has = Object.hasOwnProperty.call.bind(Object.hasOwnProperty);
exports.has = has;

function getType(target) {
  return Object.prototype.toString.call(target).slice(8, -1).toLowerCase();
}

function intersection(first, second, third) {
  const result = new Set();

  for (const el of first) {
    if (second.has(el) && third.has(el)) result.add(el);
  }

  return result;
}

function filterStageFromList(list, stageList) {
  return Object.keys(list).reduce((result, item) => {
    if (!stageList.has(item)) {
      result[item] = list[item];
    }

    return result;
  }, {});
}

function getImportSource({
  node
}) {
  if (node.specifiers.length === 0) return node.source.value;
}

function getRequireSource({
  node
}) {
  if (!t.isExpressionStatement(node)) return;
  const {
    expression
  } = node;
  const isRequire = t.isCallExpression(expression) && t.isIdentifier(expression.callee) && expression.callee.name === "require" && expression.arguments.length === 1 && t.isStringLiteral(expression.arguments[0]);
  if (isRequire) return expression.arguments[0].value;
}

function isPolyfillSource(source) {
  return source === "@babel/polyfill" || source === "core-js";
}

const modulePathMap = {
  "regenerator-runtime": "regenerator-runtime/runtime"
};

function getModulePath(mod) {
  return modulePathMap[mod] || `core-js/modules/${mod}`;
}

function createImport(path, mod) {
  return (0, _helperModuleImports.addSideEffect)(path, getModulePath(mod));
}

function isNamespaced(path) {
  if (!path.node) return false;
  const binding = path.scope.getBinding(path.node.name);
  if (!binding) return false;
  return binding.path.isImportNamespaceSpecifier();
}