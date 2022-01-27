(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};























export default class Plugin {


  constructor() {this.config = void 0;
    this.config = {};
  }

  resetConfig() {
    // The child class can set default config
    // by overriding this function.
    this.config = {};

    return this;
  }

  configure(config, replace = false) {
    this.config = replace ? config : { ...this.config, ...config };

    return this;
  }

  register() {
    return this;
  }

  unregister() {
    return this;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(Plugin, "Plugin", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/models/Plugin.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();