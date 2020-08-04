"use strict";

exports.__esModule = true;
exports.expandState = expandState;

var _path = _interopRequireDefault(require("path"));

var _camelcase = _interopRequireDefault(require("camelcase"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const validCharacters = /[^a-zA-Z0-9_-]/g;

function getComponentName(state) {
  if (!state.filePath) return 'SvgComponent';
  const pascalCaseFileName = (0, _camelcase.default)(_path.default.parse(state.filePath).name.replace(validCharacters, ''), {
    pascalCase: true
  });
  return `Svg${pascalCaseFileName}`;
}

function expandState(state) {
  return _extends({
    componentName: state.componentName || getComponentName(state)
  }, state);
}