(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export const COLOR_SATURATION = [0.7, 0.4];
export const LABEL_FONTSIZE = 11;
export const BORDER_WIDTH = 2;
export const GAP_WIDTH = 2;
export const BORDER_COLOR = '#fff';

export const extractTreePathInfo = (
treePathInfo) =>
{
  const treePath = (treePathInfo != null ? treePathInfo : []).
  map((pathInfo) => (pathInfo == null ? void 0 : pathInfo.name) || '').
  filter((path) => path !== '');

  // the 1st tree path is metric label
  const metricLabel = treePath.shift() || '';
  return { metricLabel, treePath };
};;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(COLOR_SATURATION, "COLOR_SATURATION", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/constants.ts");reactHotLoader.register(LABEL_FONTSIZE, "LABEL_FONTSIZE", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/constants.ts");reactHotLoader.register(BORDER_WIDTH, "BORDER_WIDTH", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/constants.ts");reactHotLoader.register(GAP_WIDTH, "GAP_WIDTH", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/constants.ts");reactHotLoader.register(BORDER_COLOR, "BORDER_COLOR", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/constants.ts");reactHotLoader.register(extractTreePathInfo, "extractTreePathInfo", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Treemap/constants.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();