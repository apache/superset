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
  ensureIsArray,
  getXAxisColumn,
  isXAxisSet,
  QueryFormData,
} from '@superset-ui/core';
import {
  flattenOperator,
  pivotOperator,
  resampleOperator,
  rollingWindowOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  // Debug logging for buildQuery
  console.log('BigNumberWithTrendline buildQuery - Input formData:', {
    hasExtraFormData: !!formData.extra_form_data,
    extraFormData: formData.extra_form_data,
    customFormData: formData.extra_form_data?.custom_form_data,
    timeCompare: formData.time_compare,
    timeCompareExtra: (formData.extra_form_data?.custom_form_data as any)?.time_compare,
    timeCompareDirect: (formData.extra_form_data as any)?.time_compare,
    metrics: formData.metrics,
    datasource: formData.datasource,
    xAxis: formData.x_axis,
    timeGrain: formData.time_grain_sqla,
    timeRange: formData.time_range,
    since: formData.since,
    until: formData.until,
    granularity: formData.granularity,
    filters: formData.filters,
    adhocFilters: formData.adhoc_filters,
  });

  const buildQuery = (baseQueryObject: any) => {
    console.log('BigNumberWithTrendline buildQuery - baseQueryObject:', baseQueryObject);

    // Use the proper Superset single-query approach for time comparison
    // This ensures that formData.time_compare is preserved and passed to transformProps
    return [
      {
        ...baseQueryObject,
        columns: [
          ...(isXAxisSet(formData)
            ? ensureIsArray(getXAxisColumn(formData))
            : []),
        ],
        ...(isXAxisSet(formData) ? {} : { is_timeseries: true }),
        post_processing: [
          pivotOperator(formData, baseQueryObject),
          rollingWindowOperator(formData, baseQueryObject),
          resampleOperator(formData, baseQueryObject),
          flattenOperator(formData, baseQueryObject),
        ],
        // Add time_offsets for time comparison - this is what Superset expects
        ...(formData.time_compare || 
            (formData.extra_form_data?.custom_form_data as any)?.time_compare || 
            (formData.extra_form_data as any)?.time_compare) && 
            (formData.time_compare || 
             (formData.extra_form_data?.custom_form_data as any)?.time_compare || 
             (formData.extra_form_data as any)?.time_compare) !== 'NoComparison' ? {
          time_offsets: (() => {
            const timeCompare = formData.time_compare || 
                               (formData.extra_form_data?.custom_form_data as any)?.time_compare || 
                               (formData.extra_form_data as any)?.time_compare;
            
            // Convert string time comparison to array format for transformProps
            if (timeCompare && timeCompare !== 'NoComparison') {
              if (timeCompare === 'inherit') {
                // Enhanced inherit logic: detect actual time period and apply same offset
                const timeRange = formData.time_range;
                const since = formData.since;
                const until = formData.until;
                
                console.log('BigNumberWithTrendline buildQuery - Inherit logic analysis:', {
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
                    console.log('BigNumberWithTrendline buildQuery - Detected period from timeRange:', period);
                    return [period];
                  }
                }
                
                if (since && until) {
                  // Calculate period from since/until dates
                  const period = calculatePeriodFromDates(since, until);
                  if (period) {
                    console.log('BigNumberWithTrendline buildQuery - Calculated period from dates:', period);
                    return [period];
                  }
                }
                
                // Fallback to default
                console.log('BigNumberWithTrendline buildQuery - Using fallback period: 1 day ago');
                return ['1 day ago'];
              } else if (timeCompare === 'custom') {
                // For custom, use the time_compare_value
                const customValue = formData.time_compare_value || 
                                  (formData.extra_form_data?.custom_form_data as any)?.time_compare_value ||
                                  (formData.extra_form_data as any)?.time_compare_value;
                return customValue ? [customValue] : [];
              } else {
                // For direct string values like "1 day ago", "1 week ago", etc.
                return Array.isArray(timeCompare) ? timeCompare : [timeCompare];
              }
            }
            return [];
          })(),
        } : {},
      },
    ];
  };

  const result = buildQueryContext(formData, buildQuery);
  console.log('BigNumberWithTrendline buildQuery - Final result from buildQueryContext:', {
    result,
    hasQueries: !!result.queries,
    queriesLength: result.queries?.length,
    formData: result.form_data,
    timeCompare: result.form_data?.time_compare,
  });

  return result;
}

/**
 * Detect time period from time range string
 * Examples: "Last 7 days" -> "7 days ago", "Last 1 month" -> "1 month ago"
 */
function detectTimePeriod(timeRange: string): string | null {
  const lowerTimeRange = timeRange.toLowerCase();
  
  // Match patterns like "Last X days", "Last X weeks", "Last X months", etc.
  const patterns = [
    { regex: /last\s+(\d+)\s+days?/i, unit: 'days' },
    { regex: /last\s+(\d+)\s+weeks?/i, unit: 'weeks' },
    { regex: /last\s+(\d+)\s+months?/i, unit: 'months' },
    { regex: /last\s+(\d+)\s+years?/i, unit: 'years' },
    { regex: /last\s+(\d+)\s+hours?/i, unit: 'hours' },
  ];
  
  for (const pattern of patterns) {
    const match = timeRange.match(pattern.regex);
    if (match) {
      const value = parseInt(match[1], 10);
      // Handle singular vs plural
      const unit = value === 1 ? pattern.unit.replace(/s$/, '') : pattern.unit;
      return `${value} ${unit} ago`;
    }
  }
  
  // Handle special cases
  if (lowerTimeRange.includes('today')) return '1 day ago';
  if (lowerTimeRange.includes('yesterday')) return '2 days ago';
  if (lowerTimeRange.includes('this week')) return '1 week ago';
  if (lowerTimeRange.includes('this month')) return '1 month ago';
  if (lowerTimeRange.includes('this year')) return '1 year ago';
  
  return null;
}

/**
 * Calculate time period from since/until dates
 * Returns the period in a format like "4 days ago", "1 week ago", etc.
 */
function calculatePeriodFromDates(since: string, until: string): string | null {
  try {
    const sinceDate = new Date(since);
    const untilDate = new Date(until);
    
    if (isNaN(sinceDate.getTime()) || isNaN(untilDate.getTime())) {
      return null;
    }
    
    const diffMs = untilDate.getTime() - sinceDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    
    if (diffDays <= 0) return null;
    
    // Convert to appropriate unit
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.ceil(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.ceil(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    
    const years = Math.ceil(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  } catch (error) {
    console.error('Error calculating period from dates:', error);
    return null;
  }
}
