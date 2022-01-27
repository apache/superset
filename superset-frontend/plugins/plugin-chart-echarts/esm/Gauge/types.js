(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};























import { DEFAULT_LEGEND_FORM_DATA } from '../types';































export const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  rowLimit: 10,
  minVal: 0,
  maxVal: 100,
  fontSize: 15,
  numberFormat: 'SMART_NUMBER',
  animation: true,
  showProgress: true,
  overlap: true,
  roundCap: false,
  showAxisTick: false,
  showSplitLine: false,
  splitNumber: 10,
  startAngle: 225,
  endAngle: -45,
  showPointer: true,
  intervals: '',
  intervalColorIndices: '',
  valueFormatter: '{value}',
  emitFilter: false };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Gauge/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();