"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.visitor = void 0;

var _core = require("@babel/core");

function getTDZStatus(refPath, bindingPath) {
  const executionStatus = bindingPath._guessExecutionStatusRelativeTo(refPath);

  if (executionStatus === "before") {
    return "outside";
  } else if (executionStatus === "after") {
    return "inside";
  } else {
    return "maybe";
  }
}

function buildTDZAssert(node, state) {
  return _core.types.callExpression(state.addHelper("temporalRef"), [node, _core.types.stringLiteral(node.name)]);
}

function isReference(node, scope, state) {
  const declared = state.letReferences[node.name];
  if (!declared) return false;
  return scope.getBindingIdentifier(node.name) === declared;
}

const visitor = {
  ReferencedIdentifier(path, state) {
    if (!state.tdzEnabled) return;
    const {
      node,
      parent,
      scope
    } = path;
    if (path.parentPath.isFor({
      left: node
    })) return;
    if (!isReference(node, scope, state)) return;
    const bindingPath = scope.getBinding(node.name).path;
    if (bindingPath.isFunctionDeclaration()) return;
    const status = getTDZStatus(path, bindingPath);
    if (status === "outside") return;

    if (status === "maybe") {
      const assert = buildTDZAssert(node, state);
      bindingPath.parent._tdzThis = true;
      path.skip();

      if (path.parentPath.isUpdateExpression()) {
        if (parent._ignoreBlockScopingTDZ) return;
        path.parentPath.replaceWith(_core.types.sequenceExpression([assert, parent]));
      } else {
        path.replaceWith(assert);
      }
    } else if (status === "inside") {
      path.replaceWith(_core.template.ast`${state.addHelper("tdz")}("${node.name}")`);
    }
  },

  AssignmentExpression: {
    exit(path, state) {
      if (!state.tdzEnabled) return;
      const {
        node
      } = path;
      if (node._ignoreBlockScopingTDZ) return;
      const nodes = [];
      const ids = path.getBindingIdentifiers();

      for (const name of Object.keys(ids)) {
        const id = ids[name];

        if (isReference(id, path.scope, state)) {
          nodes.push(id);
        }
      }

      if (nodes.length) {
        node._ignoreBlockScopingTDZ = true;
        nodes.push(node);
        path.replaceWithMultiple(nodes.map(n => _core.types.expressionStatement(n)));
      }
    }

  }
};
exports.visitor = visitor;