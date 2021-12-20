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
/* eslint-disable camelcase */
import {
  AnnotationLayer,
  CategoricalColorNamespace,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
  TimeseriesChartDataResponseResult,
  DataRecordValue,
} from '@superset-ui/core';
import { EChartsCoreOption, SeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA,
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  TimeseriesChartTransformedProps,
} from './types';
import { ForecastSeriesEnum, ProphetValue } from '../types';
import { parseYAxisBound } from '../utils/controls';
import {
  dedupSeries,
  extractTimeseriesSeries,
  getLegendProps,
  currentSeries,
} from '../utils/series';
import { extractAnnotationLabels } from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractForecastSeriesContexts,
  extractProphetValuesFromTooltipParams,
  formatProphetTooltipSeries,
  rebaseTimeseriesDatum,
} from '../utils/prophet';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';
import {
  getPadding,
  getTooltipTimeFormatter,
  getXAxisFormatter,
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from './transformers';
import { TIMESERIES_CONSTANTS } from '../constants';

export default function transformProps(
  chartProps: EchartsTimeseriesChartProps,
): TimeseriesChartTransformedProps {
  const {
    width,
    height,
    filterState,
    formData,
    hooks,
    queriesData,
    datasource,
  } = chartProps;
  const { verboseMap = {} } = datasource;
  const { annotation_data: annotationData_, data = [] } =
    queriesData[0] as TimeseriesChartDataResponseResult;
  const annotationData = annotationData_ || {};

  const {
    area,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    legendOrientation,
    legendType,
    legendMargin,
    logAxis,
    markerEnabled,
    markerSize,
    opacity,
    minorSplitLine,
    seriesType,
    showLegend,
    stack,
    truncateYAxis,
    yAxisFormat,
    xAxisTimeFormat,
    yAxisBounds,
    tooltipTimeFormat,
    tooltipSortByMetric,
    zoomable,
    richTooltip,
    xAxisLabelRotation,
    emitFilter,
    groupby,
    showValue,
    onlyTotal,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseTimeseriesDatum(data, verboseMap);
  const rawSeries = extractTimeseriesSeries(rebasedData, {
    fillNeighborValue: stack && !forecastEnabled ? 0 : undefined,
  });
  const seriesContexts = extractForecastSeriesContexts(
    Object.values(rawSeries).map(series => series.name as string),
  );
  const series: SeriesOption[] = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);

  const totalStackedValues: number[] = [];
  const showValueIndexes: number[] = [];

  rebasedData.forEach(data => {
    const values = Object.keys(data).reduce((prev, curr) => {
      if (curr === '__timestamp') {
        return prev;
      }
      const value = data[curr] || 0;
      return prev + (value as number);
    }, 0);
    totalStackedValues.push(values);
  });

  if (stack) {
    rawSeries.forEach((entry, seriesIndex) => {
      const { data = [] } = entry;
      (data as [Date, number][]).forEach((datum, dataIndex) => {
        if (datum[1] !== null) {
          showValueIndexes[dataIndex] = seriesIndex;
        }
      });
    });
  }

  rawSeries.forEach(entry => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area,
      filterState,
      seriesContexts,
      markerEnabled,
      markerSize,
      areaOpacity: opacity,
      seriesType,
      stack,
      formatter,
      showValue,
      onlyTotal,
      totalStackedValues,
      showValueIndexes,
      richTooltip,
    });
    if (transformedSeries) series.push(transformedSeries);
  });

  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = series.findIndex(({ name }) => name === selectedValue);
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(transformFormulaAnnotation(layer, data, colorScale));
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(layer, data, annotationData, colorScale),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            markerSize,
            data,
            annotationData,
          ),
        );
      }
    });

  // yAxisBounds need to be parsed to replace incompatible values with undefined
  let [min, max] = (yAxisBounds || []).map(parseYAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if (contributionMode === 'row' && stack) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 1;
  }

  const tooltipFormatter = getTooltipTimeFormatter(tooltipTimeFormat);
  const xAxisFormatter = getXAxisFormatter(xAxisTimeFormat);

  const labelMap = series.reduce(
    (acc: Record<string, DataRecordValue[]>, datum) => {
      const name: string = datum.name as string;
      return {
        ...acc,
        [name]: [name],
      };
    },
    {},
  );

  const { setDataMask = () => {} } = hooks;

  const addYAxisLabelOffset = !!yAxisTitle;
  const addXAxisLabelOffset = !!xAxisTitle;
  const padding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisLabelOffset,
    zoomable,
    legendMargin,
    addXAxisLabelOffset,
    yAxisTitlePosition,
    yAxisTitleMargin,
    xAxisTitleMargin,
  );

  const legendData = rawSeries
    .filter(
      entry =>
        extractForecastSeriesContext(entry.name || '').type ===
        ForecastSeriesEnum.Observation,
    )
    .map(entry => entry.name || '')
    .concat(extractAnnotationLabels(annotationLayers, annotationData));

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding,
    },
    xAxis: {
      type: 'time',
      name: xAxisTitle,
      nameGap: xAxisTitleMargin,
      nameLocation: 'middle',
      axisLabel: {
        hideOverlap: true,
        formatter: xAxisFormatter,
        rotate: xAxisLabelRotation,
      },
    },
    yAxis: {
      ...defaultYAxis,
      type: logAxis ? 'log' : 'value',
      min,
      max,
      minorTick: { show: true },
      minorSplitLine: { show: minorSplitLine },
      axisLabel: { formatter },
      scale: truncateYAxis,
      name: yAxisTitle,
      nameGap: yAxisTitleMargin,
      nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
    },
    tooltip: {
      ...defaultTooltip,
      appendToBody: true,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const xValue: number = richTooltip
          ? params[0].value[0]
          : params.value[0];
        const prophetValue: any[] = richTooltip ? params : [params];

        if (richTooltip && tooltipSortByMetric) {
          prophetValue.sort((a, b) => b.data[1] - a.data[1]);
        }

        const rows: Array<string> = [`${tooltipFormatter(xValue)}`];
        const prophetValues: Record<string, ProphetValue> =
          extractProphetValuesFromTooltipParams(prophetValue);

        Object.keys(prophetValues).forEach(key => {
          const value = prophetValues[key];
          const content = formatProphetTooltipSeries({
            ...value,
            seriesName: key,
            formatter,
          });
          if (currentSeries.name === key) {
            rows.push(`<span style="font-weight: 700">${content}</span>`);
          } else {
            rows.push(`<span style="opacity: 0.7">${content}</span>`);
          }
        });
        return rows.join('<br />');
      },
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, zoomable),
      data: legendData as string[],
    },
    series: dedupSeries(series),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
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
            start: TIMESERIES_CONSTANTS.dataZoomStart,
            end: TIMESERIES_CONSTANTS.dataZoomEnd,
            bottom: TIMESERIES_CONSTANTS.zoomBottom,
          },
        ]
      : [],
  };

  return {
    echartOptions,
    emitFilter,
    formData,
    groupby,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    width,
    legendData,
  };
}
