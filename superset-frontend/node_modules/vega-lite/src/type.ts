import {Flag} from './util';
/** Constants and utilities for data type */
/** Data type based on level of measurement */

export const TYPE_INDEX: Flag<Type> = {
  quantitative: 1,
  ordinal: 1,
  temporal: 1,
  nominal: 1,
  geojson: 1
};

export function isType(t: any): t is Type {
  return !!TYPE_INDEX[t];
}

export const QUANTITATIVE: 'quantitative' = 'quantitative';
export const ORDINAL: 'ordinal' = 'ordinal';
export const TEMPORAL: 'temporal' = 'temporal';
export const NOMINAL: 'nominal' = 'nominal';

export const GEOJSON: 'geojson' = 'geojson';

export type StandardType = typeof QUANTITATIVE | typeof ORDINAL | typeof TEMPORAL | typeof NOMINAL;

export type Type = StandardType | typeof GEOJSON;

/**
 * Get full, lowercase type name for a given type.
 * @param  type
 * @return Full type name.
 */
export function getFullName(type: Type | string): Type | undefined {
  if (type) {
    type = type.toLowerCase();
    switch (type) {
      case 'q':
      case QUANTITATIVE:
        return 'quantitative';
      case 't':
      case TEMPORAL:
        return 'temporal';
      case 'o':
      case ORDINAL:
        return 'ordinal';
      case 'n':
      case NOMINAL:
        return 'nominal';
      case GEOJSON:
        return 'geojson';
    }
  }
  // If we get invalid input, return undefined type.
  return undefined;
}
