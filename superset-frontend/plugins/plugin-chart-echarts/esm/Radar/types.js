(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



























import {
DEFAULT_LEGEND_FORM_DATA,

LabelPositionEnum,
LegendOrientation,
LegendType } from
'../types';





















export let EchartsRadarLabelType;(function (EchartsRadarLabelType) {EchartsRadarLabelType["Value"] = "value";EchartsRadarLabelType["KeyValue"] = "key_value";})(EchartsRadarLabelType || (EchartsRadarLabelType = {}));









// @ts-ignore
export const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  labelType: EchartsRadarLabelType.Value,
  labelPosition: LabelPositionEnum.Top,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  emitFilter: false,
  dateFormat: 'smart_date',
  isCircle: false };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Radar/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();