(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};


























import {
DEFAULT_LEGEND_FORM_DATA,

LegendOrientation,
LegendType } from
'../types';
















export let EchartsFunnelLabelTypeType;(function (EchartsFunnelLabelTypeType) {EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["Key"] = 0] = "Key";EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["Value"] = 1] = "Value";EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["Percent"] = 2] = "Percent";EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["KeyValue"] = 3] = "KeyValue";EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["KeyPercent"] = 4] = "KeyPercent";EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["KeyValuePercent"] = 5] = "KeyValuePercent";})(EchartsFunnelLabelTypeType || (EchartsFunnelLabelTypeType = {}));













// @ts-ignore
export const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  labelLine: false,
  labelType: EchartsFunnelLabelTypeType.Key,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  sort: 'descending',
  orient: 'vertical',
  gap: 0,
  emitFilter: false };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Funnel/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();