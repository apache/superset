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
  ChartProps,
  CategoricalColorNamespace,
  getNumberFormatter,
  smartDateVerboseFormatter,
} from '@superset-ui/core';
import { EchartsTimeseriesProps } from './types';
import { ForecastSeriesEnum } from '../types';
import { extractTimeseriesSeries } from '../utils/series';
import {
  extractForecastSeriesContext,
  extractProphetValuesFromTooltipParams,
  formatProphetTooltipSeries,
  rebaseTimeseriesDatum,
} from '../utils/prophet';

export default function transformProps(chartProps: ChartProps): EchartsTimeseriesProps {
  const { width, height, formData, queryData } = chartProps;
  const {
    area,
    colorScheme,
    contributionMode,
    forecastEnabled,
    seriesType,
    logAxis,
    opacity,
    stack,
    markerEnabled,
    markerSize,
    minorSplitLine,
    yAxisFormat,
    zoomable,
  } = formData;

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const rebasedData = rebaseTimeseriesDatum(queryData.data || []);
  const rawSeries = extractTimeseriesSeries(rebasedData);

  const series: echarts.EChartOption.Series[] = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);

  rawSeries.forEach(entry => {
    const forecastSeries = extractForecastSeriesContext(entry.name || '');
    const isConfidenceBand =
      forecastSeries.type === ForecastSeriesEnum.ForecastLower ||
      forecastSeries.type === ForecastSeriesEnum.ForecastUpper;
    const isObservation = forecastSeries.type === ForecastSeriesEnum.Observation;
    const isTrend = forecastSeries.type === ForecastSeriesEnum.ForecastTrend;
    let stackId;
    if (isConfidenceBand) {
      stackId = forecastSeries.name;
    } else if (stack && isObservation) {
      // the suffix of the observation series is '' (falsy), which disables
      // stacking. Therefore we need to set something that is truthy.
      stackId = 'obs';
    } else if (stack && isTrend) {
      stackId = forecastSeries.type;
    }
    let plotType;
    if (!isConfidenceBand && (seriesType === 'scatter' || (forecastEnabled && isObservation))) {
      plotType = 'scatter';
    } else if (isConfidenceBand) {
      plotType = 'line';
    } else {
      plotType = seriesType === 'bar' ? 'bar' : 'line';
    }
    const lineStyle = isConfidenceBand ? { opacity: 0 } : {};

    if (!((stack || area) && isConfidenceBand))
      series.push({
        ...entry,
        id: entry.name,
        name: forecastSeries.name,
        itemStyle: {
          color: colorFn(forecastSeries.name),
        },
        type: plotType,
        // @ts-ignore
        smooth: seriesType === 'smooth',
        step: ['start', 'middle', 'end'].includes(seriesType as string) ? seriesType : undefined,
        stack: stackId,
        lineStyle,
        areaStyle: {
          opacity: forecastSeries.type === ForecastSeriesEnum.ForecastUpper || area ? opacity : 0,
        },
        symbolSize:
          !isConfidenceBand &&
          (plotType === 'scatter' || (forecastEnabled && isObservation) || markerEnabled)
            ? markerSize
            : 0,
      });
  });
  const echartOptions: echarts.EChartOption = {
    grid: {
      top: 30,
      bottom: zoomable ? 80 : 0,
      left: 20,
      right: 20,
      containLabel: true,
    },
    xAxis: { type: 'time' },
    yAxis: {
      type: logAxis ? 'log' : 'value',
      min: contributionMode === 'row' && stack ? 0 : undefined,
      max: contributionMode === 'row' && stack ? 1 : undefined,
      minorTick: { show: true },
      minorSplitLine: { show: minorSplitLine },
      axisLabel: { formatter },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params, ticket, callback) => {
        // @ts-ignore
        const rows = [`${smartDateVerboseFormatter(params[0].value[0])}`];
        // @ts-ignore
        const prophetValues = extractProphetValuesFromTooltipParams(params);
        Object.keys(prophetValues).forEach(key => {
          const value = prophetValues[key];
          rows.push(
            formatProphetTooltipSeries({
              ...value,
              seriesName: key,
              formatter,
            }),
          );
        });
        setTimeout(() => {
          callback(ticket, rows.join('<br />'));
        }, 50);
        return 'loading';
      },
    },
    legend: {
      type: 'scroll',
      data: rawSeries
        .filter(
          entry =>
            extractForecastSeriesContext(entry.name || '').type === ForecastSeriesEnum.Observation,
        )
        .map(entry => entry.name || ''),
      right: zoomable ? 80 : 'auto',
    },
    series,
    toolbox: {
      show: zoomable,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          title: {
            zoom: 'zoom area',
            back: 'restore zoom',
          },
        },
      },
    },
    dataZoom: zoomable
      ? [
          {
            type: 'slider',
            start: 0,
            end: 100,
            bottom: 20,
          },
        ]
      : [],
  };

  return {
    area,
    colorScheme,
    contributionMode,
    // @ts-ignore
    echartOptions,
    seriesType,
    logAxis,
    opacity,
    stack,
    markerEnabled,
    markerSize,
    minorSplitLine,
    width,
    height,
  };
}
