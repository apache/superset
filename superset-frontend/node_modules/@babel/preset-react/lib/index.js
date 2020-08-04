"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginTransformReactJsx = _interopRequireDefault(require("@babel/plugin-transform-react-jsx"));

var _pluginTransformReactDisplayName = _interopRequireDefault(require("@babel/plugin-transform-react-display-name"));

var _pluginTransformReactJsxSource = _interopRequireDefault(require("@babel/plugin-transform-react-jsx-source"));

var _pluginTransformReactJsxSelf = _interopRequireDefault(require("@babel/plugin-transform-react-jsx-self"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, opts) => {
  api.assertVersion(7);
  const pragma = opts.pragma || "React.createElement";
  const pragmaFrag = opts.pragmaFrag || "React.Fragment";
  const throwIfNamespace = opts.throwIfNamespace === undefined ? true : !!opts.throwIfNamespace;
  const development = !!opts.development;
  const useBuiltIns = !!opts.useBuiltIns;
  const {
    useSpread
  } = opts;

  if (typeof development !== "boolean") {
    throw new Error("@babel/preset-react 'development' option must be a boolean.");
  }

  return {
    plugins: [[_pluginTransformReactJsx.default, {
      pragma,
      pragmaFrag,
      throwIfNamespace,
      useBuiltIns,
      useSpread
    }], _pluginTransformReactDisplayName.default, development && _pluginTransformReactJsxSource.default, development && _pluginTransformReactJsxSelf.default].filter(Boolean)
  };
});

exports.default = _default;