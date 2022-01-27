(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






















function getMetricLabel(
metric)
{
  if (typeof metric === 'string' || typeof metric === 'undefined') {
    return metric;
  }
  if (Array.isArray(metric)) {
    return metric.length > 0 ? getMetricLabel(metric[0]) : undefined;
  }

  return metric.label;
}

export default function transformProps(chartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    metric,
    rotation,
    series,
    sizeFrom = 0,
    sizeTo } =
  formData;

  const metricLabel = getMetricLabel(metric);

  const encoding = {
    color: {
      field: series,
      scale: {
        scheme: colorScheme },

      type: 'nominal' },

    fontSize:
    typeof metricLabel === 'undefined' ?
    undefined :
    {
      field: metricLabel,
      scale: {
        range: [sizeFrom, sizeTo],
        zero: true },

      type: 'quantitative' },

    text: {
      field: series } };



  return {
    data: queriesData[0].data,
    encoding,
    height,
    rotation,
    width };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getMetricLabel, "getMetricLabel", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/legacyPlugin/transformProps.ts");reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/legacyPlugin/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();