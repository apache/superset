(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};













































export let ForecastSeriesEnum;(function (ForecastSeriesEnum) {ForecastSeriesEnum["Observation"] = "";ForecastSeriesEnum["ForecastTrend"] = "__yhat";ForecastSeriesEnum["ForecastUpper"] = "__yhat_upper";ForecastSeriesEnum["ForecastLower"] = "__yhat_lower";})(ForecastSeriesEnum || (ForecastSeriesEnum = {}));











export let LegendOrientation;(function (LegendOrientation) {LegendOrientation["Top"] = "top";LegendOrientation["Bottom"] = "bottom";LegendOrientation["Left"] = "left";LegendOrientation["Right"] = "right";})(LegendOrientation || (LegendOrientation = {}));






export let LegendType;(function (LegendType) {LegendType["Scroll"] = "scroll";LegendType["Plain"] = "plain";})(LegendType || (LegendType = {}));



















export const DEFAULT_LEGEND_FORM_DATA = {
  legendMargin: null,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: false };




export let LabelPositionEnum;(function (LabelPositionEnum) {LabelPositionEnum["Top"] = "top";LabelPositionEnum["Left"] = "left";LabelPositionEnum["Right"] = "right";LabelPositionEnum["Bottom"] = "bottom";LabelPositionEnum["Inside"] = "inside";LabelPositionEnum["InsideLeft"] = "insideLeft";LabelPositionEnum["InsideRight"] = "insideRight";LabelPositionEnum["InsideTop"] = "insideTop";LabelPositionEnum["InsideBottom"] = "insideBottom";LabelPositionEnum["InsideTopLeft"] = "insideTopLeft";LabelPositionEnum["InsideBottomLeft"] = "insideBottomLeft";LabelPositionEnum["InsideTopRight"] = "insideTopRight";LabelPositionEnum["InsideBottomRight"] = "insideBottomRight";})(LabelPositionEnum || (LabelPositionEnum = {}));




































export const DEFAULT_TITLE_FORM_DATA = {
  xAxisTitle: '',
  xAxisTitleMargin: 0,
  yAxisTitle: '',
  yAxisTitleMargin: 0,
  yAxisTitlePosition: 'Top' };


export * from './Timeseries/types';;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_LEGEND_FORM_DATA, "DEFAULT_LEGEND_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/types.ts");reactHotLoader.register(DEFAULT_TITLE_FORM_DATA, "DEFAULT_TITLE_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();