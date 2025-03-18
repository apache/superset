// DODO was here
import { TimeRangeEndType } from '@superset-ui/core'; // DODO added 44211759

export type SelectOptionType = {
  value: string;
  label: string;
};

export type FrameType =
  | 'Common'
  | 'Calendar'
  | 'Current'
  | 'Custom'
  | 'CustomUntilInclude' // DODO added 44211759
  | 'Advanced'
  | 'No filter';

export type DateTimeGrainType =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export type CustomRangeKey =
  | 'sinceMode'
  | 'sinceDatetime'
  | 'sinceGrain'
  | 'sinceGrainValue'
  | 'untilMode'
  | 'untilDatetime'
  | 'untilGrain'
  | 'untilGrainValue'
  | 'anchorMode'
  | 'anchorValue';

export type DateTimeModeType = 'specific' | 'relative' | 'now' | 'today';

export type CustomRangeType = {
  sinceMode: DateTimeModeType;
  sinceDatetime: string;
  sinceGrain: DateTimeGrainType;
  sinceGrainValue: number;
  untilMode: DateTimeModeType;
  untilDatetime: string;
  untilGrain: DateTimeGrainType;
  untilGrainValue: number;
  anchorMode: 'now' | 'specific';
  anchorValue: string;
};

export type CustomRangeDecodeType = {
  customRange: CustomRangeType;
  matchedFlag: boolean;
};

export type CommonRangeType =
  | 'Last day'
  | 'Last week'
  | 'Last month'
  | 'Last quarter'
  | 'Last year';

export const PreviousCalendarWeek = 'previous calendar week';
export const PreviousCalendarMonth = 'previous calendar month';
export const PreviousCalendarYear = 'previous calendar year';
export type CalendarRangeType =
  | typeof PreviousCalendarWeek
  | typeof PreviousCalendarMonth
  | typeof PreviousCalendarYear;

export const CurrentDay = 'Current day';
export const CurrentWeek = 'Current week';
export const CurrentMonth = 'Current month';
export const CurrentYear = 'Current year';
export const CurrentQuarter = 'Current quarter';
export type CurrentRangeType =
  | typeof CurrentDay
  | typeof CurrentWeek
  | typeof CurrentMonth
  | typeof CurrentQuarter
  | typeof CurrentYear;

type FrameComponentPropsDodoExtended = {
  withTime?: boolean; // DODO added 44211759
  untilInclude?: boolean; // DODO added 44211759
};
export type FrameComponentProps = {
  onChange: (timeRange: string) => void;
  value: string;
} & FrameComponentPropsDodoExtended;

export interface DateFilterControlProps {
  name: string;
  onChange: (timeRange: string, timeRangeEndType: TimeRangeEndType) => void; // DODO changed 44211759
  value?: string;
  onOpenPopover?: () => void;
  onClosePopover?: () => void;
  overlayStyle?: 'Modal' | 'Popover';
  isOverflowingFilterBar?: boolean;
}
