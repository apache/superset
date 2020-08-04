"use strict";

exports.__esModule = true;
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _core = require("@superset-ui/core");

var _ChartMetadataRegistrySingleton = _interopRequireDefault(require("../registries/ChartMetadataRegistrySingleton"));

var _ChartBuildQueryRegistrySingleton = _interopRequireDefault(require("../registries/ChartBuildQueryRegistrySingleton"));

var _ChartComponentRegistrySingleton = _interopRequireDefault(require("../registries/ChartComponentRegistrySingleton"));

var _ChartControlPanelRegistrySingleton = _interopRequireDefault(require("../registries/ChartControlPanelRegistrySingleton"));

var _ChartTransformPropsRegistrySingleton = _interopRequireDefault(require("../registries/ChartTransformPropsRegistrySingleton"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function IDENTITY(x) {
  return x;
}

const EMPTY = {};

/**
 * Loaders of the form `() => import('foo')` may return esmodules
 * which require the value to be extracted as `module.default`
 * */
function sanitizeLoader(loader) {
  return () => {
    const loaded = loader();
    return loaded instanceof Promise ? loaded.then(module => 'default' in module && module.default || module) : loaded;
  };
}

class ChartPlugin extends _core.Plugin {
  constructor(config) {
    super();

    _defineProperty(this, "controlPanel", void 0);

    _defineProperty(this, "metadata", void 0);

    _defineProperty(this, "loadBuildQuery", void 0);

    _defineProperty(this, "loadTransformProps", void 0);

    _defineProperty(this, "loadChart", void 0);

    const {
      metadata,
      buildQuery,
      loadBuildQuery,
      transformProps = IDENTITY,
      loadTransformProps,
      Chart,
      loadChart,
      controlPanel = EMPTY
    } = config;
    this.controlPanel = controlPanel;
    this.metadata = metadata;
    this.loadBuildQuery = loadBuildQuery && sanitizeLoader(loadBuildQuery) || buildQuery && sanitizeLoader(() => buildQuery) || undefined;
    this.loadTransformProps = sanitizeLoader(loadTransformProps != null ? loadTransformProps : () => transformProps);

    if (loadChart) {
      this.loadChart = sanitizeLoader(loadChart);
    } else if (Chart) {
      this.loadChart = () => Chart;
    } else {
      throw new Error('Chart or loadChart is required');
    }
  }

  register() {
    const {
      key = (0, _core.isRequired)('config.key')
    } = this.config;
    (0, _ChartMetadataRegistrySingleton.default)().registerValue(key, this.metadata);
    (0, _ChartComponentRegistrySingleton.default)().registerLoader(key, this.loadChart);
    (0, _ChartControlPanelRegistrySingleton.default)().registerValue(key, this.controlPanel);
    (0, _ChartTransformPropsRegistrySingleton.default)().registerLoader(key, this.loadTransformProps);

    if (this.loadBuildQuery) {
      (0, _ChartBuildQueryRegistrySingleton.default)().registerLoader(key, this.loadBuildQuery);
    }

    return this;
  }

  unregister() {
    const {
      key = (0, _core.isRequired)('config.key')
    } = this.config;
    (0, _ChartMetadataRegistrySingleton.default)().remove(key);
    (0, _ChartComponentRegistrySingleton.default)().remove(key);
    (0, _ChartControlPanelRegistrySingleton.default)().remove(key);
    (0, _ChartTransformPropsRegistrySingleton.default)().remove(key);
    (0, _ChartBuildQueryRegistrySingleton.default)().remove(key);
    return this;
  }

  configure(config, replace) {
    super.configure(config, replace);
    return this;
  }

}

exports.default = ChartPlugin;