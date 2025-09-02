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
import {
  buildQueryContext,
  QueryFormData,
} from '@superset-ui/core';


/**
 * Detect time period from time range string
 * Examples: "Last 7 days" -> "7 days ago", "Last 1 month" -> "1 month ago"
 */
function detectTimePeriod(timeRange: string): string | null {
  const match = timeRange.match(/last\s+(\d+)\s+(day|week|month|year)s?/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    // Handle singular vs plural
    const singularUnit = value === 1 ? unit : unit + 's';
    return `${value} ${singularUnit} ago`;
  }
  
  // Handle special cases
  const lowerTimeRange = timeRange.toLowerCase();
  if (lowerTimeRange.includes('this week')) return '1 week ago';
  if (lowerTimeRange.includes('this month')) return '1 month ago';
  if (lowerTimeRange.includes('this year')) return '1 year ago';
  
  return null;
}

/**
 * Calculate time period from since/until dates
 * Example: since="2023-08-23", until="2023-08-26" -> "4 days ago"
 */
function calculatePeriodFromDates(since: string, until: string): string | null {
  try {
    const sinceDate = new Date(since);
    const untilDate = new Date(until);
    const diffTime = Math.abs(untilDate.getTime() - sinceDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  } catch (error) {
    console.warn('Error calculating period from dates:', error);
    return null;
  }
}

export default function buildQuery(formData: QueryFormData) {
  // Debug logging for buildQuery
  console.log('BigNumberTotal buildQuery - Input formData:', {
    hasExtraFormData: !!formData.extra_form_data,
    extraFormData: formData.extra_form_data,
    customFormData: formData.extra_form_data?.custom_form_data,
    timeCompare: formData.time_compare,
    timeCompareExtra: (formData.extra_form_data?.custom_form_data as any)?.time_compare,
    timeCompareDirect: (formData.extra_form_data as any)?.time_compare,
    metrics: formData.metrics,
    datasource: formData.datasource,
    timeRange: formData.time_range,
    since: formData.since,
    until: formData.until,
    granularity: formData.granularity,
    filters: formData.filters,
    adhocFilters: formData.adhoc_filters,
  });

  const buildQuery = (baseQueryObject: any) => {
    console.log('BigNumberTotal buildQuery - baseQueryObject:', baseQueryObject);

    // Use the proper Superset single-query approach for time comparison
    // This ensures that formData.time_compare is preserved and passed to transformProps
    const time_offsets = (() => {
      const timeCompare = formData.time_compare || 
                         (formData.extra_form_data as any)?.time_compare;
      
      // Convert string time comparison to array format for transformProps
      if (timeCompare && timeCompare !== 'NoComparison') {
        if (timeCompare === 'inherit') {
          // Enhanced inherit logic: detect actual time period and apply same offset
          const timeRange = formData.time_range;
          const since = formData.since;
          const until = formData.until;
          
          console.log('BigNumberTotal buildQuery - Inherit logic analysis:', {
            timeRange,
            since,
            until,
            hasTimeRange: !!timeRange,
            hasSinceUntil: !!(since && until)
          });

          if (timeRange && typeof timeRange === 'string') {
            // Parse time range string to detect period
            const period = detectTimePeriod(timeRange);
            if (period) {
              console.log('BigNumberTotal buildQuery - Detected period from timeRange:', period);
              return [period];
            }
          }
          
          if (since && until) {
            // Calculate period from since/until dates
            const period = calculatePeriodFromDates(since, until);
            if (period) {
              console.log('BigNumberTotal buildQuery - Calculated period from dates:', period);
              return [period];
            }
          }
          
          // Fallback to default
          console.log('BigNumberTotal buildQuery - Using fallback period: 1 day ago');
          return ['1 day ago'];
        } else if (timeCompare === 'custom') {
          // For custom, use the time_compare_value
          const customValue = formData.time_compare_value || 
                             (formData.extra_form_data as any)?.time_compare_value;
          return customValue ? [customValue] : [];
        } else {
          // For direct string values like "1 day ago", "1 week ago", etc.
          return Array.isArray(timeCompare) ? timeCompare : [timeCompare];
        }
      }
      return [];
    })();

    return [
      {
        ...baseQueryObject,
        ...(time_offsets.length > 0 ? { time_offsets } : {}),
      },
    ];
  };

  const result = buildQueryContext(formData, buildQuery);
  console.log('BigNumberTotal buildQuery - Final result from buildQueryContext:', {
    result,
    hasQueries: !!result.queries,
    queriesLength: result.queries?.length,
    formData: result.form_data,
    timeCompare: result.form_data?.time_compare,
  });

  return result;
}
