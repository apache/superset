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

declare namespace Intl {
  class DurationFormat {
    constructor(locale?: string | string[], options?: DurationFormatOptions);
    format(duration: DurationObject): string;
    formatToParts(
      duration: DurationObject,
    ): { type: string; value: string; unit?: string }[];
    resolvedOptions(): ResolvedDurationFormatOptions;
  }

  interface DurationObject {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    microseconds?: number;
    nanoseconds?: number;
  }

  interface DurationFormatOptions {
    localeMatcher?: 'lookup' | 'best fit';
    numberingSystem?: string;
    style?: 'long' | 'short' | 'narrow' | 'digital';
    years?: 'long' | 'short' | 'narrow';
    yearsDisplay?: 'always' | 'auto';
    months?: 'long' | 'short' | 'narrow';
    monthsDisplay?: 'always' | 'auto';
    weeks?: 'long' | 'short' | 'narrow';
    weeksDisplay?: 'always' | 'auto';
    days?: 'long' | 'short' | 'narrow';
    daysDisplay?: 'always' | 'auto';
    hours?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    hoursDisplay?: 'always' | 'auto';
    minutes?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    minutesDisplay?: 'always' | 'auto';
    seconds?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    secondsDisplay?: 'always' | 'auto';
    milliseconds?: 'long' | 'short' | 'narrow' | 'numeric';
    millisecondsDisplay?: 'always' | 'auto';
    microseconds?: 'long' | 'short' | 'narrow' | 'numeric';
    microsecondsDisplay?: 'always' | 'auto';
    nanoseconds?: 'long' | 'short' | 'narrow' | 'numeric';
    nanosecondsDisplay?: 'always' | 'auto';
    fractionalDigits?: number;
  }

  interface ResolvedDurationFormatOptions extends DurationFormatOptions {
    locale: string;
  }
}
