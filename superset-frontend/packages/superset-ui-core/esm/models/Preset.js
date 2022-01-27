(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export default class Preset {








  constructor(
  config =




  {})
  {this.name = void 0;this.description = void 0;this.presets = void 0;this.plugins = void 0;
    const { name = '', description = '', presets = [], plugins = [] } = config;
    this.name = name;
    this.description = description;
    this.presets = presets;
    this.plugins = plugins;
  }

  register() {
    this.presets.forEach((preset) => {
      preset.register();
    });
    this.plugins.forEach((plugin) => {
      plugin.register();
    });

    return this;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(Preset, "Preset", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/models/Preset.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();