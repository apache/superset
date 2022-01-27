import _flatMap from "lodash/flatMap";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};





























export default function transformProps(chartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const { colorScheme, xAxisLabel, xAxisFormat, yAxisLabel, yAxisFormat } =
  formData;
  const data = queriesData[0].data;

  return {
    data: _flatMap(
    data.map((row) =>
    row.values.map((v) => ({
      ...v,
      name: row.key[0] })))),



    width,
    height,
    encoding: {
      x: {
        field: 'x',
        type: 'temporal',
        format: xAxisFormat,
        scale: {
          type: 'time' },

        axis: {
          orient: 'bottom',
          title: xAxisLabel } },


      y: {
        field: 'y',
        type: 'quantitative',
        format: yAxisFormat,
        scale: {
          type: 'linear' },

        axis: {
          orient: 'left',
          title: yAxisLabel } },


      stroke: {
        field: 'name',
        type: 'nominal',
        scale: {
          scheme: colorScheme },

        legend: true } } };



};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/Line/legacy/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();