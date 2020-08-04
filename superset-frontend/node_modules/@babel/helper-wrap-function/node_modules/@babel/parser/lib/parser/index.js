"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _options = require("../options");

var _statement = _interopRequireDefault(require("./statement"));

var _scopeflags = require("../util/scopeflags");

var _scope = _interopRequireDefault(require("../util/scope"));

var _classScope = _interopRequireDefault(require("../util/class-scope"));

var _productionParameter = _interopRequireWildcard(require("../util/production-parameter"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Parser extends _statement.default {
  constructor(options, input) {
    options = (0, _options.getOptions)(options);
    super(options, input);
    const ScopeHandler = this.getScopeHandler();
    this.options = options;
    this.inModule = this.options.sourceType === "module";
    this.scope = new ScopeHandler(this.raise.bind(this), this.inModule);
    this.prodParam = new _productionParameter.default();
    this.classScope = new _classScope.default(this.raise.bind(this));
    this.plugins = pluginsMap(this.options.plugins);
    this.filename = options.sourceFilename;
  }

  getScopeHandler() {
    return _scope.default;
  }

  parse() {
    let paramFlags = _productionParameter.PARAM;

    if (this.hasPlugin("topLevelAwait") && this.inModule) {
      paramFlags |= _productionParameter.PARAM_AWAIT;
    }

    this.scope.enter(_scopeflags.SCOPE_PROGRAM);
    this.prodParam.enter(paramFlags);
    const file = this.startNode();
    const program = this.startNode();
    this.nextToken();
    file.errors = null;
    this.parseTopLevel(file, program);
    file.errors = this.state.errors;
    return file;
  }

}

exports.default = Parser;

function pluginsMap(plugins) {
  const pluginMap = new Map();

  for (let _i = 0; _i < plugins.length; _i++) {
    const plugin = plugins[_i];
    const [name, options] = Array.isArray(plugin) ? plugin : [plugin, {}];
    if (!pluginMap.has(name)) pluginMap.set(name, options || {});
  }

  return pluginMap;
}