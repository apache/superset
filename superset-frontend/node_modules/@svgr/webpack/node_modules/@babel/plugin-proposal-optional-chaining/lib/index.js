"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginSyntaxOptionalChaining = _interopRequireDefault(require("@babel/plugin-syntax-optional-chaining"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  api.assertVersion(7);
  const {
    loose = false
  } = options;

  function isSimpleMemberExpression(expression) {
    return _core.types.isIdentifier(expression) || _core.types.isSuper(expression) || _core.types.isMemberExpression(expression) && !expression.computed && isSimpleMemberExpression(expression.object);
  }

  return {
    name: "proposal-optional-chaining",
    inherits: _pluginSyntaxOptionalChaining.default,
    visitor: {
      "OptionalCallExpression|OptionalMemberExpression"(path) {
        const {
          parentPath,
          scope
        } = path;
        let isDeleteOperation = false;
        const optionals = [];
        let optionalPath = path;

        while (optionalPath.isOptionalMemberExpression() || optionalPath.isOptionalCallExpression()) {
          const {
            node
          } = optionalPath;

          if (node.optional) {
            optionals.push(node);
          }

          if (optionalPath.isOptionalMemberExpression()) {
            optionalPath.node.type = "MemberExpression";
            optionalPath = optionalPath.get("object");
          } else if (optionalPath.isOptionalCallExpression()) {
            optionalPath.node.type = "CallExpression";
            optionalPath = optionalPath.get("callee");
          }

          if (optionalPath.isTSNonNullExpression()) {
            optionalPath = optionalPath.get("expression");
          }
        }

        let replacementPath = path;

        if (parentPath.isUnaryExpression({
          operator: "delete"
        })) {
          replacementPath = parentPath;
          isDeleteOperation = true;
        }

        for (let i = optionals.length - 1; i >= 0; i--) {
          const node = optionals[i];

          const isCall = _core.types.isCallExpression(node);

          const replaceKey = isCall ? "callee" : "object";
          const chain = node[replaceKey];
          let ref;
          let check;

          if (loose && isCall && isSimpleMemberExpression(chain)) {
            check = ref = chain;
          } else {
            ref = scope.maybeGenerateMemoised(chain);

            if (ref) {
              check = _core.types.assignmentExpression("=", _core.types.cloneNode(ref), chain);
              node[replaceKey] = ref;
            } else {
              check = ref = chain;
            }
          }

          if (isCall && _core.types.isMemberExpression(chain)) {
            if (loose && isSimpleMemberExpression(chain)) {
              node.callee = chain;
            } else {
              const {
                object
              } = chain;
              let context = scope.maybeGenerateMemoised(object);

              if (context) {
                chain.object = _core.types.assignmentExpression("=", context, object);
              } else if (_core.types.isSuper(object)) {
                context = _core.types.thisExpression();
              } else {
                context = object;
              }

              node.arguments.unshift(_core.types.cloneNode(context));
              node.callee = _core.types.memberExpression(node.callee, _core.types.identifier("call"));
            }
          }

          replacementPath.replaceWith(_core.types.conditionalExpression(loose ? _core.types.binaryExpression("==", _core.types.cloneNode(check), _core.types.nullLiteral()) : _core.types.logicalExpression("||", _core.types.binaryExpression("===", _core.types.cloneNode(check), _core.types.nullLiteral()), _core.types.binaryExpression("===", _core.types.cloneNode(ref), scope.buildUndefinedNode())), isDeleteOperation ? _core.types.booleanLiteral(true) : scope.buildUndefinedNode(), replacementPath.node));
          replacementPath = replacementPath.get("alternate");
        }
      }

    }
  };
});

exports.default = _default;