(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};


























import {
DEFAULT_LEGEND_FORM_DATA,

LegendOrientation,
LegendType } from
'../types';





















export let EchartsPieLabelType;(function (EchartsPieLabelType) {EchartsPieLabelType["Key"] = "key";EchartsPieLabelType["Value"] = "value";EchartsPieLabelType["Percent"] = "percent";EchartsPieLabelType["KeyValue"] = "key_value";EchartsPieLabelType["KeyPercent"] = "key_percent";EchartsPieLabelType["KeyValuePercent"] = "key_value_percent";})(EchartsPieLabelType || (EchartsPieLabelType = {}));













// @ts-ignore
export const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  donut: false,
  groupby: [],
  innerRadius: 30,
  labelLine: false,
  labelType: EchartsPieLabelType.Key,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  outerRadius: 70,
  showLabels: true,
  labelsOutside: true,
  showLabelsThreshold: 5,
  emitFilter: false,
  dateFormat: 'smart_date' };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Pie/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();