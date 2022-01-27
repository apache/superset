(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};















































export default class ChartMetadata {
































  constructor(config) {this.name = void 0;this.canBeAnnotationTypes = void 0;this.canBeAnnotationTypesLookup = void 0;this.credits = void 0;this.description = void 0;this.show = void 0;this.supportedAnnotationTypes = void 0;this.thumbnail = void 0;this.useLegacyApi = void 0;this.behaviors = void 0;this.datasourceCount = void 0;this.enableNoResults = void 0;this.deprecated = void 0;this.exampleGallery = void 0;this.tags = void 0;this.category = void 0;
    const {
      name,
      canBeAnnotationTypes = [],
      credits = [],
      description = '',
      show = true,
      supportedAnnotationTypes = [],
      thumbnail,
      useLegacyApi = false,
      behaviors = [],
      datasourceCount = 1,
      enableNoResults = true,
      deprecated = false,
      exampleGallery = [],
      tags = [],
      category = null } =
    config;

    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
    this.canBeAnnotationTypes = canBeAnnotationTypes;
    this.canBeAnnotationTypesLookup = canBeAnnotationTypes.reduce(
    (prev, type) => {
      const lookup = prev;
      lookup[type] = true;

      return lookup;
    },
    {});

    this.supportedAnnotationTypes = supportedAnnotationTypes;
    this.thumbnail = thumbnail;
    this.useLegacyApi = useLegacyApi;
    this.behaviors = behaviors;
    this.datasourceCount = datasourceCount;
    this.enableNoResults = enableNoResults;
    this.deprecated = deprecated;
    this.exampleGallery = exampleGallery;
    this.tags = tags;
    this.category = category;
  }

  canBeAnnotationType(type) {
    return this.canBeAnnotationTypesLookup[type] || false;
  }

  clone() {
    return new ChartMetadata(this);
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ChartMetadata, "ChartMetadata", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/models/ChartMetadata.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();