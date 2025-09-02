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
  extractTimegrain,
  getNumberFormatter,
  NumberFormats,
  GenericDataType,
  getMetricLabel,
  getXAxisLabel,
  Metric,
  getValueFormatter,
  t,
  tooltipHtml,
} from '@superset-ui/core';
import { EChartsCoreOption, graphic } from 'echarts/core';
import {
  BigNumberVizProps,
  BigNumberDatum,
  BigNumberWithTrendlineChartProps,
  TimeSeriesDatum,
} from '../types';
import { getDateFormatter, parseMetricValue } from '../utils';
import { getDefaultTooltip } from '../../utils/tooltip';
import { Refs } from '../../types';

const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

export default function transformProps(
  chartProps: BigNumberWithTrendlineChartProps,
): BigNumberVizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    theme,
    hooks,
    inContextMenu,
    datasource: { currencyFormats = {}, columnFormats = {} },
  } = chartProps;
  const {
    colorPicker,
    compareLag: compareLag_,
    compareSuffix = '',
    timeFormat,
    headerFontSize,
    metric = 'value',
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    yAxisFormat,
    currencyFormat,
    timeRangeFixed,
  } = formData;
  const granularity = extractTimegrain(rawFormData);
  const {
    data = [],
    colnames = [],
    coltypes = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime,
  } = queriesData[0];
  const refs: Refs = {};
  const metricName = getMetricLabel(metric);
  const compareLag = Number(compareLag_) || 0;
  let formattedSubheader = subheader;

  const { r, g, b } = colorPicker;
  const mainColor = `rgb(${r}, ${g}, ${b})`;

  const xAxisLabel = getXAxisLabel(rawFormData) as string;
  let trendLineData: TimeSeriesDatum[] | undefined;
  let percentageChange: number | undefined;
  let bigNumber = data.length === 0 ? null : data[0][metricName];
  let timestamp = data.length === 0 ? null : data[0][xAxisLabel];
  let bigNumberFallback;

  // Process the main data first
  const metricColtypeIndex = colnames.findIndex(name => name === metricName);
  const metricColtype =
    metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

  if (data.length > 0) {
    const sortedData = (data as BigNumberDatum[])
      .map(d => [d[xAxisLabel], parseMetricValue(d[metricName])])
      // sort in time descending order
      .sort((a, b) => (a[0] !== null && b[0] !== null ? b[0] - a[0] : 0));

    bigNumber = sortedData[0][1];
    timestamp = sortedData[0][0];

    if (bigNumber === null) {
      bigNumberFallback = sortedData.find(d => d[1] !== null);
      bigNumber = bigNumberFallback ? bigNumberFallback[1] : null;
      timestamp = bigNumberFallback ? bigNumberFallback[0] : null;
    }

    if (compareLag > 0) {
      const compareIndex = compareLag;
      if (compareIndex < sortedData.length) {
        const compareValue = sortedData[compareIndex][1];
        // compare values must both be non-nulls
        if (bigNumber !== null && compareValue !== null) {
          percentageChange = compareValue
            ? (bigNumber - compareValue) / Math.abs(compareValue)
            : 0;
          formattedSubheader = `${formatPercentChange(
            percentageChange,
          )} ${compareSuffix}`;
        }
      }
    }
    sortedData.reverse();
    // @ts-ignore
    trendLineData = showTrendLine ? sortedData : undefined;
  }

  // Handle comparison data if available and time comparison is enabled
  let previousPeriodValue: number | null = null;
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
      'BigNumberWithTrendline transformProps - Forcing timeCompare to inherit due to time-offset columns',
    );
  }

  // Additional debugging to understand formData structure
  console.log(
    'BigNumberWithTrendline transformProps - Full formData analysis:',
    {
      hasTimeCompare: 'time_compare' in formData,
      timeCompareValue: formData.time_compare,
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
      fullFormData: formData,
    },
  );

  // Check for time-offset columns in the single query
  const timeOffsetColumns =
    queriesData[0]?.colnames?.filter(
      (col: string) => col.includes('__') && col !== metricName,
    ) || [];

  // Debug logging
  console.log('BigNumberWithTrendline transformProps - Debug Info:', {
    queriesDataLength: queriesData.length,
    timeCompare,
    extraFormData: formData.extra_form_data,
    customFormData: formData.extra_form_data?.custom_form_data,
    hasComparisonData: timeOffsetColumns.length > 0,
    timeOffsetColumns,
    currentDataStructure: queriesData[0],
    metricName,
    bigNumber,
    xAxisLabel,
  });

  if (queriesData.length > 1) {
    console.log(
      'BigNumberWithTrendline transformProps - Comparison Period Data Analysis:',
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
  if (queriesData.length > 0 && timeCompare && timeCompare !== 'NoComparison') {
    console.log(
      'BigNumberWithTrendline transformProps - Processing time comparison data...',
    );

    const queryData = queriesData[0].data;
    const queryColnames = queriesData[0].colnames || [];

    // Look for columns with time offset suffixes (e.g., "metric__1 day ago")
    const timeOffsetColumns = queryColnames.filter(
      (col: string) => col.includes('__') && col !== metricName,
    );

    console.log(
      'BigNumberWithTrendline transformProps - Time offset columns found:',
      {
        timeOffsetColumns,
        metricName,
        allColumns: queryColnames,
      },
    );

    if (timeOffsetColumns.length > 0 && queryData && queryData.length > 0) {
      // Find the first time offset column that contains data
      for (const offsetCol of timeOffsetColumns) {
        const rawValue = queryData[0][offsetCol];
        console.log(
          'BigNumberWithTrendline transformProps - Processing offset column:',
          {
            offsetCol,
            rawValue,
            rawValueType: typeof rawValue,
          },
        );

        if (
          rawValue !== null &&
          rawValue !== undefined &&
          typeof rawValue === 'number'
        ) {
          previousPeriodValue = parseMetricValue(rawValue);
          console.log(
            'BigNumberWithTrendline transformProps - Parsed previousPeriodValue:',
            previousPeriodValue,
          );

          if (bigNumber !== null && previousPeriodValue !== null) {
            const bigNumberValue = bigNumber as number;
            let calculatedPercentageChange: number;
            
            // Handle special cases
            if (previousPeriodValue === 0) {
              if (bigNumberValue === 0) {
                // Both values are 0 - no change
                calculatedPercentageChange = 0;
                comparisonIndicator = 'neutral';
              } else if (bigNumberValue > 0) {
                // Previous was 0, now positive - infinite growth, treat as positive
                calculatedPercentageChange = 1; // 100% change as maximum
                comparisonIndicator = 'positive';
              } else {
                // Previous was 0, now negative - treat as negative  
                calculatedPercentageChange = -1; // -100% change as minimum
                comparisonIndicator = 'negative';
              }
            } else if (bigNumberValue === 0) {
              // Current is 0 but previous was not 0 - complete loss (-100%)
              calculatedPercentageChange = -1; // -100% change (complete loss)
              comparisonIndicator = 'negative';
            } else {
              // Normal calculation when both values are non-zero
              calculatedPercentageChange =
                (bigNumberValue - previousPeriodValue) /
                Math.abs(previousPeriodValue);
              
              if (calculatedPercentageChange > 0) {
                comparisonIndicator = 'positive';
              } else if (calculatedPercentageChange < 0) {
                comparisonIndicator = 'negative';
              } else {
                comparisonIndicator = 'neutral';
              }
            }
            
            percentageChange = calculatedPercentageChange;
            console.log(
              'BigNumberWithTrendline transformProps - Percentage change calculation:',
              {
                bigNumber,
                previousPeriodValue,
                difference: bigNumberValue - previousPeriodValue,
                absolutePrevious: Math.abs(previousPeriodValue),
                percentageChange: calculatedPercentageChange,
                comparisonIndicator,
              },
            );
            console.log(
              'BigNumberWithTrendline transformProps - Comparison indicator set to:',
              comparisonIndicator,
            );
            break; // Found valid comparison data, exit loop
          } else {
            console.log(
              'BigNumberWithTrendline transformProps - Cannot calculate percentage change:',
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
        } else {
          console.log(
            'BigNumberWithTrendline transformProps - Raw comparison value is not a valid number:',
            {
              rawValue,
              type: typeof rawValue,
            },
          );
        }
      }
    } else {
      console.log(
        'BigNumberWithTrendline transformProps - No time offset columns or data available',
      );
    }
  } else {
    console.log(
      'BigNumberWithTrendline transformProps - Skipping comparison processing:',
      {
        reason:
          queriesData.length === 0
            ? 'No query data'
            : !timeCompare
              ? 'No time comparison'
              : timeCompare === 'NoComparison'
                ? 'NoComparison selected'
                : 'unknown',
      },
    );
  }

  let className = '';
  if (percentageChange && percentageChange > 0) {
    className = 'positive';
  } else if (percentageChange && percentageChange < 0) {
    className = 'negative';
  }

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricEntry => metricEntry.metric_name === metric,
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
    metricColtype === GenericDataType.Temporal ||
    metricColtype === GenericDataType.String ||
    forceTimestampFormatting
      ? formatTime
      : numberFormatter;

  if (trendLineData && timeRangeFixed && fromDatetime) {
    const toDatetimeOrToday = toDatetime ?? Date.now();
    if (!trendLineData[0][0] || trendLineData[0][0] > fromDatetime) {
      trendLineData.unshift([fromDatetime, null]);
    }
    if (
      !trendLineData[trendLineData.length - 1][0] ||
      trendLineData[trendLineData.length - 1][0]! < toDatetimeOrToday
    ) {
      trendLineData.push([toDatetimeOrToday, null]);
    }
  }

  const echartOptions: EChartsCoreOption = trendLineData
    ? {
        series: [
          {
            data: trendLineData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 10,
            showSymbol: false,
            color: mainColor,
            areaStyle: {
              color: new graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: mainColor,
                },
                {
                  offset: 1,
                  color: theme.colors.grayscale.light5,
                },
              ]),
            },
          },
        ],
        xAxis: {
          min: trendLineData[0][0],
          max: trendLineData[trendLineData.length - 1][0],
          show: false,
          type: 'value',
        },
        yAxis: {
          scale: !startYAxisAtZero,
          show: false,
        },
        grid: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
        tooltip: {
          ...getDefaultTooltip(refs),
          show: !inContextMenu,
          trigger: 'axis',
          formatter: (params: { data: TimeSeriesDatum }[]) =>
            tooltipHtml(
              [
                [
                  metricName,
                  params[0].data[1] === null
                    ? t('N/A')
                    : headerFormatter.format(params[0].data[1]),
                ],
              ],
              formatTime(params[0].data[0]),
            ),
        },
        aria: {
          enabled: true,
          label: {
            description: `Big number visualization ${subheader}`,
          },
        },
      }
    : {};

  const { onContextMenu } = hooks;

  return {
    width,
    height,
    bigNumber,
    // @ts-ignore
    bigNumberFallback,
    className,
    headerFormatter,
    formatTime,
    formData,
    headerFontSize,
    subheaderFontSize,
    mainColor,
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader: formattedSubheader,
    timestamp,
    trendLineData,
    echartOptions,
    onContextMenu,
    xValueFormatter: formatTime,
    refs,
    previousPeriodValue,
    percentageChange,
    comparisonIndicator,
  };
}
