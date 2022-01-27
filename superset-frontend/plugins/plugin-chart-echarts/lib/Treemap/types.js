import { LabelPositionEnum } from '../types';
export var EchartsTreemapLabelType;
(function (EchartsTreemapLabelType) {
    EchartsTreemapLabelType["Key"] = "key";
    EchartsTreemapLabelType["Value"] = "value";
    EchartsTreemapLabelType["KeyValue"] = "key_value";
})(EchartsTreemapLabelType || (EchartsTreemapLabelType = {}));
export const DEFAULT_FORM_DATA = {
    groupby: [],
    labelType: EchartsTreemapLabelType.KeyValue,
    labelPosition: LabelPositionEnum.InsideTopLeft,
    numberFormat: 'SMART_NUMBER',
    showLabels: true,
    showUpperLabels: true,
    dateFormat: 'smart_date',
    emitFilter: false,
};
//# sourceMappingURL=types.js.map