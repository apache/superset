import _flatMap from "lodash/flatMap";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};
































export default function transformProps(chartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    maxBubbleSize,
    showLegend,
    xAxisFormat,
    xAxisLabel,
    // TODO: These fields are not supported yet
    // xAxisShowminmax,
    // xLogScale,
    yAxisLabel,
    yAxisFormat
    // TODO: These fields are not supported yet
    // yAxisShowminmax,
    // yLogScale,
  } = formData;
  const x = formData.x;
  const y = formData.y;
  const series = formData.series;
  const size = formData.size;
  const entity = formData.entity;
  const data = queriesData[0].data;

  return {
    data: _flatMap(
    data.map((row) =>
    row.values.map((v) => ({
      [x]: v[x],
      [y]: v[y],
      [series]: v[series],
      [size]: v[size],
      [entity]: v[entity] })))),



    width,
    height,
    encoding: {
      x: {
        field: x,
        type: 'quantitive',
        format: xAxisFormat,
        scale: {
          type: 'linear' },

        axis: {
          orient: 'bottom',
          title: xAxisLabel } },


      y: {
        field: y,
        type: 'quantitative',
        format: yAxisFormat,
        scale: {
          type: 'linear' },

        axis: {
          orient: 'left',
          title: yAxisLabel } },


      size: {
        field: size,
        type: 'quantitative',
        scale: {
          type: 'linear',
          range: [0, maxBubbleSize] } },


      fill: {
        field: series,
        type: 'nominal',
        scale: {
          scheme: colorScheme },

        legend: showLegend },

      group: [{ field: entity }] } };


};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/ScatterPlot/legacy/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();