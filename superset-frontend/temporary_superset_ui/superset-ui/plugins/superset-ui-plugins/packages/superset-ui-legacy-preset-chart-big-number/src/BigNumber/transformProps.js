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
import * as color from 'd3-color';
import { getNumberFormatter, NumberFormats } from '@superset-ui/number-format';
import { getTimeFormatter, TimeFormats, smartDateVerboseFormatter } from '@superset-ui/time-format';
import { renderTooltipFactory } from './BigNumber';

const TIME_COLUMN = '__timestamp';

function getTimeFormatterForGranularity(granularity) {
  // Translate time granularity to d3-format
  const MINUTE = '%Y-%m-%d %H:%M';
  const SUNDAY_BASED_WEEK = '%Y W%U';
  const MONDAY_BASED_WEEK = '%Y W%W';
  const { DATABASE_DATE, DATABASE_DATETIME } = TimeFormats;

  // search for `builtin_time_grains` in incubator-superset/superset/db_engine_specs/base.py
  const formats = {
    date: DATABASE_DATE,
    PT1S: DATABASE_DATETIME, // second
    PT1M: MINUTE, // minute
    PT5M: MINUTE, // 5 minute
    PT10M: MINUTE, // 10 minute
    PT15M: MINUTE, // 15 minute
    'PT0.5H': MINUTE, // half hour
    PT1H: '%Y-%m-%d %H:00', // hour
    P1D: DATABASE_DATE, // day
    P1W: SUNDAY_BASED_WEEK, // week
    P1M: 'smart_date_verbose', // month
    'P0.25Y': '%Y Q%q', // quarter
    P1Y: '%Y', // year
    // d3-time-format weeks does not support weeks start on Sunday
    '1969-12-28T00:00:00Z/P1W': SUNDAY_BASED_WEEK, // 'week_start_sunday'
    '1969-12-29T00:00:00Z/P1W': MONDAY_BASED_WEEK, // 'week_start_monday'
    'P1W/1970-01-03T00:00:00Z': SUNDAY_BASED_WEEK, // 'week_ending_saturday'
    'P1W/1970-01-04T00:00:00Z': MONDAY_BASED_WEEK, // 'week_ending_sunday'
  };

  return granularity in formats
    ? getTimeFormatter(formats[granularity])
    : smartDateVerboseFormatter;
}

export default function transformProps(chartProps) {
  const { width, height, formData, queryData } = chartProps;
  const {
    colorPicker,
    compareLag: compareLagInput,
    compareSuffix = '',
    headerFontSize,
    subheaderFontSize,
    metric,
    showTrendLine,
    startYAxisAtZero,
    subheader = '',
    vizType,
  } = formData;
  const granularity = formData.timeGrainSqla;
  let { yAxisFormat } = formData;
  const { data } = queryData;

  let mainColor;
  if (colorPicker) {
    const { r, g, b } = colorPicker;
    mainColor = color.rgb(r, g, b).hex();
  }

  let bigNumber;
  let trendLineData;
  const metricName = metric?.label ? metric.label : metric;
  const compareLag = Number(compareLagInput) || 0;
  const supportTrendLine = vizType === 'big_number';
  const supportAndShowTrendLine = supportTrendLine && showTrendLine;
  let percentChange = 0;
  let formattedSubheader = subheader;
  if (supportTrendLine) {
    const sortedData = [...data].sort((a, b) => a[TIME_COLUMN] - b[TIME_COLUMN]);
    bigNumber = sortedData.length === 0 ? null : sortedData[sortedData.length - 1][metricName];
    if (compareLag > 0) {
      const compareIndex = sortedData.length - (compareLag + 1);
      if (compareIndex >= 0) {
        const compareValue = sortedData[compareIndex][metricName];
        percentChange =
          compareValue === 0 ? 0 : (bigNumber - compareValue) / Math.abs(compareValue);
        const formatPercentChange = getNumberFormatter(NumberFormats.PERCENT_SIGNED_1_POINT);
        formattedSubheader = `${formatPercentChange(percentChange)} ${compareSuffix}`;
      }
    }
    trendLineData = supportAndShowTrendLine
      ? sortedData.map(point => ({
          x: point[TIME_COLUMN],
          y: point[metricName],
        }))
      : null;
  } else {
    bigNumber = data.length === 0 ? null : data[0][metricName];
    trendLineData = null;
  }

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  if (!yAxisFormat && chartProps.datasource && chartProps.datasource.metrics) {
    chartProps.datasource.metrics.forEach(metricEntry => {
      if (metricEntry.metric_name === metric && metricEntry.d3format) {
        yAxisFormat = metricEntry.d3format;
      }
    });
  }

  const formatDate = getTimeFormatterForGranularity(granularity);
  const formatValue = getNumberFormatter(yAxisFormat);

  return {
    width,
    height,
    bigNumber,
    className,
    formatBigNumber: formatValue,
    headerFontSize,
    subheaderFontSize,
    mainColor,
    renderTooltip: renderTooltipFactory(formatDate, formatValue),
    showTrendLine: supportAndShowTrendLine,
    startYAxisAtZero,
    subheader: formattedSubheader,
    trendLineData,
  };
}
