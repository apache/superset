import _pick from "lodash/pick";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






















export default function transformProps(chartProps) {
  const { width, height, queriesData } = chartProps;
  const { data } = queriesData[0];
  const formData = chartProps.formData;
  const hooks = chartProps.hooks;

  /**
   * Use type-check to make sure the field names are expected ones
   * and only pick these fields to pass to the chart.
   */
  const fieldsFromFormData = [
  'encoding',
  'margin',
  'theme'];


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
    ..._pick(formData, fieldsFromFormData),
    ..._pick(hooks, fieldsFromHooks) };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/Line/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();