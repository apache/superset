"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _helperAnnotateAsPure = _interopRequireDefault(require("@babel/helper-annotate-as-pure"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const PURE_CALLS = new Map([["react", ["cloneElement", "createElement", "createFactory", "createRef", "forwardRef", "isValidElement", "memo", "lazy"]], ["react-dom", ["createPortal"]]]);

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);
  return {
    name: "transform-react-pure-annotations",
    visitor: {
      CallExpression(path) {
        if (isReactCall(path)) {
          (0, _helperAnnotateAsPure.default)(path);
        }
      }

    }
  };
});

exports.default = _default;

function isReactCall(path) {
  if (!_core.types.isMemberExpression(path.node.callee)) {
    const callee = path.get("callee");

    for (const [module, methods] of PURE_CALLS) {
      for (const method of methods) {
        if (callee.referencesImport(module, method)) {
          return true;
        }
      }
    }

    return false;
  }

  for (const [module, methods] of PURE_CALLS) {
    const object = path.get("callee.object");

    if (object.referencesImport(module, "default") || object.referencesImport(module, "*")) {
      for (const method of methods) {
        if (_core.types.isIdentifier(path.node.callee.property, {
          name: method
        })) {
          return true;
        }
      }

      return false;
    }
  }

  return false;
}