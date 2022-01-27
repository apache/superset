(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






















export let AnnotationType;(function (AnnotationType) {AnnotationType["Event"] = "EVENT";AnnotationType["Formula"] = "FORMULA";AnnotationType["Interval"] = "INTERVAL";AnnotationType["Timeseries"] = "TIME_SERIES";})(AnnotationType || (AnnotationType = {}));






export let AnnotationSourceType;(function (AnnotationSourceType) {AnnotationSourceType["Line"] = "line";AnnotationSourceType["Native"] = "NATIVE";AnnotationSourceType["Table"] = "table";AnnotationSourceType["Undefined"] = "";})(AnnotationSourceType || (AnnotationSourceType = {}));






export let AnnotationOpacity;(function (AnnotationOpacity) {AnnotationOpacity["High"] = "opacityHigh";AnnotationOpacity["Low"] = "opacityLow";AnnotationOpacity["Medium"] = "opacityMedium";AnnotationOpacity["Undefined"] = "";})(AnnotationOpacity || (AnnotationOpacity = {}));






export let AnnotationStyle;(function (AnnotationStyle) {AnnotationStyle["Dashed"] = "dashed";AnnotationStyle["Dotted"] = "dotted";AnnotationStyle["Solid"] = "solid";AnnotationStyle["LongDashed"] = "longDashed";})(AnnotationStyle || (AnnotationStyle = {}));




















































































export function isFormulaAnnotationLayer(
layer)
{
  return layer.annotationType === AnnotationType.Formula;
}

export function isEventAnnotationLayer(
layer)
{
  return layer.annotationType === AnnotationType.Event;
}

export function isIntervalAnnotationLayer(
layer)
{
  return layer.annotationType === AnnotationType.Interval;
}

export function isTimeseriesAnnotationLayer(
layer)
{
  return layer.annotationType === AnnotationType.Timeseries;
}

export function isTableAnnotationLayer(
layer)
{
  return layer.sourceType === AnnotationSourceType.Table;
}














export function isTimeseriesAnnotationResult(
result)
{
  return Array.isArray(result);
}

export function isRecordAnnotationResult(
result)
{
  return 'columns' in result && 'records' in result;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(isFormulaAnnotationLayer, "isFormulaAnnotationLayer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");reactHotLoader.register(isEventAnnotationLayer, "isEventAnnotationLayer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");reactHotLoader.register(isIntervalAnnotationLayer, "isIntervalAnnotationLayer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");reactHotLoader.register(isTimeseriesAnnotationLayer, "isTimeseriesAnnotationLayer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");reactHotLoader.register(isTableAnnotationLayer, "isTableAnnotationLayer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");reactHotLoader.register(isTimeseriesAnnotationResult, "isTimeseriesAnnotationResult", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");reactHotLoader.register(isRecordAnnotationResult, "isRecordAnnotationResult", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/AnnotationLayer.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();