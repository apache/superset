/**
 * Types for query response
 */
import { DataRecordValue, DataRecord } from '../../types';
import { PlainObject } from './Base';

export interface TimeseriesDataRecord extends DataRecord {
  __timestamp: number | string | Date | null;
}

// data record value filters from FilterBox
export interface DataRecordFilters {
  [key: string]: DataRecordValue[];
}

// the response json from query API
export type QueryData = PlainObject;
