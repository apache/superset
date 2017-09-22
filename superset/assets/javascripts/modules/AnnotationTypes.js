import { VIZ_TYPES } from '../../visualizations/main';

export const ANNOTATION_TYPES = {
  FORMULA: 'FORMULA',
  EVENT: 'EVENT',
  INTERVAL: 'INTERVAL',
  TIME_SERIES: 'TIME_SERIES',
  NATIVE: 'NATIVE',
//  POINT_ANNOTATION: 'POINT_ANNOTATION',
};

export const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPES.FORMULA;

export function supportedSliceTypes(annotationType) {
  if (annotationType === ANNOTATION_TYPES.EVENT ||
      annotationType === ANNOTATION_TYPES.INTERVAL
  ) return [VIZ_TYPES.table];
  if (annotationType === ANNOTATION_TYPES.TIME_SERIES) return [VIZ_TYPES.line];
  return [];
}

export function requiresQuery(annotationType) {
  if (annotationType === ANNOTATION_TYPES.FORMULA ||
      annotationType === ANNOTATION_TYPES.NATIVE
  ) {
    return false;
  }
  return true;
}

export default ANNOTATION_TYPES;
