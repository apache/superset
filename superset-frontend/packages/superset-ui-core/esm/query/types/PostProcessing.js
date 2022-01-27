(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};














































export let PandasAxis;(function (PandasAxis) {PandasAxis[PandasAxis["Row"] = 0] = "Row";PandasAxis[PandasAxis["Column"] = 1] = "Column";})(PandasAxis || (PandasAxis = {}));













































































































































export function isPostProcessingAggregation(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'aggregation';
}

export function isPostProcessingBoxplot(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'boxplot';
}

export function isPostProcessingContribution(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'contribution';
}

export function isPostProcessingPivot(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'pivot';
}

export function isPostProcessingProphet(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'prophet';
}

export function isPostProcessingDiff(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'diff';
}

export function isPostProcessingRolling(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'rolling';
}

export function isPostProcessingCum(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'cum';
}

export function isPostProcessingCompare(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'compare';
}

export function isPostProcessingSort(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'sort';
}

export function isPostProcessingResample(
rule)
{
  return (rule == null ? void 0 : rule.operation) === 'resample';
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(isPostProcessingAggregation, "isPostProcessingAggregation", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingBoxplot, "isPostProcessingBoxplot", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingContribution, "isPostProcessingContribution", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingPivot, "isPostProcessingPivot", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingProphet, "isPostProcessingProphet", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingDiff, "isPostProcessingDiff", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingRolling, "isPostProcessingRolling", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingCum, "isPostProcessingCum", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingCompare, "isPostProcessingCompare", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingSort, "isPostProcessingSort", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");reactHotLoader.register(isPostProcessingResample, "isPostProcessingResample", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/PostProcessing.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();