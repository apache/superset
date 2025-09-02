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

  // Handle time comparison - time_compare is at the root level of formData
  const timeCompare = formData.time_compare || 
                     (formData.extra_form_data?.custom_form_data as any)?.time_compare || 
                     (formData.extra_form_data as any)?.time_compare;
    
  // Debug logging
  console.log('BigNumberTotal transformProps - Debug Info:', {
    queriesDataLength: queriesData.length,
    timeCompare,
    extraFormData: formData.extra_form_data,
    customFormData: formData.extra_form_data?.custom_form_data,
    hasComparisonData: queriesData.length > 1,
    comparisonDataExists: queriesData.length > 1 ? !!queriesData[1] : false,
    comparisonDataStructure: queriesData.length > 1 ? queriesData[1] : null,
    currentDataStructure: queriesData[0],
    metricName,
    bigNumber,
  });

  // Enhanced data structure analysis
  if (queriesData.length > 0) {
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
      metricColumnType: queriesData[0].colnames?.includes(metricName) ? 
        queriesData[0].coltypes?.[queriesData[0].colnames?.indexOf(metricName)] : null,
    });
  }

  if (queriesData.length > 1) {
    console.log('BigNumberTotal transformProps - Comparison Period Data Analysis:', {
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
      metricColumnType: queriesData[1].colnames?.includes(metricName) ? 
        queriesData[1].coltypes?.[queriesData[1].colnames?.indexOf(metricName)] : null,
    });
  }
  
  if (queriesData.length > 1 && timeCompare && timeCompare !== 'NoComparison') {
    console.log('BigNumberTotal transformProps - Processing comparison data...');
    
    const comparisonData = queriesData[1];
    console.log('BigNumberTotal transformProps - Comparison data details:', {
      comparisonData,
      hasData: !!comparisonData.data,
      dataLength: comparisonData.data?.length || 0,
      firstRow: comparisonData.data?.[0],
      metricValue: comparisonData.data?.[0]?.[metricName],
    });
    
    if (comparisonData.data && comparisonData.data.length > 0) {
      const rawValue = comparisonData.data[0][metricName];
      console.log('BigNumberTotal transformProps - Raw comparison value analysis:', {
        rawValue,
        rawValueType: typeof rawValue,
        isNull: rawValue === null,
        isUndefined: rawValue === undefined,
        isNumber: typeof rawValue === 'number',
        isString: typeof rawValue === 'string',
        isBoolean: typeof rawValue === 'boolean',
        stringLength: typeof rawValue === 'string' ? (rawValue as string).length : null,
        numericValue: typeof rawValue === 'string' ? parseFloat(rawValue as string) : null,
        parseFloatResult: typeof rawValue === 'string' ? parseFloat(rawValue as string) : null,
        isNaN: typeof rawValue === 'string' ? isNaN(parseFloat(rawValue as string)) : null,
      });
      
      previousPeriodValue = parseMetricValue(rawValue);
      console.log('BigNumberTotal transformProps - Parsed previousPeriodValue analysis:', {
        previousPeriodValue,
        previousPeriodValueType: typeof previousPeriodValue,
        isNull: previousPeriodValue === null,
        isUndefined: previousPeriodValue === undefined,
        isNumber: typeof previousPeriodValue === 'number',
        isFinite: typeof previousPeriodValue === 'number' ? isFinite(previousPeriodValue) : null,
        isNaN: typeof previousPeriodValue === 'number' ? isNaN(previousPeriodValue) : null,
        absoluteValue: typeof previousPeriodValue === 'number' ? Math.abs(previousPeriodValue) : null,
        isZero: previousPeriodValue === 0,
        isPositive: typeof previousPeriodValue === 'number' ? previousPeriodValue > 0 : null,
        isNegative: typeof previousPeriodValue === 'number' ? previousPeriodValue < 0 : null,
      });

      if (bigNumber !== null && previousPeriodValue !== null && previousPeriodValue !== 0) {
        const difference = bigNumber - previousPeriodValue;
        const absolutePrevious = Math.abs(previousPeriodValue);
        percentageChange = difference / absolutePrevious;
        
        console.log('BigNumberTotal transformProps - Percentage change calculation details:', {
          bigNumber,
          bigNumberType: typeof bigNumber,
          previousPeriodValue,
          previousPeriodValueType: typeof previousPeriodValue,
          difference,
          differenceType: typeof difference,
          absolutePrevious,
          absolutePreviousType: typeof absolutePrevious,
          percentageChange,
          percentageChangeType: typeof percentageChange,
          percentageChangeAsPercent: percentageChange * 100,
          isFinite: isFinite(percentageChange),
          isNaN: isNaN(percentageChange),
          calculation: `${bigNumber} - ${previousPeriodValue} / |${previousPeriodValue}| = ${difference} / ${absolutePrevious} = ${percentageChange}`,
        });

        if (percentageChange > 0) {
          comparisonIndicator = 'positive';
        } else if (percentageChange < 0) {
          comparisonIndicator = 'negative';
        } else {
          comparisonIndicator = 'neutral';
        }
        console.log('BigNumberTotal transformProps - Comparison indicator determination:', {
          percentageChange,
          isPositive: percentageChange > 0,
          isNegative: percentageChange < 0,
          isZero: percentageChange === 0,
          comparisonIndicator,
          indicatorReason: percentageChange > 0 ? 'positive change' : 
                          percentageChange < 0 ? 'negative change' : 'no change',
        });
      } else {
        console.log('BigNumberTotal transformProps - Cannot calculate percentage change - detailed analysis:', {
          bigNumber,
          bigNumberType: typeof bigNumber,
          bigNumberIsNull: bigNumber === null,
          bigNumberIsUndefined: bigNumber === undefined,
          bigNumberIsNumber: typeof bigNumber === 'number',
          bigNumberIsFinite: typeof bigNumber === 'number' ? isFinite(bigNumber) : null,
          bigNumberIsNaN: typeof bigNumber === 'number' ? isNaN(bigNumber) : null,
          previousPeriodValue,
          previousPeriodValueType: typeof previousPeriodValue,
          previousPeriodValueIsNull: previousPeriodValue === null,
          previousPeriodValueIsUndefined: previousPeriodValue === undefined,
          previousPeriodValueIsNumber: typeof previousPeriodValue === 'number',
          previousPeriodValueIsFinite: typeof previousPeriodValue === 'number' ? isFinite(previousPeriodValue) : null,
          previousPeriodValueIsNaN: typeof previousPeriodValue === 'number' ? isNaN(previousPeriodValue) : null,
          previousPeriodValueIsZero: previousPeriodValue === 0,
          reason: bigNumber === null ? 'bigNumber is null' : 
                  previousPeriodValue === null ? 'previousPeriodValue is null' : 
                  previousPeriodValue === 0 ? 'previousPeriodValue is 0' : 'unknown',
          calculationPossible: bigNumber !== null && previousPeriodValue !== null && previousPeriodValue !== 0,
        });
      }
    } else {
      console.log('BigNumberTotal transformProps - No comparison data available - detailed analysis:', {
        comparisonDataExists: !!comparisonData,
        comparisonData: comparisonData,
        hasData: !!comparisonData.data,
        dataLength: comparisonData.data?.length || 0,
        dataType: typeof comparisonData.data,
        isArray: Array.isArray(comparisonData.data),
        firstRow: comparisonData.data?.[0],
        metricValue: comparisonData.data?.[0]?.[metricName],
        colnames: comparisonData.colnames,
        coltypes: comparisonData.coltypes,
        hasMetricColumn: comparisonData.colnames?.includes(metricName),
        metricColumnIndex: comparisonData.colnames?.indexOf(metricName),
      });
    }
  } else {
    console.log('BigNumberTotal transformProps - Skipping comparison processing - detailed analysis:', {
      reason: queriesData.length <= 1 ? 'No comparison data' : 
              !timeCompare ? 'No time comparison' : 
              timeCompare === 'NoComparison' ? 'NoComparison selected' : 'unknown',
      queriesDataLength: queriesData.length,
      timeCompare,
      timeCompareType: typeof timeCompare,
      timeCompareIsNoComparison: timeCompare === 'NoComparison',
      hasTimeCompare: !!timeCompare,
      formDataKeys: Object.keys(formData),
      hasTimeCompareKey: 'time_compare' in formData,
      timeCompareValue: formData.time_compare,
    });
  }

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

  return {
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
}
