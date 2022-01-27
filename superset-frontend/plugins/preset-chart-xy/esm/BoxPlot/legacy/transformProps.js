(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};









































export default function transformProps(chartProps) {
  const { width, height, datasource, formData, queriesData } = chartProps;
  const { verboseMap = {} } = datasource;
  const { colorScheme, groupby = [], metrics = [] } = formData;

  const data = (queriesData[0].data || []).map(({ label, values }) => ({
    label,
    min: values.whisker_low,
    max: values.whisker_high,
    firstQuartile: values.Q1,
    median: values.Q2,
    thirdQuartile: values.Q3,
    outliers: values.outliers }));


  const xAxisLabel = groupby.join('/');

  let metric = '';
  if (Array.isArray(metrics)) {
    metric = metrics.length > 0 ? metrics[0] : '';
  } else {
    metric = metrics;
  }
  const yAxisLabel =
  typeof metric === 'string' ? verboseMap[metric] || metric : metric.label;

  const boxPlotValues = data.reduce((r, e) => {
    r.push(e.min, e.max, ...e.outliers);

    return r;
  }, []);

  const minBoxPlotValue = Math.min(...boxPlotValues);
  const maxBoxPlotValue = Math.max(...boxPlotValues);
  const valueDomain = [
  minBoxPlotValue - 0.1 * Math.abs(minBoxPlotValue),
  maxBoxPlotValue + 0.1 * Math.abs(maxBoxPlotValue)];


  return {
    data,
    width,
    height,
    encoding: {
      x: {
        field: 'label',
        type: 'nominal',
        scale: {
          type: 'band',
          paddingInner: 0.15,
          paddingOuter: 0.3 },

        axis: {
          title: xAxisLabel } },


      y: {
        field: 'value',
        type: 'quantitative',
        scale: {
          type: 'linear',
          domain: valueDomain },

        axis: {
          title: yAxisLabel,
          numTicks: 5,
          format: 'SMART_NUMBER' } },


      color: {
        field: 'label',
        type: 'nominal',
        scale: {
          scheme: colorScheme },

        legend: false } } };



};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/BoxPlot/legacy/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();