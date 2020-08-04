"use strict";

exports.__esModule = true;
exports.default = sandboxedEval;

var _vm = _interopRequireDefault(require("vm"));

var _underscore = _interopRequireDefault(require("underscore"));

var d3array = _interopRequireWildcard(require("d3-array"));

var colors = _interopRequireWildcard(require("./colors"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

// Objects exposed here should be treated like a public API
// if `underscore` had backwards incompatible changes in a future release, we'd
// have to be careful about bumping the library as those changes could break user charts
const GLOBAL_CONTEXT = {
  console,
  _: _underscore.default,
  colors,
  d3array
}; // Copied/modified from https://github.com/hacksparrow/safe-eval/blob/master/index.js

function sandboxedEval(code, context, opts) {
  const sandbox = {};
  const resultKey = "SAFE_EVAL_" + Math.floor(Math.random() * 1000000);
  sandbox[resultKey] = {};
  const codeToEval = resultKey + "=" + code;

  const sandboxContext = _extends({}, GLOBAL_CONTEXT, {}, context);

  Object.keys(sandboxContext).forEach(key => {
    sandbox[key] = sandboxContext[key];
  });

  try {
    _vm.default.runInNewContext(codeToEval, sandbox, opts);

    return sandbox[resultKey];
  } catch (error) {
    return () => error;
  }
}