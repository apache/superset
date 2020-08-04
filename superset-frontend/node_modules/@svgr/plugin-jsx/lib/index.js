"use strict";

exports.__esModule = true;
exports.default = jsxPlugin;

var _svgParser = require("svg-parser");

var _hastUtilToBabelAst = _interopRequireDefault(require("@svgr/hast-util-to-babel-ast"));

var _core = require("@babel/core");

var _babelPreset = _interopRequireDefault(require("@svgr/babel-preset"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function jsxPlugin(code, config, state) {
  const filePath = state.filePath || 'unknown';
  const hastTree = (0, _svgParser.parse)(code);
  const babelTree = (0, _hastUtilToBabelAst.default)(hastTree);
  const {
    code: generatedCode
  } = (0, _core.transformFromAstSync)(babelTree, code, _extends({
    caller: {
      name: 'svgr'
    },
    presets: [(0, _core.createConfigItem)([_babelPreset.default, _extends({}, config, {
      state
    })], {
      type: 'preset'
    })],
    filename: filePath,
    babelrc: false,
    configFile: false,
    code: true,
    ast: false,
    inputSourceMap: false
  }, config.jsx && config.jsx.babelConfig));
  return generatedCode;
}