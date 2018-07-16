import { VIZ_TYPES } from '../visualizations';
import vizTypes from '../explore/visTypes';

export const ANNOTATION_TYPES = {
  FORMULA: 'FORMULA',
  EVENT: 'EVENT',
  INTERVAL: 'INTERVAL',
  TIME_SERIES: 'TIME_SERIES',
  STATISTICAL: 'STATISTICAL',
};

export const ANNOTATION_TYPE_LABELS = {
  FORMULA: 'Formula ',
  EVENT: 'Event',
  INTERVAL: 'Interval',
  TIME_SERIES: 'Time Series',
  STATISTICAL: 'Statistical',
};

export function getAnnotationTypeLabel(annotationType) {
  return ANNOTATION_TYPE_LABELS[annotationType];
}

export const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPES.FORMULA;

export const ANNOTATION_SOURCE_TYPES = {
  NATIVE: 'NATIVE',
  ...VIZ_TYPES,
};

export function getAnnotationSourceTypeLabels(sourceType) {
  return ANNOTATION_SOURCE_TYPES.NATIVE === sourceType ? 'Superset annotation' :
      vizTypes[sourceType].label;
}

export function requiresQuery(annotationSourceType) {
  return !!annotationSourceType;
}

// Map annotation type to annotation source type
const SUPPORTED_SOURCE_TYPE_MAP = {
  [ANNOTATION_TYPES.EVENT]: [
    ANNOTATION_SOURCE_TYPES.NATIVE,
    ANNOTATION_SOURCE_TYPES.table,
  ],
  [ANNOTATION_TYPES.INTERVAL]: [
    ANNOTATION_SOURCE_TYPES.NATIVE,
    ANNOTATION_SOURCE_TYPES.table,
  ],
  [ANNOTATION_TYPES.TIME_SERIES]: [
    ANNOTATION_SOURCE_TYPES.line,
  ],
};

export function getSupportedSourceTypes(annotationType) {
  return SUPPORTED_SOURCE_TYPE_MAP[annotationType] || [];
}

// Map from viz type to supported annotation
const SUPPORTED_ANNOTATIONS = {
  [VIZ_TYPES.line]: [
    ANNOTATION_TYPES.TIME_SERIES,
    ANNOTATION_TYPES.INTERVAL,
    ANNOTATION_TYPES.EVENT,
    ANNOTATION_TYPES.FORMULA,
    ANNOTATION_TYPES.STATISTICAL,
  ],
  [VIZ_TYPES.bar]: [
    ANNOTATION_TYPES.INTERVAL,
    ANNOTATION_TYPES.EVENT,
  ],
  [VIZ_TYPES.area]: [
    ANNOTATION_TYPES.INTERVAL,
    ANNOTATION_TYPES.EVENT,
  ],
};

export function getSupportedAnnotationTypes(vizType) {
  return SUPPORTED_ANNOTATIONS[vizType] || [];
}

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

export const STAT_ANNOTATION_TYPES = {
  LINEAR: 'LINEAR',
  EXPONENTIAL: 'EXPONENTIAL',
  LOGARITHMIC: 'LOGARITHMIC',
  POWER: 'POWER',
  POLYNOMIAL: 'POLYNOMIAL',
};

export const STAT_ANNOTATION_TYPE_LABELS = {
  LINEAR: 'Linear',
  EXPONENTIAL: 'Exponential',
  LOGARITHMIC: 'Logarithmic',
  POWER: 'Power',
  POLYNOMIAL: 'Polynomial',
};

export const SUPPORTED_STAT_ANNOTATION_TYPES =
[
  STAT_ANNOTATION_TYPES.LINEAR,
  STAT_ANNOTATION_TYPES.EXPONENTIAL,
  STAT_ANNOTATION_TYPES.LOGARITHMIC,
  STAT_ANNOTATION_TYPES.POWER,
  STAT_ANNOTATION_TYPES.POLYNOMIAL,
];

export function getStatAnnotationTypeLabel(statAnnotationType) {
  return STAT_ANNOTATION_TYPE_LABELS[statAnnotationType];
}

export function getStatAnnotationTypes() {
  return SUPPORTED_STAT_ANNOTATION_TYPES;
}
