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
  AnnotationLayer,
  isFormulaAnnotationLayer,
  ChartProps,
  CategoricalColorNamespace,
  getNumberFormatter,
  smartDateVerboseFormatter,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import { EchartsTimeseriesProps } from './types';
import { ForecastSeriesEnum } from '../types';
import { parseYAxisBound } from '../utils/controls';
import { extractTimeseriesSeries } from '../utils/series';
import { evalFormula, parseAnnotationOpacity } from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractProphetValuesFromTooltipParams,
  formatProphetTooltipSeries,
  rebaseTimeseriesDatum,
} from '../utils/prophet';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';

export default function transformProps(chartProps: ChartProps): EchartsTimeseriesProps {
  const { width, height, formData, queryData } = chartProps;
  const { data = [] }: { data?: TimeseriesDataRecord[] } = queryData;
  const {
    annotationLayers = [],
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
    truncateYAxis,
    yAxisFormat,
    yAxisBounds,
    zoomable,
  } = formData;

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseTimeseriesDatum(data);
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

  annotationLayers.forEach((layer: AnnotationLayer) => {
    const {
      name,
      color,
      opacity: annotationOpacity,
      width: annotationWidth,
      show: annotationShow,
      style,
    } = layer;
    if (annotationShow && isFormulaAnnotationLayer(layer)) {
      series.push({
        name,
        id: name,
        itemStyle: {
          color: color || colorFn(name),
        },
        lineStyle: {
          opacity: parseAnnotationOpacity(annotationOpacity),
          type: style,
          width: annotationWidth,
        },
        type: 'line',
        smooth: true,
        // @ts-ignore
        data: evalFormula(layer, data),
        symbolSize: 0,
      });
    }
  });

  // yAxisBounds need to be parsed to replace incompatible values with undefined
  let [min, max] = (yAxisBounds || []).map(parseYAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if (contributionMode === 'row' && stack) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 1;
  }

  const echartOptions: echarts.EChartOption = {
    grid: {
      ...defaultGrid,
      top: 30,
      bottom: zoomable ? 80 : 0,
      left: 20,
      right: 20,
    },
    xAxis: { type: 'time' },
    yAxis: {
      ...defaultYAxis,
      type: logAxis ? 'log' : 'value',
      min,
      max,
      minorTick: { show: true },
      minorSplitLine: { show: minorSplitLine },
      axisLabel: { formatter },
      scale: truncateYAxis,
    },
    tooltip: {
      ...defaultTooltip,
      trigger: 'axis',
      formatter: params => {
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
        return rows.join('<br />');
      },
    },
    legend: {
      data: rawSeries
        .filter(
          entry =>
            extractForecastSeriesContext(entry.name || '').type === ForecastSeriesEnum.Observation,
        )
        .map(entry => entry.name || '')
        .concat(annotationLayers.map((layer: AnnotationLayer) => layer.name)),
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
