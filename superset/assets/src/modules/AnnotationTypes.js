export const ANNOTATION_TYPES = {
  FORMULA: {
    value: 'FORMULA',
    label: 'Formula',
  },
  EVENT: {
    value: 'EVENT',
    label: 'Event',
    supportNativeSource: true,
  },
  INTERVAL: {
    value: 'INTERVAL',
    label: 'Interval',
    supportNativeSource: true,
  },
  TIME_SERIES: {
    value: 'TIME_SERIES',
    label: 'Time Series',
  },
};

export const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPES.FORMULA;

export function requiresQuery(annotationSourceType) {
  return !!annotationSourceType;
}

export const ANNOTATION_SOURCE_TYPES = {
  NATIVE: 'NATIVE',
};

const NATIVE_COLUMN_NAMES = {
  timeColumn: 'start_dttm',
  intervalEndColumn: 'end_dttm',
  titleColumn: 'short_descr',
  descriptionColumns: ['long_descr'],
};

export function applyNativeColumns(annotation) {
  if (annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
    return { ...annotation, ...NATIVE_COLUMN_NAMES };
  }
  return annotation;
}

export default ANNOTATION_TYPES;
