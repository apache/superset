"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _Module = _interopRequireDefault(require("./Module"));

var _ContentModule = _interopRequireDefault(require("./ContentModule"));

var _ContentFolder = _interopRequireDefault(require("./ContentFolder"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class ConcatenatedModule extends _Module.default {
  constructor(name, data, parent) {
    super(name, data, parent);
    this.name += ' (concatenated)';
    this.children = Object.create(null);
    this.fillContentModules();
  }

  fillContentModules() {
    _lodash.default.each(this.data.modules, moduleData => this.addContentModule(moduleData));
  }

  addContentModule(moduleData) {
    const pathParts = (0, _utils.getModulePathParts)(moduleData);

    if (!pathParts) {
      return;
    }

    const [folders, fileName] = [pathParts.slice(0, -1), _lodash.default.last(pathParts)];
    let currentFolder = this;

    _lodash.default.each(folders, folderName => {
      let childFolder = currentFolder.getChild(folderName);

      if (!childFolder) {
        childFolder = currentFolder.addChildFolder(new _ContentFolder.default(folderName, this));
      }

      currentFolder = childFolder;
    });

    const module = new _ContentModule.default(fileName, moduleData, this);
    currentFolder.addChildModule(module);
  }

  getChild(name) {
    return this.children[name];
  }

  addChildModule(module) {
    module.parent = this;
    this.children[module.name] = module;
  }

  addChildFolder(folder) {
    folder.parent = this;
    this.children[folder.name] = folder;
    return folder;
  }

  mergeNestedFolders() {
    _lodash.default.invokeMap(this.children, 'mergeNestedFolders');
  }

  toChartData() {
    return _objectSpread({}, super.toChartData(), {
      concatenated: true,
      groups: _lodash.default.invokeMap(this.children, 'toChartData')
    });
  }

}

exports.default = ConcatenatedModule;
;