"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _helperExplodeAssignableExpression = _interopRequireDefault(require("@babel/helper-explode-assignable-expression"));

var t = _interopRequireWildcard(require("@babel/types"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(opts) {
  const {
    build,
    operator
  } = opts;
  return {
    AssignmentExpression(path) {
      const {
        node,
        scope
      } = path;
      if (node.operator !== operator + "=") return;
      const nodes = [];
      const exploded = (0, _helperExplodeAssignableExpression.default)(node.left, nodes, this, scope);
      nodes.push(t.assignmentExpression("=", exploded.ref, build(exploded.uid, node.right)));
      path.replaceWith(t.sequenceExpression(nodes));
    },

    BinaryExpression(path) {
      const {
        node
      } = path;

      if (node.operator === operator) {
        path.replaceWith(build(node.left, node.right));
      }
    }

  };
}