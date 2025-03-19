// DOOD was here

import { QueryObject } from './Query';

// DODO added start 44211759
export enum TimeRangeEndType {
  Included = 'included',
  Excluded = 'excluded',
}
type TimeRangeDodoExtended = {
  time_range_end_type?: TimeRangeEndType;
};
// DODO added stop 44211759

export type TimeRange = {
  /** Time range of the query [from, to] */
  time_range?: string;
  since?: string;
  until?: string;
} & TimeRangeDodoExtended;

export type TimeColumnConfigKey =
  | '__time_col'
  | '__time_grain'
  | '__time_range'
  | '__granularity';

export type AppliedTimeExtras = Partial<
  Record<TimeColumnConfigKey, keyof QueryObject>
>;

export default {};
