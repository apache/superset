export var PandasAxis;
(function (PandasAxis) {
    PandasAxis[PandasAxis["Row"] = 0] = "Row";
    PandasAxis[PandasAxis["Column"] = 1] = "Column";
})(PandasAxis || (PandasAxis = {}));
export function isPostProcessingAggregation(rule) {
    return rule?.operation === 'aggregation';
}
export function isPostProcessingBoxplot(rule) {
    return rule?.operation === 'boxplot';
}
export function isPostProcessingContribution(rule) {
    return rule?.operation === 'contribution';
}
export function isPostProcessingPivot(rule) {
    return rule?.operation === 'pivot';
}
export function isPostProcessingProphet(rule) {
    return rule?.operation === 'prophet';
}
export function isPostProcessingDiff(rule) {
    return rule?.operation === 'diff';
}
export function isPostProcessingRolling(rule) {
    return rule?.operation === 'rolling';
}
export function isPostProcessingCum(rule) {
    return rule?.operation === 'cum';
}
export function isPostProcessingCompare(rule) {
    return rule?.operation === 'compare';
}
export function isPostProcessingSort(rule) {
    return rule?.operation === 'sort';
}
export function isPostProcessingResample(rule) {
    return rule?.operation === 'resample';
}
//# sourceMappingURL=PostProcessing.js.map