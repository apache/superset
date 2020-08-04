"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.injectInitialization = injectInitialization;
exports.extractComputedKeys = extractComputedKeys;

var _core = require("@babel/core");

var _helperReplaceSupers = require("@babel/helper-replace-supers");

const findBareSupers = _core.traverse.visitors.merge([{
  Super(path) {
    const {
      node,
      parentPath
    } = path;

    if (parentPath.isCallExpression({
      callee: node
    })) {
      this.push(parentPath);
    }
  }

}, _helperReplaceSupers.environmentVisitor]);

const referenceVisitor = {
  "TSTypeAnnotation|TypeAnnotation"(path) {
    path.skip();
  },

  ReferencedIdentifier(path) {
    if (this.scope.hasOwnBinding(path.node.name)) {
      this.scope.rename(path.node.name);
      path.skip();
    }
  }

};

function handleClassTDZ(path, state) {
  if (state.classBinding && state.classBinding === path.scope.getBinding(path.node.name)) {
    const classNameTDZError = state.file.addHelper("classNameTDZError");

    const throwNode = _core.types.callExpression(classNameTDZError, [_core.types.stringLiteral(path.node.name)]);

    path.replaceWith(_core.types.sequenceExpression([throwNode, path.node]));
    path.skip();
  }
}

const classFieldDefinitionEvaluationTDZVisitor = {
  ReferencedIdentifier: handleClassTDZ
};

function injectInitialization(path, constructor, nodes, renamer) {
  if (!nodes.length) return;
  const isDerived = !!path.node.superClass;

  if (!constructor) {
    const newConstructor = _core.types.classMethod("constructor", _core.types.identifier("constructor"), [], _core.types.blockStatement([]));

    if (isDerived) {
      newConstructor.params = [_core.types.restElement(_core.types.identifier("args"))];
      newConstructor.body.body.push(_core.template.statement.ast`super(...args)`);
    }

    [constructor] = path.get("body").unshiftContainer("body", newConstructor);
  }

  if (renamer) {
    renamer(referenceVisitor, {
      scope: constructor.scope
    });
  }

  if (isDerived) {
    const bareSupers = [];
    constructor.traverse(findBareSupers, bareSupers);

    for (const bareSuper of bareSupers) {
      bareSuper.insertAfter(nodes);
    }
  } else {
    constructor.get("body").unshiftContainer("body", nodes);
  }
}

function extractComputedKeys(ref, path, computedPaths, file) {
  const declarations = [];
  const state = {
    classBinding: path.node.id && path.scope.getBinding(path.node.id.name),
    file
  };

  for (const computedPath of computedPaths) {
    const computedKey = computedPath.get("key");

    if (computedKey.isReferencedIdentifier()) {
      handleClassTDZ(computedKey, state);
    } else {
      computedKey.traverse(classFieldDefinitionEvaluationTDZVisitor, state);
    }

    const computedNode = computedPath.node;

    if (!computedKey.isConstantExpression()) {
      const ident = path.scope.generateUidIdentifierBasedOnNode(computedNode.key);
      path.scope.push({
        id: ident,
        kind: "let"
      });
      declarations.push(_core.types.expressionStatement(_core.types.assignmentExpression("=", _core.types.cloneNode(ident), computedNode.key)));
      computedNode.key = _core.types.cloneNode(ident);
    }
  }

  return declarations;
}