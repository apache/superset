"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

const TRACE_ID = "__self";

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);
  const visitor = {
    JSXOpeningElement({
      node
    }) {
      const id = _core.types.jsxIdentifier(TRACE_ID);

      const trace = _core.types.thisExpression();

      node.attributes.push(_core.types.jsxAttribute(id, _core.types.jsxExpressionContainer(trace)));
    }

  };
  return {
    name: "transform-react-jsx-self",
    visitor: {
      Program(path) {
        path.traverse(visitor);
      }

    }
  };
});

exports.default = _default;