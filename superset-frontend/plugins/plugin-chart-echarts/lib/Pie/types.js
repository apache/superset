import { DEFAULT_LEGEND_FORM_DATA, LegendOrientation, LegendType, } from '../types';
export var EchartsPieLabelType;
(function (EchartsPieLabelType) {
    EchartsPieLabelType["Key"] = "key";
    EchartsPieLabelType["Value"] = "value";
    EchartsPieLabelType["Percent"] = "percent";
    EchartsPieLabelType["KeyValue"] = "key_value";
    EchartsPieLabelType["KeyPercent"] = "key_percent";
    EchartsPieLabelType["KeyValuePercent"] = "key_value_percent";
})(EchartsPieLabelType || (EchartsPieLabelType = {}));
// @ts-ignore
export const DEFAULT_FORM_DATA = {
    ...DEFAULT_LEGEND_FORM_DATA,
    donut: false,
    groupby: [],
    innerRadius: 30,
    labelLine: false,
    labelType: EchartsPieLabelType.Key,
    legendOrientation: LegendOrientation.Top,
    legendType: LegendType.Scroll,
    numberFormat: 'SMART_NUMBER',
    outerRadius: 70,
    showLabels: true,
    labelsOutside: true,
    showLabelsThreshold: 5,
    emitFilter: false,
    dateFormat: 'smart_date',
};
//# sourceMappingURL=types.js.map