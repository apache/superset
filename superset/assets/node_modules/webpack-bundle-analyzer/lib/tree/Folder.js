"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _gzipSize = _interopRequireDefault(require("gzip-size"));

var _Module = _interopRequireDefault(require("./Module"));

var _BaseFolder = _interopRequireDefault(require("./BaseFolder"));

var _ConcatenatedModule = _interopRequireDefault(require("./ConcatenatedModule"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class Folder extends _BaseFolder.default {
  get parsedSize() {
    return this.src ? this.src.length : 0;
  }

  get gzipSize() {
    if (!_lodash.default.has(this, '_gzipSize')) {
      this._gzipSize = this.src ? _gzipSize.default.sync(this.src) : 0;
    }

    return this._gzipSize;
  }

  addModule(moduleData) {
    const pathParts = (0, _utils.getModulePathParts)(moduleData);

    if (!pathParts) {
      return;
    }

    const [folders, fileName] = [pathParts.slice(0, -1), _lodash.default.last(pathParts)];
    let currentFolder = this;

    _lodash.default.each(folders, folderName => {
      let childNode = currentFolder.getChild(folderName);

      if ( // Folder is not created yet
      !childNode || // In some situations (invalid usage of dynamic `require()`) webpack generates a module with empty require
      // context, but it's moduleId points to a directory in filesystem.
      // In this case we replace this `File` node with `Folder`.
      // See `test/stats/with-invalid-dynamic-require.json` as an example.
      !(childNode instanceof Folder)) {
        childNode = currentFolder.addChildFolder(new Folder(folderName));
      }

      currentFolder = childNode;
    });

    const ModuleConstructor = moduleData.modules ? _ConcatenatedModule.default : _Module.default;
    const module = new ModuleConstructor(fileName, moduleData, this);
    currentFolder.addChildModule(module);
  }

  toChartData() {
    return _objectSpread({}, super.toChartData(), {
      parsedSize: this.parsedSize,
      gzipSize: this.gzipSize
    });
  }

}

exports.default = Folder;
;