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

import { getMetricLabel } from '@superset-ui/core';

export interface BigNumberComparisonData {
  percentageChange: number;
  comparisonIndicator: 'positive' | 'negative' | 'neutral';
  previousPeriodValue: number;
  currentValue: number;
}

/**
 * Extracts comparison data from BigNumber chart queries response
 * This replicates the logic from BigNumber transformProps but for use in SliceHeader
 */
export function getBigNumberComparisonData(
  queriesResponse: any[],
  formData: any,
): BigNumberComparisonData | null {
  console.group('🔧 getBigNumberComparisonData - COMPREHENSIVE DEBUG');
  console.log('📥 Input Analysis:', {
    hasQueriesResponse: !!queriesResponse,
    queriesResponseLength: queriesResponse?.length || 0,
    hasFormData: !!formData,
    formDataKeys: formData ? Object.keys(formData) : [],
    vizType: formData?.viz_type,
  });

  if (!queriesResponse || queriesResponse.length === 0) {
    console.log('❌ No queriesResponse available');
    console.groupEnd();
    return null;
  }

  const { data = [], colnames = [] } = queriesResponse[0];
  console.log('📊 Query Data Analysis:', {
    hasData: !!data,
    dataLength: data?.length || 0,
    hasColnames: !!colnames,
    colnamesLength: colnames?.length || 0,
    colnames,
    firstRowData: data?.[0],
  });

  if (!data || data.length === 0) {
    console.log('❌ No data available in queriesResponse');
    console.groupEnd();
    return null;
  }

  const metric = formData?.metric || 'value';
  const metricName = getMetricLabel(metric);
  
  console.log('🎯 Metric Analysis:', {
    metric,
    metricName,
    metricType: typeof metric,
  });
  
  // Check if this is a BigNumber chart with time comparison
  const vizType = formData?.viz_type;
  console.log('📋 Chart Type Check:', {
    vizType,
    isBigNumberChart: vizType && vizType.includes('big_number'),
  });

  if (!vizType || !vizType.includes('big_number')) {
    console.log('❌ Not a BigNumber chart - skipping comparison data extraction');
    console.groupEnd();
    return null;
  }

  // Check for time comparison
  let timeCompare =
    formData.time_compare ||
    (formData.extra_form_data?.custom_form_data as any)?.time_compare ||
    (formData.extra_form_data as any)?.time_compare;

  // Check for time-offset columns
  const hasTimeOffsetColumns = colnames?.some(
    (col: string) => col.includes('__') && col !== metricName,
  );

  if (!timeCompare && hasTimeOffsetColumns) {
    timeCompare = 'inherit';
  }

  console.log('⏰ Time Comparison Analysis:', {
    timeCompare,
    hasTimeOffsetColumns,
    timeCompareSource: formData.time_compare ? 'formData.time_compare' : 
                     (formData.extra_form_data?.custom_form_data as any)?.time_compare ? 'custom_form_data' :
                     (formData.extra_form_data as any)?.time_compare ? 'extra_form_data' :
                     hasTimeOffsetColumns ? 'forced_inherit' : 'none',
  });

  if (!timeCompare || timeCompare === 'custom') {
    console.log('❌ No valid time comparison found - skipping');
    console.groupEnd();
    return null;
  }

  // Get current period value
  const currentValue = data[0][metricName];
  console.log('📊 Current Value Analysis:', {
    currentValue,
    currentValueType: typeof currentValue,
    metricName,
    hasCurrentValue: currentValue !== null && currentValue !== undefined,
  });

  if (currentValue === null || currentValue === undefined) {
    console.log('❌ No current value available');
    console.groupEnd();
    return null;
  }

  // Find time offset columns and extract previous period value
  let previousPeriodValue: number | null = null;

  for (const col of colnames) {
    if (col.includes('__') && col !== metricName) {
      const offsetCol = col;
      const rawValue = data[0][offsetCol];
      
      if (rawValue !== null && rawValue !== undefined) {
        previousPeriodValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
        break;
      }
    }
  }

  if (previousPeriodValue === null || previousPeriodValue === undefined) {
    return null;
  }

  // Calculate percentage change and indicator
  let percentageChange: number;
  let comparisonIndicator: 'positive' | 'negative' | 'neutral';

  if (previousPeriodValue === 0) {
    if (currentValue === 0) {
      percentageChange = 0;
      comparisonIndicator = 'neutral';
    } else if (currentValue > 0) {
      percentageChange = 1; // 100% change as maximum
      comparisonIndicator = 'positive';
    } else {
      percentageChange = -1; // -100% change as minimum
      comparisonIndicator = 'negative';
    }
  } else if (currentValue === 0) {
    percentageChange = -1; // -100% change (complete loss)
    comparisonIndicator = 'negative';
  } else {
    percentageChange = (currentValue - previousPeriodValue) / Math.abs(previousPeriodValue);
    
    if (percentageChange > 0) {
      comparisonIndicator = 'positive';
    } else if (percentageChange < 0) {
      comparisonIndicator = 'negative';
    } else {
      comparisonIndicator = 'neutral';
    }
  }

  const result = {
    percentageChange,
    comparisonIndicator,
    previousPeriodValue,
    currentValue,
  };

  console.log('✅ FINAL COMPARISON RESULT:', result);
  console.groupEnd();

  return result;
}
