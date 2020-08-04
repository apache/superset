"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginTransformReactJsx = _interopRequireDefault(require("@babel/plugin-transform-react-jsx"));

var _pluginTransformReactJsxDevelopment = _interopRequireDefault(require("@babel/plugin-transform-react-jsx-development"));

var _pluginTransformReactDisplayName = _interopRequireDefault(require("@babel/plugin-transform-react-display-name"));

var _pluginTransformReactJsxSource = _interopRequireDefault(require("@babel/plugin-transform-react-jsx-source"));

var _pluginTransformReactJsxSelf = _interopRequireDefault(require("@babel/plugin-transform-react-jsx-self"));

var _pluginTransformReactPureAnnotations = _interopRequireDefault(require("@babel/plugin-transform-react-pure-annotations"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, opts) => {
  api.assertVersion(7);
  let {
    pragma,
    pragmaFrag
  } = opts;
  const {
    pure,
    throwIfNamespace = true,
    useSpread,
    runtime = "classic",
    importSource
  } = opts;

  if (runtime === "classic") {
    pragma = pragma || "React.createElement";
    pragmaFrag = pragmaFrag || "React.Fragment";
  }

  const development = !!opts.development;
  const useBuiltIns = !!opts.useBuiltIns;

  if (typeof development !== "boolean") {
    throw new Error("@babel/preset-react 'development' option must be a boolean.");
  }

  const transformReactJSXPlugin = runtime === "automatic" && development ? _pluginTransformReactJsxDevelopment.default : _pluginTransformReactJsx.default;
  return {
    plugins: [[transformReactJSXPlugin, {
      importSource,
      pragma,
      pragmaFrag,
      runtime,
      throwIfNamespace,
      useBuiltIns,
      useSpread,
      pure
    }], _pluginTransformReactDisplayName.default, pure !== false && _pluginTransformReactPureAnnotations.default, development && runtime === "classic" && _pluginTransformReactJsxSource.default, development && runtime === "classic" && _pluginTransformReactJsxSelf.default].filter(Boolean)
  };
});

exports.default = _default;