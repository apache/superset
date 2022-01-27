(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















import {
DEFAULT_LEGEND_FORM_DATA,

LegendOrientation,
LegendType } from
'../types';





























export const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  source: '',
  target: '',
  layout: 'force',
  roam: true,
  draggable: false,
  selectedMode: 'single',
  showSymbolThreshold: 0,
  repulsion: 1000,
  gravity: 0.3,
  edgeSymbol: 'none,arrow',
  edgeLength: 400,
  baseEdgeWidth: 3,
  baseNodeSize: 20,
  friction: 0.2,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Graph/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();