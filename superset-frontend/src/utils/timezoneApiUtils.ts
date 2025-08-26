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

import moment from 'moment-timezone';
import { getCurrentTimezone, convertToUTC, convertFromUTC } from './dateUtils';

interface TimezoneAwareRequestOptions {
  convertRequestDates?: boolean;
  convertResponseDates?: boolean;
  additionalDateFields?: string[];
}

// --- Helper utilities (kept minimal and without logging) ---
function isDateString(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
  ];
  const matched = datePatterns.some(pattern => pattern.test(str));
  if (!matched) {
    return false;
  }
  const m = moment(str);
  if (!m.isValid()) {
    return false;
  }
  // Cheap sanity bounds
  const year = m.year();
  if (year < 1900 || year > 2100) {
    return false;
  }
  return true;
}

function isRelativeTimeRange(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const relativePatterns = [
    /^today$/i,
    /^now$/i,
    /^last\s+(day|week|month|quarter|year)$/i,
    /^last\s+\d+\s+(second|minute|hour|day|week|month|quarter|year)s?$/i,
    /^next\s+\d+\s+(second|minute|hour|day|week|month|quarter|year)s?$/i,
    /^current\s+(day|week|month|quarter|year)$/i,
    /^previous\s+(calendar\s+)?(day|week|month|quarter|year)$/i,
    /DATETIME\("(today|now)"\)/i,
    /DATEADD\(DATETIME\("(today|now)"\)/i,
    /DATETRUNC\(/i,
  ];
  return relativePatterns.some(pattern => pattern.test(str));
}

function resolveRelativeTimeRangeInternal(
  timeRange: string,
  timezone: string,
  now: moment.Moment,
  today: moment.Moment,
): string {
  const lower = timeRange.toLowerCase();
  if (lower === 'today') {
    return today.format('YYYY-MM-DDTHH:mm:ss');
  }
  if (lower === 'now') {
    return now.format('YYYY-MM-DDTHH:mm:ss');
  }
  if (timeRange.includes('DATETIME("today")')) {
    const todayStr = today.format('YYYY-MM-DDTHH:mm:ss');
    return timeRange.replace(/DATETIME\("today"\)/g, `DATETIME("${todayStr}")`);
  }
  if (timeRange.includes('DATETIME("now")')) {
    const nowStr = now.format('YYYY-MM-DDTHH:mm:ss');
    return timeRange.replace(/DATETIME\("now"\)/g, `DATETIME("${nowStr}")`);
  }
  if (lower === 'current day') {
    const startOfDay = today.format('YYYY-MM-DDTHH:mm:ss');
    const endOfDay = today.clone().endOf('day').format('YYYY-MM-DDTHH:mm:ss');
    return `${startOfDay} : ${endOfDay}`;
  }
  const currentMatch = timeRange.match(
    /^current\s+(week|month|quarter|year)$/i,
  );
  if (currentMatch) {
    const unit = currentMatch[1].toLowerCase();
    const startOf = today
      .clone()
      .startOf(unit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
    const endOf = today
      .clone()
      .endOf(unit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
    return `${startOf} : ${endOf}`;
  }
  const previousCalendarMatch = timeRange.match(
    /^previous\s+calendar\s+(week|month|year)$/i,
  );
  if (previousCalendarMatch) {
    const unit = previousCalendarMatch[1].toLowerCase();
    const unitMap: Record<string, string> = {
      week: 'weeks',
      month: 'months',
      year: 'years',
    };
    const momentUnit = unitMap[unit] || unit;
    const startTime = today
      .clone()
      .subtract(1, momentUnit as any)
      .startOf(unit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
    const endTime = today
      .clone()
      .startOf(unit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
    return `${startTime} : ${endTime}`;
  }
  const previousMatch = timeRange.match(
    /^previous\s+(day|week|month|quarter|year)$/i,
  );
  if (previousMatch) {
    const unit = previousMatch[1].toLowerCase();
    const unitMap: Record<string, string> = {
      day: 'days',
      week: 'weeks',
      month: 'months',
      quarter: 'quarters',
      year: 'years',
    };
    const momentUnit = unitMap[unit] || unit;
    const startTime = today
      .clone()
      .subtract(1, momentUnit as any)
      .startOf(unit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
    const endTime = today
      .clone()
      .startOf(unit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
      console.log(`Previous range: ${startTime} : ${endTime}`)
    return `${startTime} : ${endTime}`;
  }
  const lastMatch = timeRange.match(
    /^last\s+(\d+)?\s*(day|week|month|quarter|year)s?$/i,
  );
  if (lastMatch) {
    const count = parseInt(lastMatch[1] || '1', 10);
    const unit = lastMatch[2].toLowerCase();
    const unitMap: Record<string, string> = {
      day: 'days',
      week: 'weeks',
      month: 'months',
      quarter: 'quarters',
      year: 'years',
    };
    const momentUnit = unitMap[unit] || unit;
    const startTime = today
      .clone()
      .subtract(count, momentUnit as any)
      .format('YYYY-MM-DDTHH:mm:ss');
    const endTime = today.format('YYYY-MM-DDTHH:mm:ss');
    console.log(`Last range: ${startTime} : ${endTime}`)
    return `${startTime} : ${endTime}`;
  }
  if (timeRange.includes('DATETRUNC(')) {
    let result = timeRange;
    if (result.includes('DATETIME("today")')) {
      const todayStr = today.format('YYYY-MM-DDTHH:mm:ss');
      result = result.replace(
        /DATETIME\("today"\)/g,
        `DATETIME("${todayStr}")`,
      );
    }
    if (result.includes('DATETIME("now")')) {
      const nowStr = now.format('YYYY-MM-DDTHH:mm:ss');
      result = result.replace(/DATETIME\("now"\)/g, `DATETIME("${nowStr}")`);
    }
    return result;
  }
  return timeRange;
}

function resolveRelativeTimeRange(timeRange: string, timezone: string): string {
  const originalTimeRange = timeRange;
  if (!isRelativeTimeRange(timeRange)) {
    logTimezoneConversion('resolveRelativeTimeRange (not relative)', originalTimeRange, timeRange);
    return timeRange;
  }
  const now = moment.tz(timezone);
  const today = moment.tz(timezone).startOf('day');
  const result = resolveRelativeTimeRangeInternal(timeRange, timezone, now, today);
  
  logTimezoneConversion('resolveRelativeTimeRange', originalTimeRange, result, {
    timezone,
    now: now.format('YYYY-MM-DDTHH:mm:ss'),
    today: today.format('YYYY-MM-DDTHH:mm:ss'),
  });
  
  return result;
}

function convertFilterDateValues(filter: any, timezone: string): any {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  const converted = { ...filter };
  if (converted.comparator) {
    if (
      typeof converted.comparator === 'string' &&
      isDateString(converted.comparator)
    ) {
      // Skip conversion for relative time ranges in filter comparators
      const isSimpleRelativeRange = /^(last|previous|current)\s+(day|week|month|quarter|year)$/i.test(converted.comparator) ||
                                  /^previous\s+calendar\s+(week|month|year)$/i.test(converted.comparator);
      if (!isSimpleRelativeRange) {
        converted.comparator = convertToUTC(
          converted.comparator,
          timezone,
        ).toISOString();
      }
    } else if (Array.isArray(converted.comparator)) {
      converted.comparator = converted.comparator.map((val: any) => {
        if (typeof val === 'string' && isDateString(val)) {
          return convertToUTC(val, timezone).toISOString();
        }
        return val;
      });
    }
  }
  if (
    converted.val &&
    typeof converted.val === 'string' &&
    isDateString(converted.val)
  ) {
    converted.val = convertToUTC(converted.val, timezone).toISOString();
  } else if (converted.val && Array.isArray(converted.val)) {
    converted.val = converted.val.map((val: any) => {
      if (typeof val === 'string' && isDateString(val)) {
        return convertToUTC(val, timezone).toISOString();
      }
      return val;
    });
  }
  if (converted.clause === 'WHERE' && converted.subject && converted.operator) {
    if (
      converted.comparator &&
      typeof converted.comparator === 'string' &&
      isDateString(converted.comparator)
    ) {
      converted.comparator = convertToUTC(
        converted.comparator,
        timezone,
      ).toISOString();
    }
  }
  Object.keys(converted).forEach(key => {
    if (typeof converted[key] === 'object' && converted[key] !== null) {
      converted[key] = convertFilterDateValues(converted[key], timezone);
    }
  });
  return converted;
}

// --- Public API ---
export function convertRequestDatesToUTC(
  payload: any,
  options: TimezoneAwareRequestOptions = {},
): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const { additionalDateFields = [] } = options;
  const converted = { ...payload };
  const timezone = getCurrentTimezone();

  const defaultDateFields = [
    'since',
    'until',
    'start_date',
    'end_date',
    'time_range_endpoints',
    'start_date_offset',
    'end_date_offset',
    'time_range',
    'extra_filters',
    'adhoc_filters',
    'extra_form_data',
  ];
  const allDateFields = [...defaultDateFields, ...additionalDateFields];

  allDateFields.forEach(field => {
    if (!converted[field]) {
      return;
    }
    if (
      (field === 'adhoc_filters' || field === 'extra_filters') &&
      Array.isArray(converted[field])
    ) {
      converted[field] = converted[field].map((filter: any) =>
        convertFilterDateValues(filter, timezone),
      );
    }
    if (field === 'extra_form_data' && typeof converted[field] === 'object') {
      const extraFormData = { ...converted[field] } as any;
      if (typeof extraFormData.time_range === 'string') {
        const originalTimeRange = extraFormData.time_range;
        let tr = extraFormData.time_range as string;
        
        logTimezoneConversion('extra_form_data.time_range (initial)', originalTimeRange, tr);
        
        logTimezoneConversion('extra_form_data.time_range (processing check)', tr, 'WILL PROCESS ALL RANGES');
        
        if (isRelativeTimeRange(tr) && !tr.includes(' : ')) {
          const resolvedTr = resolveRelativeTimeRange(tr, timezone);
          logTimezoneConversion('extra_form_data.time_range (resolved)', tr, resolvedTr);
          tr = resolvedTr;
        }
        
        const parts = tr.split(' : ');
        if (parts.length === 2) {
          let [startTime, endTime] = parts;
          const originalParts = [startTime, endTime];
          
          if (isRelativeTimeRange(startTime)) {
            startTime = resolveRelativeTimeRange(startTime, timezone);
          }
          if (isRelativeTimeRange(endTime)) {
            endTime = resolveRelativeTimeRange(endTime, timezone);
          }
          
          if (isDateString(startTime) && isDateString(endTime)) {
            const convertedStart = convertToUTC(
              startTime,
              timezone,
            ).toISOString();
            const convertedEnd = convertToUTC(endTime, timezone).toISOString();
            tr = `${convertedStart} : ${convertedEnd}`;
            
            logTimezoneConversion('extra_form_data.time_range (final UTC)', originalParts, [convertedStart, convertedEnd], {
              timezone,
              originalTimeRange,
            });
          } else {
            tr = `${startTime} : ${endTime}`;
            logTimezoneConversion('extra_form_data.time_range (non-date range)', originalParts, [startTime, endTime]);
          }
        } else {
          logTimezoneConversion('extra_form_data.time_range (single value)', originalTimeRange, tr);
        }
        extraFormData.time_range = tr;
      }
      converted[field] = extraFormData;
    }
    if (Array.isArray(converted[field])) {
      converted[field] = converted[field].map((val: any) => {
        if (typeof val === 'string' && isDateString(val)) {
          return convertToUTC(val, timezone).toISOString();
        }
        return val;
      });
    }
    if (
      typeof converted[field] === 'string' &&
      isDateString(converted[field])
    ) {
      logTimezoneConversion('date string conversion', field, {
        value: converted[field],
        isTimeRange: field === 'time_range'
      });
      
      converted[field] = convertToUTC(converted[field], timezone).toISOString();
    }
  });

  if (converted.form_data) {
    converted.form_data = convertRequestDatesToUTC(
      converted.form_data,
      options,
    );
  }
  if (Array.isArray(converted.queries)) {
    converted.queries = converted.queries.map((q: any) =>
      convertRequestDatesToUTC(q, options),
    );
  }
  return converted;
}

export function convertResponseDatesFromUTC(
  data: any,
  options: TimezoneAwareRequestOptions = {},
): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => convertResponseDatesFromUTC(item, options));
  }
  const { additionalDateFields = [] } = options;
  const converted = { ...data };
  const timezone = getCurrentTimezone();
  const datePatterns = [
    /.*_date$/i,
    /.*_time$/i,
    /.*timestamp$/i,
    /created.*$/i,
    /updated.*$/i,
    /modified.*$/i,
    /changed.*$/i,
    ...additionalDateFields.map(field => new RegExp(`^${field}$`, 'i')),
  ];
  Object.keys(converted).forEach(key => {
    const value = converted[key];
    const isDateField = datePatterns.some(pattern => pattern.test(key));
    if (isDateField && typeof value === 'string' && isDateString(value)) {
      try {
        converted[key] = convertFromUTC(value, timezone).toISOString();
      } catch (_e) {
        // leave as-is
      }
    } else if (typeof value === 'object') {
      converted[key] = convertResponseDatesFromUTC(value, options);
    }
  });
  return converted;
}

export function createTimezoneAwareApiCall<T = any>(
  originalApiCall: (...args: any[]) => Promise<T>,
  options: TimezoneAwareRequestOptions = {},
) {
  return async (...args: any[]): Promise<T> => {
    const { convertRequestDates = true, convertResponseDates = true } = options;
    let convertedArgs = args;
    if (convertRequestDates && args.length > 0) {
      convertedArgs = args.map((arg, index) => {
        if (index === 0 && typeof arg === 'object') {
          return convertRequestDatesToUTC(arg, options);
        }
        return arg;
      });
    }
    const response = await originalApiCall(...convertedArgs);
    if (convertResponseDates) {
      return convertResponseDatesFromUTC(response, options);
    }
    return response;
  };
}

let debugLogging = false;

// Enable/disable debug logging
export function enableTimezoneDebugLogging(enable: boolean = true): void {
  debugLogging = enable;
}

export function logTimezoneConversion(
  operation: string,
  input: any,
  output: any,
  details?: any,
): void {
  if (debugLogging) {
    console.group(`🕐 Timezone Conversion: ${operation}`);
    console.log('Input:', input);
    console.log('Output:', output);
    if (details) {
      console.log('Details:', details);
    }
    console.groupEnd();
  }
}
