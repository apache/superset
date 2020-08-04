"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _helperHoistVariables = _interopRequireDefault(require("@babel/helper-hoist-variables"));

var t = _interopRequireWildcard(require("@babel/types"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const visitor = {
  enter(path, state) {
    if (path.isThisExpression()) {
      state.foundThis = true;
    }

    if (path.isReferencedIdentifier({
      name: "arguments"
    })) {
      state.foundArguments = true;
    }
  },

  Function(path) {
    path.skip();
  }

};

function _default(path, scope = path.scope, shouldHoistVariables = true) {
  const {
    node
  } = path;
  const container = t.functionExpression(null, [], node.body, node.generator, node.async);
  let callee = container;
  let args = [];

  if (shouldHoistVariables) {
    (0, _helperHoistVariables.default)(path, id => scope.push({
      id
    }));
  }

  const state = {
    foundThis: false,
    foundArguments: false
  };
  path.traverse(visitor, state);

  if (state.foundArguments || state.foundThis) {
    callee = t.memberExpression(container, t.identifier("apply"));
    args = [];

    if (state.foundThis) {
      args.push(t.thisExpression());
    }

    if (state.foundArguments) {
      if (!state.foundThis) args.push(t.nullLiteral());
      args.push(t.identifier("arguments"));
    }
  }

  let call = t.callExpression(callee, args);
  if (node.generator) call = t.yieldExpression(call, true);
  return t.returnStatement(call);
}