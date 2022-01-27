import _pick from "lodash/pick";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};
























export default function transformProps(chartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const { margin, theme } = formData;
  const encoding = formData.encoding;

  const data = queriesData[0].data.map(
  ({ label, values }) => ({
    label,
    min: values.whisker_low,
    max: values.whisker_high,
    firstQuartile: values.Q1,
    median: values.Q2,
    thirdQuartile: values.Q3,
    outliers: values.outliers }));



  const isHorizontal = encoding.y.type === 'nominal';

  const boxPlotValues = data.reduce((r, e) => {
    r.push(e.min, e.max, ...e.outliers);

    return r;
  }, []);

  const minBoxPlotValue = Math.min(...boxPlotValues);
  const maxBoxPlotValue = Math.max(...boxPlotValues);
  const valueDomain = [
  minBoxPlotValue - 0.1 * Math.abs(minBoxPlotValue),
  maxBoxPlotValue + 0.1 * Math.abs(maxBoxPlotValue)];


  if (isHorizontal) {
    if (encoding.x.scale) {
      encoding.x.scale.domain = valueDomain;
    } else {
      encoding.x.scale = { domain: valueDomain };
    }
  } else if (encoding.y.scale) {
    encoding.y.scale.domain = valueDomain;
  } else {
    encoding.y.scale = { domain: valueDomain };
  }

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
    margin,
    theme,
    encoding,
    ..._pick(hooks, fieldsFromHooks) };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/BoxPlot/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();