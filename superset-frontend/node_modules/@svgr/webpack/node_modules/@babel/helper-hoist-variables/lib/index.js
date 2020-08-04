"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var t = _interopRequireWildcard(require("@babel/types"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const visitor = {
  Scope(path, state) {
    if (state.kind === "let") path.skip();
  },

  Function(path) {
    path.skip();
  },

  VariableDeclaration(path, state) {
    if (state.kind && path.node.kind !== state.kind) return;
    const nodes = [];
    const declarations = path.get("declarations");
    let firstId;

    for (const declar of declarations) {
      firstId = declar.node.id;

      if (declar.node.init) {
        nodes.push(t.expressionStatement(t.assignmentExpression("=", declar.node.id, declar.node.init)));
      }

      for (const name of Object.keys(declar.getBindingIdentifiers())) {
        state.emit(t.identifier(name), name, declar.node.init !== null);
      }
    }

    if (path.parentPath.isFor({
      left: path.node
    })) {
      path.replaceWith(firstId);
    } else {
      path.replaceWithMultiple(nodes);
    }
  }

};

function _default(path, emit, kind = "var") {
  path.traverse(visitor, {
    kind,
    emit
  });
}