/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { ReactNode } from 'react';
import type { PartitionFilterMapping } from '@superset-ui/chart-controls';
import type { TimeRangeLimits } from '@superset-ui/core';
import type { Dayjs } from '@superset-ui/core/utils/dates';

export type SelectOptionType = {
  value: string;
  label: string;
};

export type FrameType =
  | 'Common'
  | 'Calendar'
  | 'Current'
  | 'Custom'
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
export const PreviousCalendarQuarter = 'previous calendar quarter';
export const PreviousCalendarYear = 'previous calendar year';
export type CalendarRangeType =
  | typeof PreviousCalendarWeek
  | typeof PreviousCalendarMonth
  | typeof PreviousCalendarQuarter
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

export type FieldError = { id: string; message: ReactNode };

export type FrameLimits = {
  // Ids of the Start and End fields, which take focus when invalid.
  startId: string;
  endId: string;
  start?: FieldError;
  end?: FieldError;
  // The id of the "Actual time range" row error, when it shows one.
  rowErrorId?: string;
  // Whether that row error is about the entered range, so the fields are
  // marked invalid.
  rowInvalid?: boolean;
  presetInvalid?: boolean;
  presetDescribedBy?: string;
  // While the draft's check is pending, the fields are not marked invalid.
  pending?: boolean;
  disabledStartDate?: (current: Dayjs) => boolean;
  disabledEndDate?: (current: Dayjs) => boolean;
  // Why each preset can't be applied; undefined until the list is resolved.
  presets?: Record<string, ReactNode | undefined>;
  // Ids of the preset group's title and of its "options disabled" line.
  groupLabelId?: string;
  disabledPresetsId?: string;
  // The id of the "Actual time range" limit line, when it shows one.
  limitLineId?: string;
  // Told whether one of the frame's calendars is open.
  onCalendarOpenChange?: (open: boolean) => void;
};

export type FrameComponentProps = {
  onChange: (timeRange: string) => void;
  value: string;
  isOverflowingFilterBar?: boolean;
  limits?: FrameLimits;
};

export interface DateFilterControlProps {
  name: string;
  onChange: (timeRange: string) => void;
  value?: string;
  onOpenPopover?: () => void;
  onClosePopover?: () => void;
  isOverflowingFilterBar?: boolean;
  hovered?: boolean;
  description?: ReactNode;
  label?: ReactNode;
  tooltipOnClick?: () => void;
  /**
   * The dataset's partition filter mapping, injected by the control's
   * `mapStateToProps` and already gated there: it is `null` unless *this* time
   * range is mirrored onto the partition column. The control renders it as-is,
   * so nothing further has to be checked here.
   */
  partitionMapping?: PartitionFilterMapping | null;
  displayFormat?: string;
  timeRangeLimits?: TimeRangeLimits;
}
