"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginSyntaxNullishCoalescingOperator = _interopRequireDefault(require("@babel/plugin-syntax-nullish-coalescing-operator"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, {
  loose = false
}) => {
  api.assertVersion(7);
  return {
    name: "proposal-nullish-coalescing-operator",
    inherits: _pluginSyntaxNullishCoalescingOperator.default,
    visitor: {
      LogicalExpression(path) {
        const {
          node,
          scope
        } = path;

        if (node.operator !== "??") {
          return;
        }

        let ref = scope.maybeGenerateMemoised(node.left);
        let assignment;

        if (ref === null) {
          ref = node.left;
          assignment = _core.types.cloneNode(node.left);
        } else {
          assignment = _core.types.assignmentExpression("=", ref, node.left);
        }

        path.replaceWith(_core.types.conditionalExpression(loose ? _core.types.binaryExpression("!=", assignment, _core.types.nullLiteral()) : _core.types.logicalExpression("&&", _core.types.binaryExpression("!==", assignment, _core.types.nullLiteral()), _core.types.binaryExpression("!==", _core.types.cloneNode(ref), scope.buildUndefinedNode())), _core.types.cloneNode(ref), node.right));
      }

    }
  };
});

exports.default = _default;