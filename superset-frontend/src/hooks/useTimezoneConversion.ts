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
import { useTimezone } from 'src/components/TimezoneContext';

/**
 * Hook for timezone-aware conversions and formatting
 * Provides utilities to convert dates between timezone and UTC for API calls
 */
export function useTimezoneConversion() {
  const { timezone, convertToUTC, convertFromUTC, formatDate, formatDateTime } = useTimezone();

  /**
   * Convert date range filters to UTC for API calls
   * This should be used when sending date filters to the backend
   */
  const convertDateRangeToUTC = (dateRange: [string, string]): [string, string] => {
    const [start, end] = dateRange;
    return [
      convertToUTC(start).toISOString(),
      convertToUTC(end).toISOString(),
    ];
  };

  /**
   * Convert form data date fields to UTC before sending to API
   * This recursively walks through form data and converts known date fields
   */
  const convertFormDataDatesToUTC = (formData: any): any => {
    if (!formData || typeof formData !== 'object') {
      return formData;
    }

    const converted = { ...formData };

    // Common date field names that need conversion
    const dateFields = [
      'since',
      'until',
      'time_range_endpoints',
      'start_date_offset',
      'end_date_offset',
      'x_ticks_layout',
    ];

    dateFields.forEach(field => {
      if (converted[field]) {
        if (Array.isArray(converted[field])) {
          // Handle date range arrays
          converted[field] = converted[field].map((date: any) =>
            typeof date === 'string' ? convertToUTC(date).toISOString() : date
          );
        } else if (typeof converted[field] === 'string') {
          // Handle single date strings
          converted[field] = convertToUTC(converted[field]).toISOString();
        }
      }
    });

    // Handle time_range specifically if it's an object
    if (converted.time_range && typeof converted.time_range === 'object') {
      const timeRange = converted.time_range;
      if (timeRange.since) {
        timeRange.since = convertToUTC(timeRange.since).toISOString();
      }
      if (timeRange.until) {
        timeRange.until = convertToUTC(timeRange.until).toISOString();
      }
    }

    return converted;
  };

  /**
   * Convert UTC response data to local timezone for display
   */
  const convertResponseDatesFromUTC = (data: any): any => {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(convertResponseDatesFromUTC);
    }

    const converted = { ...data };

    // Common response date field patterns
    const datePatterns = [
      /.*_date$/i,
      /.*_time$/i,
      /.*timestamp$/i,
      /created.*$/i,
      /updated.*$/i,
      /modified.*$/i,
    ];

    Object.keys(converted).forEach(key => {
      const value = converted[key];

      // Check if this field looks like a date field
      const isDateField = datePatterns.some(pattern => pattern.test(key));

      if (isDateField && typeof value === 'string') {
        // Try to parse as ISO date and convert from UTC
        try {
          const parsedDate = moment.utc(value);
          if (parsedDate.isValid()) {
            converted[key] = convertFromUTC(value).toISOString();
          }
        } catch (e) {
          // If parsing fails, leave the value unchanged
        }
      } else if (typeof value === 'object') {
        // Recursively convert nested objects
        converted[key] = convertResponseDatesFromUTC(value);
      }
    });

    return converted;
  };

  /**
   * Format a date for display in the current timezone
   */
  const formatDateForDisplay = (date: moment.MomentInput, format?: string): string => {
    return formatDate(date, format);
  };

  /**
   * Format a datetime for display in the current timezone
   */
  const formatDateTimeForDisplay = (date: moment.MomentInput, format?: string): string => {
    return formatDateTime(date, format);
  };

  /**
   * Get timezone info for debugging/logging
   */
  const getTimezoneInfo = () => ({
    current: timezone,
    offset: moment.tz(timezone).format('Z'),
    abbreviation: moment.tz(timezone).format('z'),
  });

  return {
    timezone,
    convertDateRangeToUTC,
    convertFormDataDatesToUTC,
    convertResponseDatesFromUTC,
    formatDateForDisplay,
    formatDateTimeForDisplay,
    getTimezoneInfo,
    convertToUTC,
    convertFromUTC,
  };
}
