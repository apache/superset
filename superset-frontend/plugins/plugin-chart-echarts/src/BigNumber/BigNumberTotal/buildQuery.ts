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
  getComparisonInfo,
} from '@superset-ui/core';

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
    console.log('BigNumberTotal buildQuery - baseQueryObject (Current Period):', {
      time_range: baseQueryObject.time_range,
      since: baseQueryObject.since,
      until: baseQueryObject.until,
      granularity: baseQueryObject.granularity,
      filters: baseQueryObject.filters,
      extras: baseQueryObject.extras,
      applied_time_extras: baseQueryObject.applied_time_extras,
      columns: baseQueryObject.columns,
      metrics: baseQueryObject.metrics,
      orderby: baseQueryObject.orderby,
      annotation_layers: baseQueryObject.annotation_layers,
      row_limit: baseQueryObject.row_limit,
      row_offset: baseQueryObject.row_offset,
      series_columns: baseQueryObject.series_columns,
      series_limit: baseQueryObject.series_limit,
      series_limit_metric: baseQueryObject.series_limit_metric,
      order_desc: baseQueryObject.order_desc,
      url_params: baseQueryObject.url_params,
      custom_params: baseQueryObject.custom_params,
      custom_form_data: baseQueryObject.custom_form_data,
    });
    
    const queries = [baseQueryObject];

    // Handle time comparison - time_compare is at the root level of formData
    const timeComparison = formData.time_compare;
      
    console.log('BigNumberTotal buildQuery - Time Comparison Analysis:', {
      timeComparison,
      hasTimeComparison: !!timeComparison,
      isNoComparison: timeComparison === 'NoComparison',
      comparisonType: typeof timeComparison,
      comparisonValue: timeComparison,
    });
    
    if (timeComparison && timeComparison !== 'NoComparison') {
      console.log('BigNumberTotal buildQuery - Processing time comparison for:', timeComparison);
      
      try {
        const comparisonFormData = getComparisonInfo(
          formData,
          timeComparison,
          formData.extra_form_data,
        );
        console.log('BigNumberTotal buildQuery - Comparison Form Data from getComparisonInfo:', {
          comparisonFormData,
          hasTimeRange: !!comparisonFormData.time_range,
          hasSince: !!comparisonFormData.since,
          hasUntil: !!comparisonFormData.until,
          hasGranularity: !!comparisonFormData.granularity,
          hasFilters: !!comparisonFormData.filters,
          hasAdhocFilters: !!comparisonFormData.adhoc_filters,
          hasExtraFormData: !!comparisonFormData.extra_form_data,
          comparisonKeys: Object.keys(comparisonFormData),
        });
        
        const comparisonQuery = {
          ...baseQueryObject,
          ...comparisonFormData,
          // Ensure critical fields are preserved
          datasource: baseQueryObject.datasource,
          metrics: baseQueryObject.metrics,
          filters: baseQueryObject.filters,
          adhoc_filters: baseQueryObject.adhoc_filters,
          // Preserve form data structure
          form_data: {
            ...baseQueryObject.form_data,
            ...comparisonFormData,
          },
        };
        console.log('BigNumberTotal buildQuery - Comparison Query (Previous Period):', {
          time_range: comparisonQuery.time_range,
          since: comparisonQuery.since,
          until: comparisonQuery.until,
          granularity: comparisonQuery.granularity,
          filters: comparisonQuery.filters,
          extras: comparisonQuery.extras,
          applied_time_extras: comparisonQuery.applied_time_extras,
          columns: comparisonQuery.columns,
          metrics: comparisonQuery.metrics,
          orderby: comparisonQuery.orderby,
          annotation_layers: comparisonQuery.annotation_layers,
          row_limit: comparisonQuery.row_limit,
          row_offset: comparisonQuery.row_offset,
          series_columns: comparisonQuery.series_columns,
          series_limit: comparisonQuery.series_limit,
          series_limit_metric: comparisonQuery.series_limit_metric,
          order_desc: comparisonQuery.order_desc,
          url_params: comparisonQuery.url_params,
          custom_params: comparisonQuery.custom_params,
          custom_form_data: comparisonQuery.custom_form_data,
          // Additional comparison-specific properties
          metric: comparisonQuery.metric,
          viz_type: comparisonQuery.viz_type,
          datasource: comparisonQuery.datasource,
          adhoc_filters: comparisonQuery.adhoc_filters,
        });
        
        console.log('BigNumberTotal buildQuery - Query Comparison Analysis:', {
          timeRangeChanged: baseQueryObject.time_range !== comparisonQuery.time_range,
          sinceChanged: baseQueryObject.since !== comparisonQuery.since,
          untilChanged: baseQueryObject.until !== comparisonQuery.until,
          granularityChanged: baseQueryObject.granularity !== comparisonQuery.granularity,
          filtersChanged: JSON.stringify(baseQueryObject.filters) !== JSON.stringify(comparisonQuery.filters),
          extrasChanged: JSON.stringify(baseQueryObject.extras) !== JSON.stringify(comparisonQuery.extras),
          appliedTimeExtrasChanged: JSON.stringify(baseQueryObject.applied_time_extras) !== JSON.stringify(comparisonQuery.applied_time_extras),
          metricsChanged: JSON.stringify(baseQueryObject.metrics) !== JSON.stringify(comparisonQuery.metrics),
          columnsChanged: JSON.stringify(baseQueryObject.columns) !== JSON.stringify(comparisonQuery.columns),
        });
        
        queries.push(comparisonQuery);
      } catch (error) {
        console.error('BigNumberTotal buildQuery - Error in getComparisonInfo:', error);
        console.error('BigNumberTotal buildQuery - Error details:', {
          errorMessage: error.message,
          errorStack: error.stack,
          formDataKeys: Object.keys(formData),
          timeComparison,
          extraFormData: formData.extra_form_data,
        });
      }
    } else {
      console.log('BigNumberTotal buildQuery - No time comparison or NoComparison selected:', {
        reason: !timeComparison ? 'No time comparison' : 
                timeComparison === 'NoComparison' ? 'NoComparison selected' : 'unknown',
        timeComparison,
        formDataKeys: Object.keys(formData),
        hasTimeCompare: 'time_compare' in formData,
        timeCompareValue: formData.time_compare,
      });
    }
    
    console.log('BigNumberTotal buildQuery - Final queries array summary:', {
      totalQueries: queries.length,
      queryTypes: queries.map((q, i) => ({
        index: i,
        type: i === 0 ? 'Current Period' : 'Comparison Period',
        hasTimeRange: !!q.time_range,
        hasSince: !!q.since,
        hasUntil: !!q.until,
        hasFilters: !!q.filters && q.filters.length > 0,
        hasMetrics: !!q.metrics && q.metrics.length > 0,
        metrics: q.metrics,
        timeRange: q.time_range,
        since: q.since,
        until: q.until,
      })),
    });
    return queries;
  };

  const result = buildQueryContext(formData, buildQuery);
  console.log('BigNumberTotal buildQuery - Final result from buildQueryContext:', {
    result,
    hasQueries: !!result.queries,
    queriesLength: result.queries?.length || 0,
    queriesSummary: result.queries?.map((q, i) => ({
      index: i,
      type: i === 0 ? 'Current Period' : 'Comparison Period',
      metrics: q.metrics,
      timeRange: q.time_range,
      since: q.since,
      until: q.until,
      filters: q.filters,
      extras: q.extras,
    })) || [],
    formData: result.form_data,
    datasource: result.datasource,
    resultFormat: result.result_format,
    resultType: result.result_type,
  });
  
  return result;
}
