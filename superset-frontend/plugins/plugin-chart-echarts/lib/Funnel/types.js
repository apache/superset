import { DEFAULT_LEGEND_FORM_DATA, LegendOrientation, LegendType, } from '../types';
export var EchartsFunnelLabelTypeType;
(function (EchartsFunnelLabelTypeType) {
    EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["Key"] = 0] = "Key";
    EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["Value"] = 1] = "Value";
    EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["Percent"] = 2] = "Percent";
    EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["KeyValue"] = 3] = "KeyValue";
    EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["KeyPercent"] = 4] = "KeyPercent";
    EchartsFunnelLabelTypeType[EchartsFunnelLabelTypeType["KeyValuePercent"] = 5] = "KeyValuePercent";
})(EchartsFunnelLabelTypeType || (EchartsFunnelLabelTypeType = {}));
// @ts-ignore
export const DEFAULT_FORM_DATA = {
    ...DEFAULT_LEGEND_FORM_DATA,
    groupby: [],
    labelLine: false,
    labelType: EchartsFunnelLabelTypeType.Key,
    legendOrientation: LegendOrientation.Top,
    legendType: LegendType.Scroll,
    numberFormat: 'SMART_NUMBER',
    showLabels: true,
    sort: 'descending',
    orient: 'vertical',
    gap: 0,
    emitFilter: false,
};
//# sourceMappingURL=types.js.map