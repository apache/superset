(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};


























export default class ColorScheme {










  constructor({
    colors,
    description = '',
    id,
    label,
    isDefault })
  {this.colors = void 0;this.description = void 0;this.id = void 0;this.label = void 0;this.isDefault = void 0;
    this.id = id;
    this.label = label != null ? label : id;
    this.colors = colors;
    this.description = description;
    this.isDefault = isDefault;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ColorScheme, "ColorScheme", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/ColorScheme.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();