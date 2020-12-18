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
export type SelectOptionType = {
  value: string;
  label: string;
};

export type TimeRangeFrameType =
  | 'Common'
  | 'Calendar'
  | 'Custom'
  | 'Advanced'
  | 'No Filter';

export type DateTimeGrainType =
  | 'second'
  | 'minite'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
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

export type CustomRangeType = {
  sinceMode: string;
  sinceDatetime: string;
  sinceGrain: string;
  sinceGrainValue: number;
  untilMode: string;
  untilDatetime: string;
  untilGrain: string;
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

export const PreviousCalendarWeek =
  'DATETRUNC(DATEADD(DATETIME("TODAY"), -1, WEEK), WEEK) : LASTDAY(DATEADD(DATETIME("TODAY"), -1, WEEK), WEEK)';
export const PreviousCalendarMonth =
  'DATETRUNC(DATEADD(DATETIME("TODAY"), -1, MONTH), MONTH) : LASTDAY(DATEADD(DATETIME("TODAY"), -1, MONTH), MONTH)';
export const PreviousCalendarYear =
  'DATETRUNC(DATEADD(DATETIME("TODAY"), -1, YEAR), YEAR) : LASTDAY(DATEADD(DATETIME("TODAY"), -1, YEAR), YEAR)';
export type CalendarRangeType =
  | typeof PreviousCalendarWeek
  | typeof PreviousCalendarMonth
  | typeof PreviousCalendarYear;
