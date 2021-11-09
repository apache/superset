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
  DataRecordValue,
  TimeseriesDataRecord,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
} from '@superset-ui/core';
import { EChartsCoreOption, SeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesChartTransformedProps,
} from './types';
import { ForecastSeriesEnum } from '../types';
import { parseYAxisBound } from '../utils/controls';
import {
  currentSeries,
  dedupSeries,
  extractTimeseriesSeries,
  getLegendProps,
} from '../utils/series';
import { extractAnnotationLabels } from '../utils/annotation';
import {
  extractForecastSeriesContext,
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
} from '../Timeseries/transformers';
import { TIMESERIES_CONSTANTS } from '../constants';

export default function transformProps(
  chartProps: EchartsMixedTimeseriesFormData,
): EchartsMixedTimeseriesChartTransformedProps {
  const { width, height, formData, queriesData, hooks, filterState } =
    chartProps;
  const { annotation_data: annotationData_ } = queriesData[0];
  const annotationData = annotationData_ || {};
  const data1: TimeseriesDataRecord[] = queriesData[0].data || [];
  const data2: TimeseriesDataRecord[] = queriesData[1].data || [];

  const {
    area,
    areaB,
    annotationLayers,
    colorScheme,
    contributionMode,
    legendOrientation,
    legendType,
    logAxis,
    logAxisSecondary,
    markerEnabled,
    markerEnabledB,
    markerSize,
    markerSizeB,
    opacity,
    opacityB,
    minorSplitLine,
    seriesType,
    seriesTypeB,
    showLegend,
    showValue,
    showValueB,
    stack,
    stackB,
    truncateYAxis,
    tooltipTimeFormat,
    yAxisFormat,
    yAxisFormatSecondary,
    xAxisTimeFormat,
    yAxisBounds,
    yAxisIndex,
    yAxisIndexB,
    yAxisTitleSecondary,
    zoomable,
    richTooltip,
    tooltipSortByMetric,
    xAxisLabelRotation,
    groupby,
    groupbyB,
    emitFilter,
    emitFilterB,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
  }: EchartsMixedTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rawSeriesA = extractTimeseriesSeries(rebaseTimeseriesDatum(data1), {
    fillNeighborValue: stack ? 0 : undefined,
  });
  const rawSeriesB = extractTimeseriesSeries(rebaseTimeseriesDatum(data2), {
    fillNeighborValue: stackB ? 0 : undefined,
  });

  const series: SeriesOption[] = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);
  const formatterSecondary = getNumberFormatter(
    contributionMode ? ',.0%' : yAxisFormatSecondary,
  );

  const primarySeries = new Set<string>();
  const secondarySeries = new Set<string>();
  const mapSeriesIdToAxis = (
    seriesOption: SeriesOption,
    index?: number,
  ): void => {
    if (index === 1) {
      secondarySeries.add(seriesOption.id as string);
    } else {
      primarySeries.add(seriesOption.id as string);
    }
  };
  rawSeriesA.forEach(seriesOption =>
    mapSeriesIdToAxis(seriesOption, yAxisIndex),
  );
  rawSeriesB.forEach(seriesOption =>
    mapSeriesIdToAxis(seriesOption, yAxisIndexB),
  );

  rawSeriesA.forEach(entry => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area,
      markerEnabled,
      markerSize,
      areaOpacity: opacity,
      seriesType,
      showValue,
      stack,
      yAxisIndex,
      filterState,
    });
    if (transformedSeries) series.push(transformedSeries);
  });
  rawSeriesB.forEach(entry => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area: areaB,
      markerEnabled: markerEnabledB,
      markerSize: markerSizeB,
      areaOpacity: opacityB,
      seriesType: seriesTypeB,
      showValue: showValueB,
      stack: stackB,
      yAxisIndex: yAxisIndexB,
      filterState,
    });
    if (transformedSeries) series.push(transformedSeries);
  });

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(transformFormulaAnnotation(layer, data1, colorScale));
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data1,
            annotationData,
            colorScale,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(layer, data1, annotationData, colorScale),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            markerSize,
            data1,
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

  const tooltipTimeFormatter = getTooltipTimeFormatter(tooltipTimeFormat);
  const xAxisFormatter = getXAxisFormatter(xAxisTimeFormat);

  const addYAxisTitleOffset = !!(yAxisTitle || yAxisTitleSecondary);
  const addXAxisTitleOffset = !!xAxisTitle;

  const chartPadding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisTitleOffset,
    zoomable,
    null,
    addXAxisTitleOffset,
    yAxisTitlePosition,
    yAxisTitleMargin,
    xAxisTitleMargin,
  );
  const labelMap = rawSeriesA.reduce((acc, datum) => {
    const label = datum.name as string;
    return {
      ...acc,
      [label]: label.split(', '),
    };
  }, {}) as Record<string, DataRecordValue[]>;

  const labelMapB = rawSeriesB.reduce((acc, datum) => {
    const label = datum.name as string;
    return {
      ...acc,
      [label]: label.split(', '),
    };
  }, {}) as Record<string, DataRecordValue[]>;

  const { setDataMask = () => {} } = hooks;

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...chartPadding,
    },
    xAxis: {
      type: 'time',
      name: xAxisTitle,
      nameGap: xAxisTitleMargin,
      nameLocation: 'middle',
      axisLabel: {
        formatter: xAxisFormatter,
        rotate: xAxisLabelRotation,
      },
    },
    yAxis: [
      {
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
      {
        ...defaultYAxis,
        type: logAxisSecondary ? 'log' : 'value',
        min,
        max,
        minorTick: { show: true },
        splitLine: { show: false },
        minorSplitLine: { show: minorSplitLine },
        axisLabel: { formatter: formatterSecondary },
        scale: truncateYAxis,
        name: yAxisTitleSecondary,
      },
    ],
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

        const rows: Array<string> = [`${tooltipTimeFormatter(xValue)}`];
        const prophetValues =
          extractProphetValuesFromTooltipParams(prophetValue);

        Object.keys(prophetValues).forEach(key => {
          const value = prophetValues[key];
          const content = formatProphetTooltipSeries({
            ...value,
            seriesName: key,
            formatter: primarySeries.has(key) ? formatter : formatterSecondary,
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
      // @ts-ignore
      data: rawSeriesA
        .concat(rawSeriesB)
        .filter(
          entry =>
            extractForecastSeriesContext((entry.name || '') as string).type ===
            ForecastSeriesEnum.Observation,
        )
        .map(entry => entry.name || '')
        .concat(extractAnnotationLabels(annotationLayers, annotationData)),
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
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    emitFilterB,
    labelMap,
    labelMapB,
    groupby,
    groupbyB,
    seriesBreakdown: rawSeriesA.length,
    selectedValues: filterState.selectedValues || [],
  };
}
