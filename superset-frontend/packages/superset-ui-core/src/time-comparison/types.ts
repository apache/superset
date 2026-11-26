/*
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

/**
 * Supported comparison time ranges
 */

export enum ComparisonTimeRangeType {
  Custom = 'c',
  InheritedRange = 'r',
  Month = 'm',
  Week = 'w',
  Year = 'y',
}

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

/**
 * Time range limits, in the shape the server's limit payloads send them
 */

export type Rule = { quantity: number; time_grain: string } | null;

export type Policy = {
  max_span: Rule;
  max_look_back: Rule;
  max_look_forward: Rule;
};

export type Source = 'global' | 'dataset' | 'dashboard';

export type Level = { source: Source; policy: Policy | null };

export type TimeRangeLimits = {
  levels: Level[];
  dashboardId?: number;
  timezone?: string;
  // Id of an error shown outside the picker that describes its trigger.
  describedBy?: string;
  // Id of the label outside the picker that names its trigger.
  labelledBy?: string;
};
