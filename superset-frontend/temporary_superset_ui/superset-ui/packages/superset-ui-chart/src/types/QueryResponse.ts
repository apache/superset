/**
 * Types for query response
 */
import { PlainObject } from './Base';

export type DataRecordValue = number | string | boolean | Date | null;

export interface DataRecord {
  [key: string]: DataRecordValue;
}

// data record value filters from FilterBox
export interface DataRecordFilters {
  [key: string]: DataRecordValue[];
}

// the response json from query API
export type QueryData = PlainObject;
