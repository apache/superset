/* eslint camelcase: 0 */
import { DataRecord } from './QueryResponse';

export enum AnnotationType {
  Event = 'EVENT',
  Formula = 'FORMULA',
  Interval = 'INTERVAL',
  Timeseries = 'TIME_SERIES',
}

export enum AnnotationSourceType {
  Line = 'line',
  Native = 'NATIVE',
  Table = 'table',
  Undefined = '',
}

export enum AnnotationOpacity {
  High = 'opacityHigh',
  Low = 'opacityLow',
  Medium = 'opacityMedium',
  Undefined = '',
}

export enum AnnotationStyle {
  Dashed = 'dashed',
  Dotted = 'dotted',
  Solid = 'solid',
  LongDashed = 'longDashed',
}

type BaseAnnotationLayer = {
  color?: string | null;
  name: string;
  opacity?: AnnotationOpacity;
  show: boolean;
  style: AnnotationStyle;
  width?: number;
};

type AnnotationOverrides = {
  granularity?: string | null;
  time_grain_sqla?: string | null;
  time_range?: string | null;
  time_shift?: string | null;
};

type LineSourceAnnotationLayer = {
  hideLine?: boolean;
  overrides?: AnnotationOverrides;
  sourceType: AnnotationSourceType.Line;
  titleColumn?: string;
  // viz id
  value: number;
};

type NativeSourceAnnotationLayer = {
  sourceType: AnnotationSourceType.Native;
  // annotation id
  value: number;
};

type TableSourceAnnotationLayer = {
  descriptionColumns?: string[];
  timeColumn?: string;
  intervalEndColumn?: string;
  overrides?: AnnotationOverrides;
  sourceType: AnnotationSourceType.Table;
  titleColumn?: string;
  // viz id
  value: number;
};

export type EventAnnotationLayer = BaseAnnotationLayer &
  (TableSourceAnnotationLayer | NativeSourceAnnotationLayer) & {
    annotationType: AnnotationType.Event;
  };

export type IntervalAnnotationLayer = BaseAnnotationLayer &
  (TableSourceAnnotationLayer | NativeSourceAnnotationLayer) & {
    annotationType: AnnotationType.Interval;
  };

export type TableAnnotationLayer = BaseAnnotationLayer &
  TableSourceAnnotationLayer & {
    annotationType: AnnotationType.Event | AnnotationType.Interval;
  };

export type FormulaAnnotationLayer = BaseAnnotationLayer & {
  annotationType: AnnotationType.Formula;
  // the mathjs parseable formula
  sourceType?: AnnotationSourceType.Undefined;
  value: string;
};

export type TimeseriesAnnotationLayer = BaseAnnotationLayer &
  LineSourceAnnotationLayer & {
    annotationType: AnnotationType.Timeseries;
    showMarkers?: boolean;
    value: number;
  };

export type AnnotationLayer =
  | EventAnnotationLayer
  | IntervalAnnotationLayer
  | FormulaAnnotationLayer
  | TimeseriesAnnotationLayer;

export function isFormulaAnnotationLayer(layer: AnnotationLayer): layer is FormulaAnnotationLayer {
  return layer.annotationType === AnnotationType.Formula;
}

export function isEventAnnotationLayer(layer: AnnotationLayer): layer is EventAnnotationLayer {
  return layer.annotationType === AnnotationType.Event;
}

export function isIntervalAnnotationLayer(
  layer: AnnotationLayer,
): layer is IntervalAnnotationLayer {
  return layer.annotationType === AnnotationType.Interval;
}

export function isTimeseriesAnnotationLayer(
  layer: AnnotationLayer,
): layer is TimeseriesAnnotationLayer {
  return layer.annotationType === AnnotationType.Timeseries;
}

export function isTableAnnotationLayer(layer: AnnotationLayer): layer is TableAnnotationLayer {
  return layer.sourceType === AnnotationSourceType.Table;
}

export type RecordAnnotationResult = {
  columns: string[];
  records: DataRecord[];
};

export type TimeseriesAnnotationResult = [
  { key: string; values: { x: string | number; y?: number }[] },
];

export type AnnotationResult = RecordAnnotationResult | TimeseriesAnnotationResult;

export function isTimeseriesAnnotationResult(
  result: AnnotationResult,
): result is TimeseriesAnnotationResult {
  return Array.isArray(result);
}

export function isRecordAnnotationResult(
  result: AnnotationResult,
): result is RecordAnnotationResult {
  return 'columns' in result && 'records' in result;
}

export type AnnotationData = { [key: string]: AnnotationResult };

export type Annotation = {
  descriptions?: string[];
  intervalEnd?: string;
  time?: string;
  title?: string;
};
