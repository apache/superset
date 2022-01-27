import { DataRecord } from './QueryResponse';
import { TimeGranularity } from '../../time-format';
export declare enum AnnotationType {
    Event = "EVENT",
    Formula = "FORMULA",
    Interval = "INTERVAL",
    Timeseries = "TIME_SERIES"
}
export declare enum AnnotationSourceType {
    Line = "line",
    Native = "NATIVE",
    Table = "table",
    Undefined = ""
}
export declare enum AnnotationOpacity {
    High = "opacityHigh",
    Low = "opacityLow",
    Medium = "opacityMedium",
    Undefined = ""
}
export declare enum AnnotationStyle {
    Dashed = "dashed",
    Dotted = "dotted",
    Solid = "solid",
    LongDashed = "longDashed"
}
declare type BaseAnnotationLayer = {
    color?: string | null;
    name: string;
    opacity?: AnnotationOpacity;
    show: boolean;
    showLabel: boolean;
    style: AnnotationStyle;
    width?: number;
};
declare type AnnotationOverrides = {
    granularity?: string | null;
    time_grain_sqla?: TimeGranularity | null;
    time_range?: string | null;
    time_shift?: string | null;
};
declare type LineSourceAnnotationLayer = {
    hideLine?: boolean;
    overrides?: AnnotationOverrides;
    sourceType: AnnotationSourceType.Line;
    titleColumn?: string;
    value: number;
};
declare type NativeSourceAnnotationLayer = {
    sourceType: AnnotationSourceType.Native;
    value: number;
};
declare type TableSourceAnnotationLayer = {
    descriptionColumns?: string[];
    timeColumn?: string;
    intervalEndColumn?: string;
    overrides?: AnnotationOverrides;
    sourceType: AnnotationSourceType.Table;
    titleColumn?: string;
    value: number;
};
export declare type EventAnnotationLayer = BaseAnnotationLayer & (TableSourceAnnotationLayer | NativeSourceAnnotationLayer) & {
    annotationType: AnnotationType.Event;
};
export declare type IntervalAnnotationLayer = BaseAnnotationLayer & (TableSourceAnnotationLayer | NativeSourceAnnotationLayer) & {
    annotationType: AnnotationType.Interval;
};
export declare type TableAnnotationLayer = BaseAnnotationLayer & TableSourceAnnotationLayer & {
    annotationType: AnnotationType.Event | AnnotationType.Interval;
};
export declare type FormulaAnnotationLayer = BaseAnnotationLayer & {
    annotationType: AnnotationType.Formula;
    sourceType?: AnnotationSourceType.Undefined;
    value: string;
};
export declare type TimeseriesAnnotationLayer = BaseAnnotationLayer & LineSourceAnnotationLayer & {
    annotationType: AnnotationType.Timeseries;
    showMarkers?: boolean;
    value: number;
};
export declare type AnnotationLayer = EventAnnotationLayer | IntervalAnnotationLayer | FormulaAnnotationLayer | TimeseriesAnnotationLayer;
export declare function isFormulaAnnotationLayer(layer: AnnotationLayer): layer is FormulaAnnotationLayer;
export declare function isEventAnnotationLayer(layer: AnnotationLayer): layer is EventAnnotationLayer;
export declare function isIntervalAnnotationLayer(layer: AnnotationLayer): layer is IntervalAnnotationLayer;
export declare function isTimeseriesAnnotationLayer(layer: AnnotationLayer): layer is TimeseriesAnnotationLayer;
export declare function isTableAnnotationLayer(layer: AnnotationLayer): layer is TableAnnotationLayer;
export declare type RecordAnnotationResult = {
    columns: string[];
    records: DataRecord[];
};
export declare type TimeseriesAnnotationResult = [
    {
        key: string;
        values: {
            x: string | number;
            y?: number;
        }[];
    }
];
export declare type AnnotationResult = RecordAnnotationResult | TimeseriesAnnotationResult;
export declare function isTimeseriesAnnotationResult(result: AnnotationResult): result is TimeseriesAnnotationResult;
export declare function isRecordAnnotationResult(result: AnnotationResult): result is RecordAnnotationResult;
export declare type AnnotationData = {
    [key: string]: AnnotationResult;
};
export declare type Annotation = {
    descriptions?: string[];
    intervalEnd?: string;
    time?: string;
    title?: string;
};
export {};
//# sourceMappingURL=AnnotationLayer.d.ts.map