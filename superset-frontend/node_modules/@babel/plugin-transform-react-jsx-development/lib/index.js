"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pluginSyntaxJsx = _interopRequireDefault(require("@babel/plugin-syntax-jsx"));

var _helperBuilderReactJsxExperimental = require("@babel/helper-builder-react-jsx-experimental");

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  const PURE_ANNOTATION = options.pure;
  const visitor = (0, _helperBuilderReactJsxExperimental.helper)(api, Object.assign(Object.assign({
    pre(state) {
      const tagName = state.tagName;
      const args = state.args;

      if (_core.types.react.isCompatTag(tagName)) {
        args.push(_core.types.stringLiteral(tagName));
      } else {
        args.push(state.tagExpr);
      }
    },

    post(state, pass) {
      if (pass.get("@babel/plugin-react-jsx/runtime") === "classic") {
        state.createElementCallee = pass.get("@babel/plugin-react-jsx/createElementIdentifier")();
        state.pure = PURE_ANNOTATION != null ? PURE_ANNOTATION : !pass.get("@babel/plugin-react-jsx/pragmaSet");
      } else {
        state.jsxCallee = pass.get("@babel/plugin-react-jsx/jsxIdentifier")();
        state.jsxStaticCallee = pass.get("@babel/plugin-react-jsx/jsxStaticIdentifier")();
        state.createElementCallee = pass.get("@babel/plugin-react-jsx/createElementIdentifier")();
        state.pure = PURE_ANNOTATION != null ? PURE_ANNOTATION : !pass.get("@babel/plugin-react-jsx/importSourceSet");
      }
    }

  }, options), {}, {
    development: true
  }));
  return {
    name: "transform-react-jsx",
    inherits: _pluginSyntaxJsx.default,
    visitor
  };
});

exports.default = _default;