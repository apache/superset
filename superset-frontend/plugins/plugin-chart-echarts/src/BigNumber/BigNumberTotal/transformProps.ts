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

  const timeCompare = 
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
      console.log('BigNumberTotal transformProps - Raw comparison value:', rawValue);
      
      previousPeriodValue = parseMetricValue(rawValue);
      console.log('BigNumberTotal transformProps - Parsed previousPeriodValue:', previousPeriodValue);

      if (bigNumber !== null && previousPeriodValue !== null && previousPeriodValue !== 0) {
        percentageChange = (bigNumber - previousPeriodValue) / Math.abs(previousPeriodValue);
        console.log('BigNumberTotal transformProps - Percentage change calculation:', {
          bigNumber,
          previousPeriodValue,
          difference: bigNumber - previousPeriodValue,
          absolutePrevious: Math.abs(previousPeriodValue),
          percentageChange,
        });

        if (percentageChange > 0) {
          comparisonIndicator = 'positive';
        } else if (percentageChange < 0) {
          comparisonIndicator = 'negative';
        } else {
          comparisonIndicator = 'neutral';
        }
        console.log('BigNumberTotal transformProps - Comparison indicator set to:', comparisonIndicator);
      } else {
        console.log('BigNumberTotal transformProps - Cannot calculate percentage change:', {
          bigNumber,
          previousPeriodValue,
          reason: bigNumber === null ? 'bigNumber is null' : 
                  previousPeriodValue === null ? 'previousPeriodValue is null' : 
                  previousPeriodValue === 0 ? 'previousPeriodValue is 0' : 'unknown'
        });
      }
    } else {
      console.log('BigNumberTotal transformProps - No comparison data available');
    }
  } else {
    console.log('BigNumberTotal transformProps - Skipping comparison processing:', {
      reason: queriesData.length <= 1 ? 'No comparison data' : 
              !timeCompare ? 'No time comparison' : 
              timeCompare === 'NoComparison' ? 'NoComparison selected' : 'unknown'
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
