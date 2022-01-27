import _pick from "lodash/pick";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






















export default function transformProps(chartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const { encoding, margin, theme } = formData;
  const { data } = queriesData[0];
  const hooks = chartProps.hooks;

  const fieldsFromHooks = [
  'TooltipRenderer',
  'LegendRenderer',
  'LegendGroupRenderer',
  'LegendItemRenderer',
  'LegendItemMarkRenderer',
  'LegendItemLabelRenderer'];


  return {
    data,
    width,
    height,
    encoding,
    margin,
    theme,
    ..._pick(hooks, fieldsFromHooks) };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/ScatterPlot/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();