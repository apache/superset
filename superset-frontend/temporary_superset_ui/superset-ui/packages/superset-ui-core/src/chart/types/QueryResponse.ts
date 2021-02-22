/**
 * Types for query response
 */
import { DataRecordValue, DataRecord, ChartDataResponseResult } from '../../types';
import { PlainObject } from './Base';

export interface TimeseriesDataRecord extends DataRecord {
  __timestamp: number | string | Date | null;
}

// data record value filters from FilterBox
export interface DataRecordFilters {
  [key: string]: DataRecordValue[];
}

/**
 * Legacy queried data for charts. List of arbitrary dictionaries generated
 * by `viz.py`.
 * TODO: clean this up when all charts have been migrated to v1 API.
 */
export type LegacyQueryData = PlainObject;

/**
 * Ambiguous query data type. Reserved for the generic QueryFormData.
 * Don't use this for a specific chart (since you know which API it uses already).
 */
export type QueryData = LegacyQueryData | ChartDataResponseResult;

export default {};
