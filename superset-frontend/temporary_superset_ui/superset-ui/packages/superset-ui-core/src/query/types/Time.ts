import { QueryObject } from './Query';

export type TimeRange = {
  /** Time range of the query [from, to] */
  // eslint-disable-next-line camelcase
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
