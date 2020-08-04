"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  api.assertVersion(7);
  const {
    allowMutablePropsOnTags
  } = options;

  if (allowMutablePropsOnTags != null && !Array.isArray(allowMutablePropsOnTags)) {
    throw new Error(".allowMutablePropsOnTags must be an array, null, or undefined.");
  }

  const HOISTED = new WeakSet();
  const immutabilityVisitor = {
    enter(path, state) {
      const stop = () => {
        state.isImmutable = false;
        path.stop();
      };

      if (path.isJSXClosingElement()) {
        path.skip();
        return;
      }

      if (path.isJSXIdentifier({
        name: "ref"
      }) && path.parentPath.isJSXAttribute({
        name: path.node
      })) {
        return stop();
      }

      if (path.isJSXIdentifier() || path.isIdentifier() || path.isJSXMemberExpression()) {
        return;
      }

      if (!path.isImmutable()) {
        if (path.isPure()) {
          const expressionResult = path.evaluate();

          if (expressionResult.confident) {
            const {
              value
            } = expressionResult;
            const isMutable = !state.mutablePropsAllowed && value && typeof value === "object" || typeof value === "function";

            if (!isMutable) {
              path.skip();
              return;
            }
          } else if (_core.types.isIdentifier(expressionResult.deopt)) {
            return;
          }
        }

        stop();
      }
    }

  };
  return {
    name: "transform-react-constant-elements",
    visitor: {
      JSXElement(path) {
        if (HOISTED.has(path.node)) return;
        HOISTED.add(path.node);
        const state = {
          isImmutable: true
        };

        if (allowMutablePropsOnTags != null) {
          let namePath = path.get("openingElement.name");

          while (namePath.isJSXMemberExpression()) {
            namePath = namePath.get("property");
          }

          const elementName = namePath.node.name;
          state.mutablePropsAllowed = allowMutablePropsOnTags.indexOf(elementName) > -1;
        }

        path.traverse(immutabilityVisitor, state);
        if (state.isImmutable) path.hoist();
      }

    }
  };
});

exports.default = _default;