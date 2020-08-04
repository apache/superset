"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _helperRemapAsyncToGenerator = _interopRequireDefault(require("@babel/helper-remap-async-to-generator"));

var _helperModuleImports = require("@babel/helper-module-imports");

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  api.assertVersion(7);
  const {
    method,
    module
  } = options;

  if (method && module) {
    return {
      name: "transform-async-to-generator",
      visitor: {
        Function(path, state) {
          if (!path.node.async || path.node.generator) return;
          let wrapAsync = state.methodWrapper;

          if (wrapAsync) {
            wrapAsync = _core.types.cloneNode(wrapAsync);
          } else {
            wrapAsync = state.methodWrapper = (0, _helperModuleImports.addNamed)(path, method, module);
          }

          (0, _helperRemapAsyncToGenerator.default)(path, {
            wrapAsync
          });
        }

      }
    };
  }

  return {
    name: "transform-async-to-generator",
    visitor: {
      Function(path, state) {
        if (!path.node.async || path.node.generator) return;
        (0, _helperRemapAsyncToGenerator.default)(path, {
          wrapAsync: state.addHelper("asyncToGenerator")
        });
      }

    }
  };
});

exports.default = _default;