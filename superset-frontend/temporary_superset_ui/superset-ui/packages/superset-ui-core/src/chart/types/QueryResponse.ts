/**
 * Types for query response
 */
import { PlainObject } from './Base';

export type DataRecordValue = number | string | boolean | Date | null;

export interface DataRecord {
  [key: string]: DataRecordValue;
}

export interface TimeseriesDataRecord extends DataRecord {
  __timestamp: number | string | Date | null;
}

// data record value filters from FilterBox
export interface DataRecordFilters {
  [key: string]: DataRecordValue[];
}

// the response json from query API
export type QueryData = PlainObject;
