(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export const prophetOperator =

(formData, queryObject) => {
  if (formData.forecastEnabled) {
    return {
      operation: 'prophet',
      options: {
        time_grain: formData.time_grain_sqla,
        periods: parseInt(formData.forecastPeriods, 10),
        confidence_interval: parseFloat(formData.forecastInterval),
        yearly_seasonality: formData.forecastSeasonalityYearly,
        weekly_seasonality: formData.forecastSeasonalityWeekly,
        daily_seasonality: formData.forecastSeasonalityDaily } };


  }
  return undefined;
};;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(prophetOperator, "prophetOperator", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/operators/prophetOperator.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();