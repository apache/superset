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

import { getCurrentTimezone } from 'src/utils/dateUtils';
import { convertRequestDatesToUTC } from 'src/utils/timezoneApiUtils';

/**
 * Convert form data dates to UTC before sending to API
 * This ensures all datetime values are in UTC as expected by the backend
 */
export function convertFormDataForAPI(formData) {
  const timezone = getCurrentTimezone();

  // NOTE: We should NOT skip conversion just because user's viewing timezone is UTC!
  // The data might come from a different timezone and still needs conversion.
  // Only skip if we can determine the data is already in UTC format.
  // For now, always attempt conversion - the convertRequestDatesToUTC function
  // will handle the actual timezone detection and conversion logic.

  // Create a copy to avoid mutating the original
  const converted = { ...formData };

  try {
    const dateFieldsFound = [];
    Object.keys(converted).forEach(key => {
      if (converted[key] && typeof converted[key] === 'string') {
        // Check if it looks like a date
        if (/\d{4}-\d{2}-\d{2}/.test(converted[key])) {
          dateFieldsFound.push({ field: key, value: converted[key] });
        }
      }
    });

    // Convert timezone-aware date fields to UTC
    const result = convertRequestDatesToUTC(converted, {
      convertRequestDates: true,
      additionalDateFields: [
        // Chart-specific date fields that commonly contain dates
        'time_range',
        'time_range_endpoints',
        'since',
        'until',
        'start_date_offset',
        'end_date_offset',
        'x_ticks_layout',
        'datetime_format',
        'granularity',
        'granularity_sqla',
        'time_grain_sqla',
        // Add more common date fields found in form data
        'extra_filters',
        'adhoc_filters',
      ],
    });


    return result;
  } catch (error) {
    console.error('❌ [TIMEZONE CONVERSION ERROR]:', error);
    return formData; // Return original if conversion fails
  }
}

/**
 * Timezone-aware wrapper for chart data requests
 * This should be used instead of the original getChartDataRequest when timezone conversion is needed
 */
export async function getTimezoneAwareChartDataRequest(originalRequest) {
  return async function timezoneAwareRequest({
    formData,
    setDataMask = () => {},
    resultFormat = 'json',
    resultType = 'full',
    force = false,
    method = 'POST',
    requestParams = {},
    ownState = {},
  }) {
    // Convert form data dates to UTC before sending to API
    const convertedFormData = convertFormDataForAPI(formData);

    // Call the original request with converted form data
    return originalRequest({
      formData: convertedFormData,
      setDataMask,
      resultFormat,
      resultType,
      force,
      method,
      requestParams,
      ownState,
    });
  };
}

/**
 * Convert annotation query form data for timezone-aware requests
 */
export function convertAnnotationFormDataForAPI(annotation, formData) {
  const timezone = getCurrentTimezone();

  // NOTE: Same fix as above - don't skip conversion just because user timezone is UTC
  // The annotation data might still need timezone conversion regardless of user's viewing timezone

  try {
    // Convert annotation overrides
    const convertedAnnotation = { ...annotation };
    if (annotation.overrides) {
      convertedAnnotation.overrides = convertRequestDatesToUTC(annotation.overrides);
    }

    // Convert form data
    const convertedFormData = convertFormDataForAPI(formData);

    return {
      annotation: convertedAnnotation,
      formData: convertedFormData,
    };
  } catch (error) {
    console.warn('[Timezone] Failed to convert annotation form data dates to UTC:', error);
    return { annotation, formData };
  }
}
