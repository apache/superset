(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




























import { LabelPositionEnum } from '../types';















export let EchartsTreemapLabelType;(function (EchartsTreemapLabelType) {EchartsTreemapLabelType["Key"] = "key";EchartsTreemapLabelType["Value"] = "value";EchartsTreemapLabelType["KeyValue"] = "key_value";})(EchartsTreemapLabelType || (EchartsTreemapLabelType = {}));










export const DEFAULT_FORM_DATA = {
  groupby: [],
  labelType: EchartsTreemapLabelType.KeyValue,
  labelPosition: LabelPositionEnum.InsideTopLeft,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  showUpperLabels: true,
  dateFormat: 'smart_date',
  emitFilter: false };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();