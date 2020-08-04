"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rewriteThis;

var _helperReplaceSupers = require("@babel/helper-replace-supers");

function rewriteThis(programPath) {
  programPath.traverse(rewriteThisVisitor);
}

const rewriteThisVisitor = {
  ThisExpression(path) {
    path.replaceWith(path.scope.buildUndefinedNode());
  },

  Function(path) {
    if (path.isMethod()) (0, _helperReplaceSupers.skipAllButComputedKey)(path);else if (!path.isArrowFunctionExpression()) path.skip();
  },

  ClassProperty(path) {
    (0, _helperReplaceSupers.skipAllButComputedKey)(path);
  },

  ClassPrivateProperty(path) {
    path.skip();
  }

};