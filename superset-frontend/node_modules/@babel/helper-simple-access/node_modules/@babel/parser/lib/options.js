"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOptions = getOptions;
exports.defaultOptions = void 0;
const defaultOptions = {
  sourceType: "script",
  sourceFilename: undefined,
  startLine: 1,
  allowAwaitOutsideFunction: false,
  allowReturnOutsideFunction: false,
  allowImportExportEverywhere: false,
  allowSuperOutsideMethod: false,
  allowUndeclaredExports: false,
  plugins: [],
  strictMode: null,
  ranges: false,
  tokens: false,
  createParenthesizedExpressions: false,
  errorRecovery: false
};
exports.defaultOptions = defaultOptions;

function getOptions(opts) {
  const options = {};

  for (let _i = 0, _Object$keys = Object.keys(defaultOptions); _i < _Object$keys.length; _i++) {
    const key = _Object$keys[_i];
    options[key] = opts && opts[key] != null ? opts[key] : defaultOptions[key];
  }

  return options;
}