(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















export const DEFAULT_GRAPH_SERIES_OPTION = {
  zoom: 0.7,
  circular: { rotateLabel: true },
  force: {
    initLayout: 'circular',
    layoutAnimation: true },

  label: {
    show: true,
    position: 'right',
    distance: 5,
    rotate: 0,
    offset: [0, 0],
    fontStyle: 'normal',
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    fontSize: 12,
    padding: [0, 0, 0, 0],
    overflow: 'truncate',
    formatter: '{b}' },

  emphasis: {
    focus: 'adjacency' },

  animation: true,
  animationDuration: 500,
  animationEasing: 'cubicOut',
  lineStyle: { color: 'source', curveness: 0.1 },
  select: {
    itemStyle: { borderWidth: 3, opacity: 1 },
    label: { fontWeight: 'bolder' } },

  // Ref: https://echarts.apache.org/en/option.html#series-graph.data.tooltip.formatter
  //   - b: data name
  //   - c: data value
  tooltip: { formatter: '{b}: {c}' } };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_GRAPH_SERIES_OPTION, "DEFAULT_GRAPH_SERIES_OPTION", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Graph/constants.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();