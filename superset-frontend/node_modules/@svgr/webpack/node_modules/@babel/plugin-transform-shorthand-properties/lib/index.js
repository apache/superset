"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);
  return {
    name: "transform-shorthand-properties",
    visitor: {
      ObjectMethod(path) {
        const {
          node
        } = path;

        if (node.kind === "method") {
          const func = _core.types.functionExpression(null, node.params, node.body, node.generator, node.async);

          func.returnType = node.returnType;
          path.replaceWith(_core.types.objectProperty(node.key, func, node.computed));
        }
      },

      ObjectProperty({
        node
      }) {
        if (node.shorthand) {
          node.shorthand = false;
        }
      }

    }
  };
});

exports.default = _default;