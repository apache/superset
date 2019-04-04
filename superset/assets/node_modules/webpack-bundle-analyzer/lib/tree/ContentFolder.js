"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseFolder = _interopRequireDefault(require("./BaseFolder"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class ContentFolder extends _BaseFolder.default {
  constructor(name, ownerModule, parent) {
    super(name, parent);
    this.ownerModule = ownerModule;
  }

  get parsedSize() {
    return this.getSize('parsedSize');
  }

  get gzipSize() {
    return this.getSize('gzipSize');
  }

  getSize(sizeType) {
    const ownerModuleSize = this.ownerModule[sizeType];

    if (ownerModuleSize !== undefined) {
      return Math.floor(this.size / this.ownerModule.size * ownerModuleSize);
    }
  }

  toChartData() {
    return _objectSpread({}, super.toChartData(), {
      parsedSize: this.parsedSize,
      gzipSize: this.gzipSize,
      inaccurateSizes: true
    });
  }

}

exports.default = ContentFolder;
;