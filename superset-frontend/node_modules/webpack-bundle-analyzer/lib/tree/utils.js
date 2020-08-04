"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getModulePathParts = getModulePathParts;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MULTI_MODULE_REGEXP = /^multi /u;

function getModulePathParts(moduleData) {
  if (MULTI_MODULE_REGEXP.test(moduleData.identifier)) {
    return [moduleData.identifier];
  }

  const parsedPath = _lodash.default // Removing loaders from module path: they're joined by `!` and the last part is a raw module path
  .last(moduleData.name.split('!')) // Splitting module path into parts
  .split('/') // Removing first `.`
  .slice(1) // Replacing `~` with `node_modules`
  .map(part => part === '~' ? 'node_modules' : part);

  return parsedPath.length ? parsedPath : null;
}