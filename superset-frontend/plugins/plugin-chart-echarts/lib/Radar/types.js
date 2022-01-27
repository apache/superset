import { DEFAULT_LEGEND_FORM_DATA, LabelPositionEnum, LegendOrientation, LegendType, } from '../types';
export var EchartsRadarLabelType;
(function (EchartsRadarLabelType) {
    EchartsRadarLabelType["Value"] = "value";
    EchartsRadarLabelType["KeyValue"] = "key_value";
})(EchartsRadarLabelType || (EchartsRadarLabelType = {}));
// @ts-ignore
export const DEFAULT_FORM_DATA = {
    ...DEFAULT_LEGEND_FORM_DATA,
    groupby: [],
    labelType: EchartsRadarLabelType.Value,
    labelPosition: LabelPositionEnum.Top,
    legendOrientation: LegendOrientation.Top,
    legendType: LegendType.Scroll,
    numberFormat: 'SMART_NUMBER',
    showLabels: true,
    emitFilter: false,
    dateFormat: 'smart_date',
    isCircle: false,
};
//# sourceMappingURL=types.js.map