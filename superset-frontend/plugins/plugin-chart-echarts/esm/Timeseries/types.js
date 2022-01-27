(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};

























import { sections } from '@superset-ui/chart-controls';
import {
DEFAULT_LEGEND_FORM_DATA,



DEFAULT_TITLE_FORM_DATA } from
'../types';

export let EchartsTimeseriesContributionType;(function (EchartsTimeseriesContributionType) {EchartsTimeseriesContributionType["Row"] = "row";EchartsTimeseriesContributionType["Column"] = "column";})(EchartsTimeseriesContributionType || (EchartsTimeseriesContributionType = {}));




export let EchartsTimeseriesSeriesType;(function (EchartsTimeseriesSeriesType) {EchartsTimeseriesSeriesType["Line"] = "line";EchartsTimeseriesSeriesType["Scatter"] = "scatter";EchartsTimeseriesSeriesType["Smooth"] = "smooth";EchartsTimeseriesSeriesType["Bar"] = "bar";EchartsTimeseriesSeriesType["Start"] = "start";EchartsTimeseriesSeriesType["Middle"] = "middle";EchartsTimeseriesSeriesType["End"] = "end";})(EchartsTimeseriesSeriesType || (EchartsTimeseriesSeriesType = {}));













































// @ts-ignore
export const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  annotationLayers: sections.annotationLayers,
  area: false,
  forecastEnabled: sections.FORECAST_DEFAULT_DATA.forecastEnabled,
  forecastInterval: sections.FORECAST_DEFAULT_DATA.forecastInterval,
  forecastPeriods: sections.FORECAST_DEFAULT_DATA.forecastPeriods,
  forecastSeasonalityDaily:
  sections.FORECAST_DEFAULT_DATA.forecastSeasonalityDaily,
  forecastSeasonalityWeekly:
  sections.FORECAST_DEFAULT_DATA.forecastSeasonalityWeekly,
  forecastSeasonalityYearly:
  sections.FORECAST_DEFAULT_DATA.forecastSeasonalityYearly,
  logAxis: false,
  markerEnabled: false,
  markerSize: 6,
  minorSplitLine: false,
  opacity: 0.2,
  orderDesc: true,
  rowLimit: 10000,
  seriesType: EchartsTimeseriesSeriesType.Line,
  stack: false,
  tooltipTimeFormat: 'smart_date',
  truncateYAxis: false,
  yAxisBounds: [null, null],
  zoomable: false,
  richTooltip: true,
  xAxisLabelRotation: 0,
  emitFilter: false,
  groupby: [],
  showValue: false,
  onlyTotal: false,
  ...DEFAULT_TITLE_FORM_DATA };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_FORM_DATA, "DEFAULT_FORM_DATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();