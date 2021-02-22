import { QueryObject } from './Query';

export type TimeRange = {
  /** Time range of the query [from, to] */
  time_range?: string;
  since?: string;
  until?: string;
};

export type TimeColumnConfigKey =
  | '__time_col'
  | '__time_grain'
  | '__time_range'
  | '__time_origin'
  | '__granularity';

export type AppliedTimeExtras = Partial<Record<TimeColumnConfigKey, keyof QueryObject>>;

export type TimeRangeEndpoint = 'unknown' | 'inclusive' | 'exclusive';
export type TimeRangeEndpoints = [TimeRangeEndpoint, TimeRangeEndpoint];

export default {};
