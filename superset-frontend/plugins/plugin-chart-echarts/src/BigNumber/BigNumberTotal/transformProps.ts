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
  ColorFormatters,
  getColorFormatters,
  Metric,
} from '@superset-ui/chart-controls';
import {
  GenericDataType,
  getMetricLabel,
  extractTimegrain,
  QueryFormData,
  getValueFormatter,
} from '@superset-ui/core';
import { BigNumberTotalChartProps, BigNumberVizProps } from '../types';
import { getDateFormatter, parseMetricValue } from '../utils';
import { Refs } from '../../types';

export default function transformProps(
  chartProps: BigNumberTotalChartProps,
): BigNumberVizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    hooks,
    datasource: { currencyFormats = {}, columnFormats = {} },
  } = chartProps;
  const {
    headerFontSize,
    metric = 'value',
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    timeFormat,
    yAxisFormat,
    conditionalFormatting,
    currencyFormat,
  } = formData;
  const refs: Refs = {};
  const { data = [], coltypes = [] } = queriesData[0];
  const granularity = extractTimegrain(rawFormData as QueryFormData);
  const metricName = getMetricLabel(metric);
  const formattedSubheader = subheader;
  const bigNumber =
    data.length === 0 ? null : parseMetricValue(data[0][metricName]);

  // Handle comparison data if available and time comparison is enabled
  let previousPeriodValue: number | null = null;
  let percentageChange: number | undefined;
  let comparisonIndicator: 'positive' | 'negative' | 'neutral' | undefined;

  // Handle time comparison - check all possible locations where time_compare might be stored
  let timeCompare =
    formData.time_compare ||
    (formData.extra_form_data?.custom_form_data as any)?.time_compare ||
    (formData.extra_form_data as any)?.time_compare;

  // If we have time-offset columns but no timeCompare detected, force it to 'inherit'
  // This handles cases where the UI selection isn't properly propagated to formData
  const hasTimeOffsetColumns = queriesData[0]?.colnames?.some(
    (col: string) => col.includes('__') && col !== metricName,
  );

  if (!timeCompare && hasTimeOffsetColumns) {
    timeCompare = 'inherit';
    console.log(
      'BigNumberTotal transformProps - Forcing timeCompare to inherit due to time-offset columns',
    );
  }

  // Comprehensive debug logging
  console.group('🔍 BigNumberTotal transformProps - COMPREHENSIVE DEBUG');
  console.log('📊 Input Data Analysis:', {
    chartPropsKeys: Object.keys(chartProps),
    hasQueriesData: !!queriesData,
    queriesDataLength: queriesData?.length,
    hasFormData: !!formData,
    metricName,
    bigNumber,
    bigNumberType: typeof bigNumber,
  });

  console.log('📋 FormData Comprehensive Analysis:', {
    hasTimeCompare: 'time_compare' in formData,
    timeCompareValue: formData.time_compare,
    timeCompareType: typeof formData.time_compare,
    hasExtraFormData: 'extra_form_data' in formData,
    extraFormDataKeys: formData.extra_form_data
      ? Object.keys(formData.extra_form_data)
      : [],
    extraFormDataTimeCompare: (formData.extra_form_data as any)?.time_compare,
    customFormDataTimeCompare: (
      formData.extra_form_data?.custom_form_data as any
    )?.time_compare,
    allFormDataKeys: Object.keys(formData),
    hasTimeOffsetColumns,
    finalTimeCompare: timeCompare,
    finalTimeCompareType: typeof timeCompare,
  });

  console.log('🗂️ Query Data Analysis:', {
    firstQueryData: queriesData[0],
    colnames: queriesData[0]?.colnames,
    hasData: !!queriesData[0]?.data,
    dataLength: queriesData[0]?.data?.length,
    firstRow: queriesData[0]?.data?.[0],
    hasTimeOffsetColumns,
    timeOffsetColumns: queriesData[0]?.colnames?.filter(
      (col: string) => col.includes('__') && col !== metricName,
    ),
  });
  console.groupEnd();

  // Check for time-offset columns in the single query
  const timeOffsetColumns =
    queriesData[0]?.colnames?.filter(
      (col: string) => col.includes('__') && col !== metricName,
    ) || [];

  // Debug logging
  console.log('BigNumberTotal transformProps - Debug Info:', {
    queriesDataLength: queriesData.length,
    timeCompare,
    extraFormData: formData.extra_form_data,
    customFormData: formData.extra_form_data?.custom_form_data,
    hasComparisonData: timeOffsetColumns.length > 0,
    timeOffsetColumns,
    currentDataStructure: queriesData[0],
    metricName,
    bigNumber,
  });

  console.log('BigNumberTotal transformProps - Current Period Data Analysis:', {
    hasData: !!queriesData[0].data,
    dataLength: queriesData[0].data?.length || 0,
    dataType: typeof queriesData[0].data,
    isArray: Array.isArray(queriesData[0].data),
    firstRow: queriesData[0].data?.[0],
    allRows: queriesData[0].data,
    colnames: queriesData[0].colnames,
    coltypes: queriesData[0].coltypes,
    hasMetricColumn: queriesData[0].colnames?.includes(metricName),
    metricColumnIndex: queriesData[0].colnames?.indexOf(metricName),
    metricColumnType:
      queriesData[0].coltypes?.[
        queriesData[0].colnames?.indexOf(metricName) || -1
      ] || null,
  });

  if (queriesData.length > 1) {
    console.log(
      'BigNumberTotal transformProps - Comparison Period Data Analysis:',
      {
        hasData: !!queriesData[1].data,
        dataLength: queriesData[1].data?.length || 0,
        dataType: typeof queriesData[1].data,
        isArray: Array.isArray(queriesData[1].data),
        firstRow: queriesData[1].data?.[0],
        allRows: queriesData[1].data,
        colnames: queriesData[1].colnames,
        coltypes: queriesData[1].coltypes,
        hasMetricColumn: queriesData[1].colnames?.includes(metricName),
        metricColumnIndex: queriesData[1].colnames?.indexOf(metricName),
        metricColumnType:
          queriesData[1].coltypes?.[
            queriesData[1].colnames?.indexOf(metricName) || -1
          ] || null,
      },
    );
  }

  // With single-query approach, we need to look for time-offset data in the same result
  console.group('⚙️ BigNumberTotal transformProps - COMPARISON PROCESSING');

  console.log('🔄 Processing conditions:', {
    hasQueriesData: queriesData.length > 0,
    timeCompare,
    timeCompareValid: timeCompare && timeCompare !== 'NoComparison',
    willProcess:
      queriesData.length > 0 && timeCompare && timeCompare !== 'NoComparison',
  });

  if (queriesData.length > 0 && timeCompare && timeCompare !== 'NoComparison') {
    console.log('✅ Starting time comparison data processing...');

    const queryData = queriesData[0].data;
    const queryColnames = queriesData[0].colnames || [];

    // Look for columns with time offset suffixes (e.g., "metric__1 day ago")
    const timeOffsetColumns = queryColnames.filter(
      (col: string) => col.includes('__') && col !== metricName,
    );

    console.log('📋 Time offset analysis:', {
      timeOffsetColumns,
      metricName,
      allColumns: queryColnames,
      hasTimeOffsetColumns: timeOffsetColumns.length > 0,
      queryDataLength: queryData?.length,
      firstRowData: queryData?.[0],
    });

    if (timeOffsetColumns.length > 0 && queryData && queryData.length > 0) {
      // Find the first time offset column that contains data
      for (const offsetCol of timeOffsetColumns) {
        const rawValue = queryData[0][offsetCol];
        console.log(
          'BigNumberTotal transformProps - Processing offset column:',
          {
            offsetCol,
            rawValue,
            rawValueType: typeof rawValue,
          },
        );

        if (rawValue !== null && rawValue !== undefined) {
          previousPeriodValue = parseMetricValue(rawValue);
          console.log(
            'BigNumberTotal transformProps - Parsed previousPeriodValue:',
            previousPeriodValue,
          );

          if (previousPeriodValue !== null) {
            // Handle special cases
            if (previousPeriodValue === 0) {
              if (bigNumber === null || bigNumber === 0) {
                // Both values are 0 or current is null - no change or neutral
                percentageChange = 0;
                comparisonIndicator = 'neutral';
              } else if (bigNumber > 0) {
                // Previous was 0, now positive - infinite growth, treat as positive
                percentageChange = 1; // 100% change as maximum
                comparisonIndicator = 'positive';
              } else {
                // Previous was 0, now negative - treat as negative
                percentageChange = -1; // -100% change as minimum
                comparisonIndicator = 'negative';
              }
            } else if (bigNumber === null || bigNumber === 0) {
              // Current value is null or 0 but previous had value - complete loss
              percentageChange = -1; // -100% change (complete loss)
              comparisonIndicator = 'negative';
            } else {
              // Normal calculation when both values are non-zero
              percentageChange =
                (bigNumber - previousPeriodValue) /
                Math.abs(previousPeriodValue);

              if (percentageChange > 0) {
                comparisonIndicator = 'positive';
              } else if (percentageChange < 0) {
                comparisonIndicator = 'negative';
              } else {
                comparisonIndicator = 'neutral';
              }
            }

            console.log(
              'BigNumberTotal transformProps - Percentage change calculation:',
              {
                bigNumber,
                previousPeriodValue,
                difference: (bigNumber || 0) - previousPeriodValue,
                absolutePrevious: Math.abs(previousPeriodValue),
                percentageChange,
                comparisonIndicator,
              },
            );
            console.log(
              'BigNumberTotal transformProps - Comparison indicator set to:',
              comparisonIndicator,
            );
            break; // Found valid comparison data, exit loop
          } else {
            console.log(
              'BigNumberTotal transformProps - Cannot calculate percentage change:',
              {
                bigNumber,
                previousPeriodValue,
                reason:
                  bigNumber === null
                    ? 'bigNumber is null'
                    : previousPeriodValue === null
                      ? 'previousPeriodValue is null'
                      : previousPeriodValue === 0
                        ? 'previousPeriodValue is 0'
                        : 'unknown',
              },
            );
          }
        }
      }
    } else {
      console.log(
        'BigNumberTotal transformProps - No time offset columns or data available',
      );
    }
  } else {
    console.log('❌ Skipping comparison processing:', {
      reason:
        queriesData.length === 0
          ? 'No query data'
          : !timeCompare
            ? 'No time comparison'
            : timeCompare === 'NoComparison'
              ? 'NoComparison selected'
              : 'unknown',
    });
  }

  console.log('🎯 FINAL COMPARISON RESULTS:', {
    previousPeriodValue,
    previousPeriodValueType: typeof previousPeriodValue,
    percentageChange,
    percentageChangeType: typeof percentageChange,
    comparisonIndicator,
    comparisonIndicatorType: typeof comparisonIndicator,
    hasValidComparison:
      percentageChange !== undefined && comparisonIndicator !== undefined,
    comparisonCalculation:
      previousPeriodValue !== null && bigNumber !== null
        ? {
            current: bigNumber,
            previous: previousPeriodValue,
            difference: (bigNumber as number) - previousPeriodValue,
            calculation: `(${bigNumber} - ${previousPeriodValue}) / ${Math.abs(
              previousPeriodValue,
            )} = ${percentageChange}`,
          }
        : 'Cannot calculate',
  });
  console.groupEnd();

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === metric,
    );
  }

  const formatTime = getDateFormatter(
    timeFormat,
    granularity,
    metricEntry?.d3format,
  );

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );

  const headerFormatter =
    coltypes[0] === GenericDataType.Temporal ||
    coltypes[0] === GenericDataType.String ||
    forceTimestampFormatting
      ? formatTime
      : numberFormatter;

  const { onContextMenu } = hooks;

  const defaultColorFormatters = [] as ColorFormatters;

  const colorThresholdFormatters =
    getColorFormatters(conditionalFormatting, data, false) ??
    defaultColorFormatters;

  const returnProps = {
    width,
    height,
    bigNumber,
    headerFormatter,
    headerFontSize,
    subheaderFontSize,
    subheader: formattedSubheader,
    onContextMenu,
    refs,
    colorThresholdFormatters,
    previousPeriodValue,
    percentageChange,
    comparisonIndicator,
  };

  console.group('🚀 BigNumberTotal transformProps - FINAL RETURN PROPS');
  console.log('📦 Returning props to BigNumberViz:', {
    width,
    height,
    bigNumber,
    bigNumberType: typeof bigNumber,
    subheader: formattedSubheader,
    previousPeriodValue,
    previousPeriodValueType: typeof previousPeriodValue,
    percentageChange,
    percentageChangeType: typeof percentageChange,
    comparisonIndicator,
    comparisonIndicatorType: typeof comparisonIndicator,
    hasComparison:
      percentageChange !== undefined && comparisonIndicator !== undefined,
    formData: formData.time_compare,
    returnPropsKeys: Object.keys(returnProps),
  });
  console.groupEnd();

  return returnProps;
}
