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

/**
 * Shared utilities for Timeseries chart variants.
 *
 * Exports:
 * - transformFullTimeseriesProps: transform for Line, Area, Step, Bar, Generic
 * - transformSimpleTimeseriesProps: transform for Scatter, SmoothLine
 * - TimeseriesRender: unified render component
 * - Shared additionalControls pieces (query rows, chart option rows, etc.)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { invert } from 'lodash';
import { t } from '@apache-superset/core/translation';
import {
  AnnotationLayer,
  AnnotationType,
  AxisType,
  BinaryQueryObjectFilterClause,
  buildCustomFormatters,
  CategoricalColorNamespace,
  CurrencyFormatter,
  DTTM_ALIAS,
  ensureIsArray,
  getCustomFormatter,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getXAxisLabel,
  isDefined,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isPhysicalColumn,
  isTimeseriesAnnotationLayer,
  LegendState,
  NumberFormats,
  TimeseriesChartDataResponseResult,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ControlPanelsContainerProps,
  ControlSetRow,
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  extractExtraMetrics,
  getOriginalSeries,
  isDerivedSeries,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import type { EChartsCoreOption } from 'echarts/core';
import type {
  CallbackDataParams,
  LineStyleOption,
} from 'echarts/types/src/util/types';
import type { SeriesOption } from 'echarts';
import type { ViewRootGroup } from 'echarts/types/src/util/types';
import type GlobalModel from 'echarts/types/src/model/Global';
import type ComponentModel from 'echarts/types/src/model/Component';

import {
  EchartsHandler,
  EventHandlers,
  ForecastSeriesEnum,
  ForecastValue,
  Refs,
} from '../types';
import Echart from '../components/Echart';
import { ExtraControls } from '../components/ExtraControls';
import { formatSeriesName } from '../utils/series';
import { parseAxisBound } from '../utils/controls';
import {
  calculateLowerLogTick,
  dedupSeries,
  extractDataTotalValues,
  extractSeries,
  extractShowValueIndexes,
  extractTooltipKeys,
  getAxisType,
  getColtypesMapping,
  getLegendProps,
  getMinAndMaxFromBounds,
} from '../utils/series';
import {
  extractAnnotationLabels,
  getAnnotationData,
} from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractForecastSeriesContexts,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
  reorderForecastSeries,
} from '../utils/forecast';
import { convertInteger } from '../utils/convertInteger';
import { defaultGrid, defaultYAxis } from '../defaults';
import {
  getBaselineSeriesForStream,
  getPadding,
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from './transformers';
import {
  OpacityEnum,
  StackControlsValue,
  TIMEGRAIN_TO_TIMESTAMP,
  TIMESERIES_CONSTANTS,
} from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import {
  getPercentFormatter,
  getTooltipTimeFormatter,
  getXAxisFormatter,
  getYAxisFormatter,
} from '../utils/formatters';
import { DEFAULT_FORM_DATA, TIME_SERIES_DESCRIPTION_TEXT } from './constants';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
  OrientationType,
  TimeseriesChartTransformedProps,
} from './types';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  seriesOrderSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
  xAxisLabelInterval,
  forceMaxInterval,
} from '../controls';

// ============================================================================
// Constants
// ============================================================================

export const TIMER_DURATION = 300;

const {
  area,
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  truncateYAxis,
  yAxisBounds,
} = DEFAULT_FORM_DATA;

// ============================================================================
// Shared Transform: Full (Line, Area, Step, Bar, Generic)
// ============================================================================

/**
 * Shared transform for "full" timeseries charts (Line, Area, Step, Bar, Generic).
 * Supports stacking, area fills, orientation, ExtraControls, stackDimension.
 *
 * @param chartProps - The chart props from the glyph system
 * @param formDataPatch - Optional overrides merged into formData before processing.
 *   Line uses `{ seriesType: EchartsTimeseriesSeriesType.Line }`
 *   Area uses `{ area: true }`
 *   Bar uses `{ seriesType: EchartsTimeseriesSeriesType.Bar }`
 *   Step and Generic pass nothing (or `{}`)
 */
export function transformFullTimeseriesProps(
  chartProps: EchartsTimeseriesChartProps,
  formDataPatch?: Partial<EchartsTimeseriesFormData>,
): TimeseriesChartTransformedProps {
  // Apply optional patch to formData
  const effectiveProps =
    formDataPatch && Object.keys(formDataPatch).length > 0
      ? {
          ...chartProps,
          formData: { ...chartProps.formData, ...formDataPatch },
        }
      : chartProps;

  const {
    width,
    height,
    filterState,
    legendState,
    formData,
    hooks,
    queriesData,
    datasource,
    theme,
    inContextMenu,
    emitCrossFilters,
    legendIndex,
  } = effectiveProps;

  let focusedSeries: string | null = null;

  const {
    verboseMap = {},
    columnFormats = {},
    currencyFormats = {},
  } = datasource;
  const [queryData] = queriesData;
  const { data = [], label_map = {} } =
    queryData as TimeseriesChartDataResponseResult;

  const dataTypes = getColtypesMapping(queryData);
  const annotationData = getAnnotationData(effectiveProps);

  const {
    area: formArea,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    groupby,
    legendOrientation,
    legendType,
    legendMargin,
    legendSort,
    logAxis: useLogAxis,
    markerEnabled: formMarkerEnabled,
    markerSize: formMarkerSize,
    metrics,
    minorSplitLine: showMinorSplitLine,
    minorTicks: showMinorTicks,
    onlyTotal,
    opacity: formOpacity,
    orientation,
    percentageThreshold,
    richTooltip,
    seriesType,
    showLegend,
    showValue,
    sliceId,
    sortSeriesType,
    sortSeriesAscending,
    timeGrainSqla,
    forceMaxInterval: useForceMaxInterval,
    timeCompare,
    timeShiftColor,
    stack,
    tooltipTimeFormat,
    tooltipSortByMetric,
    showTooltipTotal,
    showTooltipPercentage,
    truncateXAxis: shouldTruncateXAxis,
    truncateYAxis: shouldTruncateYAxis,
    xAxis: xAxisOrig,
    xAxisBounds: formXAxisBounds,
    xAxisForceCategorical,
    xAxisLabelRotation,
    xAxisLabelInterval,
    xAxisSort,
    xAxisSortAsc,
    xAxisTimeFormat,
    xAxisNumberFormat,
    xAxisTitle,
    xAxisTitleMargin,
    yAxisBounds: formYAxisBounds,
    yAxisFormat,
    currencyFormat,
    yAxisTitle,
    yAxisTitleMargin,
    yAxisTitlePosition,
    zoomable,
    stackDimension,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const refs: Refs = {};
  const groupBy = ensureIsArray(groupby);
  const labelMap: { [key: string]: string[] } = Object.entries(
    label_map,
  ).reduce((acc, entry) => {
    if (
      entry[1].length > groupBy.length &&
      Array.isArray(timeCompare) &&
      timeCompare.includes(entry[1][0])
    ) {
      entry[1].shift();
    }
    return { ...acc, [entry[0]]: entry[1] };
  }, {});
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseForecastDatum(data, verboseMap);
  let xAxisLabel = getXAxisLabel(effectiveProps.rawFormData) as string;
  if (
    isPhysicalColumn(effectiveProps.rawFormData?.x_axis) &&
    isDefined(verboseMap[xAxisLabel])
  ) {
    xAxisLabel = verboseMap[xAxisLabel];
  }
  const isHorizontal = orientation === OrientationType.Horizontal;
  const { totalStackedValues, thresholdValues } = extractDataTotalValues(
    rebasedData,
    {
      stack,
      percentageThreshold,
      xAxisCol: xAxisLabel,
      legendState,
    },
  );
  const extraMetricLabels = extractExtraMetrics(effectiveProps.rawFormData).map(
    getMetricLabel,
  );

  const isMultiSeries = groupBy.length || metrics?.length > 1;
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];
  const xAxisType = getAxisType(stack, xAxisForceCategorical, xAxisDataType);

  const [rawSeries, sortedTotalValues, minPositiveValue] = extractSeries(
    rebasedData,
    {
      fillNeighborValue: stack && !forecastEnabled ? 0 : undefined,
      xAxis: xAxisLabel,
      extraMetricLabels,
      stack,
      totalStackedValues,
      isHorizontal,
      sortSeriesType,
      sortSeriesAscending,
      xAxisSortSeries: isMultiSeries ? xAxisSort : undefined,
      xAxisSortSeriesAscending: isMultiSeries ? xAxisSortAsc : undefined,
      xAxisType,
    },
  );
  const showValueIndexes = extractShowValueIndexes(rawSeries, {
    stack,
    onlyTotal,
    isHorizontal,
    legendState,
  });
  const seriesContexts = extractForecastSeriesContexts(
    rawSeries.map(series => series.name as string),
  );
  const isAreaExpand = stack === StackControlsValue.Expand;
  const series: SeriesOption[] = [];

  const forcePercentFormatter = Boolean(contributionMode || isAreaExpand);
  const percentFormatter = forcePercentFormatter
    ? getPercentFormatter(yAxisFormat)
    : getPercentFormatter(NumberFormats.PERCENT_2_POINT);
  const defaultFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: yAxisFormat, currency: currencyFormat })
    : getNumberFormatter(yAxisFormat);
  const customFormatters = buildCustomFormatters(
    metrics,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );

  const array = ensureIsArray(effectiveProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  let patternIncrement = 0;

  rawSeries.forEach(entry => {
    const derivedSeries = isDerivedSeries(entry, effectiveProps.rawFormData);
    const lineStyle: LineStyleOption = {};
    if (derivedSeries) {
      patternIncrement += 1;
      lineStyle.type = [(patternIncrement % 5) + 1, (patternIncrement % 3) + 1];
      lineStyle.opacity = OpacityEnum.DerivedSeries;
    }

    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;

    let colorScaleKey = getOriginalSeries(seriesName, array);

    if (array && array.includes(seriesName)) {
      const originalSeries = rawSeries.find(s => {
        const sName = inverted[String(s.name || '')] || String(s.name || '');
        return !array.includes(sName);
      });
      if (originalSeries) {
        const originalSeriesName =
          inverted[String(originalSeries.name || '')] ||
          String(originalSeries.name || '');
        colorScaleKey = getOriginalSeries(originalSeriesName, array);
      }
    }

    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area: formArea,
        connectNulls: derivedSeries,
        filterState,
        seriesContexts,
        markerEnabled: formMarkerEnabled,
        markerSize: formMarkerSize,
        areaOpacity: formOpacity,
        seriesType,
        legendState,
        stack,
        formatter: forcePercentFormatter
          ? percentFormatter
          : (getCustomFormatter(
              customFormatters,
              metrics,
              labelMap?.[seriesName]?.[0],
            ) ?? defaultFormatter),
        showValue,
        onlyTotal,
        totalStackedValues: sortedTotalValues,
        showValueIndexes,
        thresholdValues,
        richTooltip,
        sliceId,
        isHorizontal,
        lineStyle,
        timeCompare: array,
        timeShiftColor,
        theme,
      },
    );
    if (transformedSeries) {
      if (stack === StackControlsValue.Stream) {
        series.push({
          ...transformedSeries,
          data: (transformedSeries.data as any).map(
            (row: [string | number, number]) => [row[0], row[1] ?? 0],
          ),
        });
      } else {
        series.push(transformedSeries);
      }
    }
  });

  if (stack === StackControlsValue.Stream) {
    const baselineSeries = getBaselineSeriesForStream(
      series.map(entry => entry.data) as [string | number, number][][],
      seriesType,
    );
    series.unshift(baselineSeries);
  }

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
        series.push(
          transformFormulaAnnotation(
            layer,
            data,
            xAxisLabel,
            xAxisType,
            colorScale,
            sliceId,
            orientation,
          ),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
            orientation,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
            orientation,
          ),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            formMarkerSize,
            data,
            annotationData,
            colorScale,
            sliceId,
            orientation,
          ),
        );
      }
    });

  if (
    stack === StackControlsValue.Stack &&
    stackDimension &&
    effectiveProps.rawFormData.groupby
  ) {
    const idxSelectedDimension =
      formData.metrics.length > 1
        ? 1
        : 0 + effectiveProps.rawFormData.groupby.indexOf(stackDimension);
    for (const s of series) {
      if (s.id) {
        const columnsArr = labelMap[s.id];
        (s as any).stack = columnsArr[idxSelectedDimension];
      }
    }
  }

  const [xAxisMin, xAxisMax] = (formXAxisBounds || []).map(parseAxisBound);
  let [yAxisMin, yAxisMax] = (formYAxisBounds || []).map(parseAxisBound);

  if ((contributionMode === 'row' || isAreaExpand) && stack) {
    if (yAxisMin === undefined) yAxisMin = 0;
    if (yAxisMax === undefined) yAxisMax = 1;
  } else if (
    useLogAxis &&
    yAxisMin === undefined &&
    minPositiveValue !== undefined
  ) {
    yAxisMin = calculateLowerLogTick(minPositiveValue);
  }

  const tooltipFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : String;
  const xAxisFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getXAxisFormatter(xAxisTimeFormat)
      : xAxisDataType === GenericDataType.Numeric
        ? getNumberFormatter(xAxisNumberFormat)
        : String;

  const {
    setDataMask = () => {},
    setControlValue = () => {},
    onContextMenu,
    onLegendStateChanged,
    onLegendScroll,
  } = hooks;

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
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
    isHorizontal,
  );

  const legendData = rawSeries
    .filter(
      entry =>
        extractForecastSeriesContext(entry.name || '').type ===
        ForecastSeriesEnum.Observation,
    )
    .map(entry => entry.name || '')
    .concat(extractAnnotationLabels(annotationLayers));

  let xAxis: any = {
    type: xAxisType,
    name: xAxisTitle,
    nameGap: convertInteger(xAxisTitleMargin),
    nameLocation: 'middle',
    axisLabel: {
      hideOverlap: true,
      formatter: xAxisFormatter,
      rotate: xAxisLabelRotation,
      interval: xAxisLabelInterval,
    },
    minorTick: { show: showMinorTicks },
    minInterval:
      xAxisType === AxisType.Time && timeGrainSqla && !useForceMaxInterval
        ? TIMEGRAIN_TO_TIMESTAMP[
            timeGrainSqla as keyof typeof TIMEGRAIN_TO_TIMESTAMP
          ]
        : 0,
    maxInterval:
      xAxisType === AxisType.Time && timeGrainSqla && useForceMaxInterval
        ? TIMEGRAIN_TO_TIMESTAMP[
            timeGrainSqla as keyof typeof TIMEGRAIN_TO_TIMESTAMP
          ]
        : undefined,
    ...getMinAndMaxFromBounds(
      xAxisType,
      shouldTruncateXAxis,
      xAxisMin,
      xAxisMax,
      seriesType,
    ),
  };

  let yAxis: any = {
    ...defaultYAxis,
    type: useLogAxis ? AxisType.Log : AxisType.Value,
    min: yAxisMin,
    max: yAxisMax,
    minorTick: { show: showMinorTicks },
    minorSplitLine: { show: showMinorSplitLine },
    axisLabel: {
      formatter: getYAxisFormatter(
        metrics,
        forcePercentFormatter,
        customFormatters,
        defaultFormatter,
        yAxisFormat,
      ),
    },
    scale: shouldTruncateYAxis,
    name: yAxisTitle,
    nameGap: convertInteger(yAxisTitleMargin),
    nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
  };

  if (isHorizontal) {
    [xAxis, yAxis] = [yAxis, xAxis];
    [padding.bottom, padding.left] = [padding.left, padding.bottom];
  }

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding,
    },
    xAxis,
    yAxis,
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const [xIndex, yIndex] = isHorizontal ? [1, 0] : [0, 1];
        const xValue: number = richTooltip
          ? params[0].value[xIndex]
          : params.value[xIndex];
        const forecastValue: CallbackDataParams[] = richTooltip
          ? params
          : [params];
        const sortedKeys = extractTooltipKeys(
          forecastValue,
          yIndex,
          richTooltip,
          tooltipSortByMetric,
        );
        const filteredForecastValue = forecastValue.filter(
          (item: CallbackDataParams) =>
            !annotationLayers.some(
              (annotation: AnnotationLayer) =>
                item.seriesName === annotation.name,
            ),
        );
        const forecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(forecastValue, isHorizontal);

        const filteredForecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(
            filteredForecastValue,
            isHorizontal,
          );

        const isForecast = Object.values(forecastValues).some(
          value =>
            value.forecastTrend || value.forecastLower || value.forecastUpper,
        );

        const formatter = forcePercentFormatter
          ? percentFormatter
          : (getCustomFormatter(customFormatters, metrics) ?? defaultFormatter);

        const rows: string[][] = [];
        const total = Object.values(filteredForecastValues).reduce(
          (acc, value) =>
            value.observation !== undefined ? acc + value.observation : acc,
          0,
        );
        const allowTotal = Boolean(isMultiSeries) && richTooltip && !isForecast;
        const showPercentage =
          allowTotal && !forcePercentFormatter && showTooltipPercentage;
        const keys = Object.keys(forecastValues);
        let focusedRow;
        sortedKeys
          .filter(key => keys.includes(key))
          .forEach(key => {
            const value = forecastValues[key];
            if (value.observation === 0 && stack) {
              return;
            }
            const row = formatForecastTooltipSeries({
              ...value,
              seriesName: key,
              formatter,
            });

            const annotationRow = annotationLayers.some(
              item => item.name === key,
            );

            if (
              showPercentage &&
              value.observation !== undefined &&
              !annotationRow
            ) {
              row.push(
                percentFormatter.format(value.observation / (total || 1)),
              );
            }
            rows.push(row);
            if (key === focusedSeries) {
              focusedRow = rows.length - 1;
            }
          });
        if (stack) {
          rows.reverse();
          if (focusedRow !== undefined) {
            focusedRow = rows.length - focusedRow - 1;
          }
        }
        if (allowTotal && showTooltipTotal) {
          const totalRow = ['Total', formatter.format(total)];
          if (showPercentage) {
            totalRow.push(percentFormatter.format(1));
          }
          rows.push(totalRow);
        }
        return tooltipHtml(rows, tooltipFormatter(xValue), focusedRow);
      },
    },
    legend: {
      ...getLegendProps(
        legendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
        padding,
      ),
      scrollDataIndex: legendIndex || 0,
      data: legendData.sort((a: string, b: string) => {
        if (!legendSort) return 0;
        return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }) as string[],
    },
    series: dedupSeries(reorderForecastSeries(series) as SeriesOption[]),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          ...(stack ? { yAxisIndex: false } : {}),
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
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
            yAxisIndex: isHorizontal ? 0 : undefined,
          },
          {
            type: 'inside',
            yAxisIndex: 0,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
          },
          {
            type: 'inside',
            xAxisIndex: 0,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
          },
        ]
      : [],
  };

  const onFocusedSeries = (seriesName: string | null) => {
    focusedSeries = seriesName;
  };

  return {
    echartOptions,
    emitCrossFilters,
    formData,
    groupby: groupBy,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    setControlValue,
    width,
    legendData,
    onContextMenu,
    onLegendStateChanged,
    onFocusedSeries,
    xValueFormatter: tooltipFormatter,
    xAxis: {
      label: xAxisLabel,
      type: xAxisType,
    },
    refs,
    coltypeMapping: dataTypes,
    onLegendScroll,
  };
}

// ============================================================================
// Shared Transform: Simple (Scatter, SmoothLine)
// ============================================================================

/**
 * Shared transform for "simple" timeseries charts (Scatter, SmoothLine).
 * No stacking, no area, no orientation swap.
 *
 * @param chartProps - The chart props from the glyph system
 * @param seriesType - The series type (Scatter or Smooth)
 * @param opts - Optional settings
 *   alwaysShowMarkers: if true, markerEnabled=true and onlyTotal=false (for Scatter)
 */
export function transformSimpleTimeseriesProps(
  chartProps: EchartsTimeseriesChartProps,
  seriesType: EchartsTimeseriesSeriesType,
  opts?: { alwaysShowMarkers?: boolean },
): TimeseriesChartTransformedProps {
  const alwaysShowMarkers = opts?.alwaysShowMarkers ?? false;

  const {
    width,
    height,
    filterState,
    legendState,
    formData,
    hooks,
    queriesData,
    datasource,
    theme,
    inContextMenu,
    emitCrossFilters,
    legendIndex,
  } = chartProps;

  let focusedSeries: string | null = null;

  const {
    verboseMap = {},
    columnFormats = {},
    currencyFormats = {},
  } = datasource;
  const [queryData] = queriesData;
  const { data = [], label_map = {} } =
    queryData as TimeseriesChartDataResponseResult;

  const dataTypes = getColtypesMapping(queryData);
  const annotationData = getAnnotationData(chartProps);

  const {
    annotationLayers,
    colorScheme,
    groupby,
    legendOrientation,
    legendType,
    legendMargin,
    legendSort,
    logAxis: useLogAxis,
    markerEnabled: formMarkerEnabled,
    markerSize: formMarkerSize,
    metrics,
    minorSplitLine: showMinorSplitLine,
    minorTicks: showMinorTicks,
    onlyTotal: formOnlyTotal,
    richTooltip,
    showLegend,
    showValue,
    sliceId,
    sortSeriesType,
    sortSeriesAscending,
    timeGrainSqla,
    forceMaxInterval: useForceMaxInterval,
    timeCompare,
    timeShiftColor,
    tooltipTimeFormat,
    tooltipSortByMetric,
    showTooltipTotal,
    showTooltipPercentage,
    truncateXAxis: shouldTruncateXAxis,
    truncateYAxis: shouldTruncateYAxis,
    xAxis: xAxisOrig,
    xAxisBounds: formXAxisBounds,
    xAxisForceCategorical,
    xAxisLabelRotation,
    xAxisLabelInterval,
    xAxisSort,
    xAxisSortAsc,
    xAxisTimeFormat,
    xAxisNumberFormat,
    xAxisTitle,
    xAxisTitleMargin,
    yAxisBounds: formYAxisBounds,
    yAxisFormat,
    currencyFormat,
    yAxisTitle,
    yAxisTitleMargin,
    yAxisTitlePosition,
    zoomable,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const resolvedMarkerEnabled = alwaysShowMarkers ? true : formMarkerEnabled;
  const resolvedOnlyTotal = alwaysShowMarkers ? false : formOnlyTotal;

  const refs: Refs = {};
  const groupBy = ensureIsArray(groupby);
  const labelMap: { [key: string]: string[] } = Object.entries(
    label_map,
  ).reduce((acc, entry) => {
    if (
      entry[1].length > groupBy.length &&
      Array.isArray(timeCompare) &&
      timeCompare.includes(entry[1][0])
    ) {
      entry[1].shift();
    }
    return { ...acc, [entry[0]]: entry[1] };
  }, {});
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseForecastDatum(data, verboseMap);
  let xAxisLabel = getXAxisLabel(chartProps.rawFormData) as string;
  if (
    isPhysicalColumn(chartProps.rawFormData?.x_axis) &&
    isDefined(verboseMap[xAxisLabel])
  ) {
    xAxisLabel = verboseMap[xAxisLabel];
  }

  const extraMetricLabels = extractExtraMetrics(chartProps.rawFormData).map(
    getMetricLabel,
  );

  const isMultiSeries = groupBy.length || metrics?.length > 1;
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];
  const xAxisType = getAxisType(false, xAxisForceCategorical, xAxisDataType);

  // Simple charts don't use stack, so no fillNeighborValue or totalStackedValues
  const [rawSeries, , minPositiveValue] = extractSeries(rebasedData, {
    xAxis: xAxisLabel,
    extraMetricLabels,
    sortSeriesType,
    sortSeriesAscending,
    xAxisSortSeries: isMultiSeries ? xAxisSort : undefined,
    xAxisSortSeriesAscending: isMultiSeries ? xAxisSortAsc : undefined,
    xAxisType,
  });

  const seriesContexts = extractForecastSeriesContexts(
    rawSeries.map(series => series.name as string),
  );
  const series: SeriesOption[] = [];

  const defaultFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: yAxisFormat, currency: currencyFormat })
    : getNumberFormatter(yAxisFormat);
  const customFormatters = buildCustomFormatters(
    metrics,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );

  const array = ensureIsArray(chartProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  let patternIncrement = 0;

  rawSeries.forEach(entry => {
    const derivedSeries = isDerivedSeries(entry, chartProps.rawFormData);
    const lineStyle: LineStyleOption = {};
    if (derivedSeries) {
      patternIncrement += 1;
      lineStyle.type = [(patternIncrement % 5) + 1, (patternIncrement % 3) + 1];
      lineStyle.opacity = OpacityEnum.DerivedSeries;
    }

    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;

    let colorScaleKey = getOriginalSeries(seriesName, array);

    if (array && array.includes(seriesName)) {
      const originalSeries = rawSeries.find(s => {
        const sName = inverted[String(s.name || '')] || String(s.name || '');
        return !array.includes(sName);
      });
      if (originalSeries) {
        const originalSeriesName =
          inverted[String(originalSeries.name || '')] ||
          String(originalSeries.name || '');
        colorScaleKey = getOriginalSeries(originalSeriesName, array);
      }
    }

    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area: false,
        connectNulls: derivedSeries,
        filterState,
        seriesContexts,
        markerEnabled: resolvedMarkerEnabled,
        markerSize: formMarkerSize,
        areaOpacity: 0,
        seriesType,
        legendState,
        stack: undefined,
        formatter:
          getCustomFormatter(
            customFormatters,
            metrics,
            labelMap?.[seriesName]?.[0],
          ) ?? defaultFormatter,
        showValue,
        onlyTotal: resolvedOnlyTotal,
        totalStackedValues: undefined,
        showValueIndexes: undefined,
        thresholdValues: undefined,
        richTooltip,
        sliceId,
        isHorizontal: false,
        lineStyle,
        timeCompare: array,
        timeShiftColor,
        theme,
      },
    );
    if (transformedSeries) {
      series.push(transformedSeries);
    }
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

  // Handle annotations (no orientation param for simple charts)
  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(
          transformFormulaAnnotation(
            layer,
            data,
            xAxisLabel,
            xAxisType,
            colorScale,
            sliceId,
          ),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
          ),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            formMarkerSize,
            data,
            annotationData,
            colorScale,
            sliceId,
          ),
        );
      }
    });

  // Axis bounds
  const [xAxisMin, xAxisMax] = (formXAxisBounds || []).map(parseAxisBound);
  let [yAxisMin, yAxisMax] = (formYAxisBounds || []).map(parseAxisBound);

  if (useLogAxis && yAxisMin === undefined && minPositiveValue !== undefined) {
    yAxisMin = calculateLowerLogTick(minPositiveValue);
  }

  const tooltipFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : String;
  const xAxisFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getXAxisFormatter(xAxisTimeFormat)
      : xAxisDataType === GenericDataType.Numeric
        ? getNumberFormatter(xAxisNumberFormat)
        : String;

  const {
    setDataMask = () => {},
    setControlValue = () => {},
    onContextMenu,
    onLegendStateChanged,
    onLegendScroll,
  } = hooks;

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
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
    false, // isHorizontal - simple charts are always vertical
  );

  const legendData = rawSeries
    .filter(
      entry =>
        extractForecastSeriesContext(entry.name || '').type ===
        ForecastSeriesEnum.Observation,
    )
    .map(entry => entry.name || '')
    .concat(extractAnnotationLabels(annotationLayers));

  const xAxis: any = {
    type: xAxisType,
    name: xAxisTitle,
    nameGap: convertInteger(xAxisTitleMargin),
    nameLocation: 'middle',
    axisLabel: {
      hideOverlap: true,
      formatter: xAxisFormatter,
      rotate: xAxisLabelRotation,
      interval: xAxisLabelInterval,
    },
    minorTick: { show: showMinorTicks },
    minInterval:
      xAxisType === AxisType.Time && timeGrainSqla && !useForceMaxInterval
        ? TIMEGRAIN_TO_TIMESTAMP[
            timeGrainSqla as keyof typeof TIMEGRAIN_TO_TIMESTAMP
          ]
        : 0,
    maxInterval:
      xAxisType === AxisType.Time && timeGrainSqla && useForceMaxInterval
        ? TIMEGRAIN_TO_TIMESTAMP[
            timeGrainSqla as keyof typeof TIMEGRAIN_TO_TIMESTAMP
          ]
        : undefined,
    ...getMinAndMaxFromBounds(
      xAxisType,
      shouldTruncateXAxis,
      xAxisMin,
      xAxisMax,
      seriesType,
    ),
  };

  const yAxis: any = {
    ...defaultYAxis,
    type: useLogAxis ? AxisType.Log : AxisType.Value,
    min: yAxisMin,
    max: yAxisMax,
    minorTick: { show: showMinorTicks },
    minorSplitLine: { show: showMinorSplitLine },
    axisLabel: {
      formatter: getYAxisFormatter(
        metrics,
        false, // forcePercentFormatter - simple charts don't use percent
        customFormatters,
        defaultFormatter,
        yAxisFormat,
      ),
    },
    scale: shouldTruncateYAxis,
    name: yAxisTitle,
    nameGap: convertInteger(yAxisTitleMargin),
    nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
  };

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding,
    },
    xAxis,
    yAxis,
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const xValue: number = richTooltip
          ? params[0].value[0]
          : params.value[0];
        const forecastValue: CallbackDataParams[] = richTooltip
          ? params
          : [params];
        const sortedKeys = extractTooltipKeys(
          forecastValue,
          1, // yIndex
          richTooltip,
          tooltipSortByMetric,
        );
        const filteredForecastValue = forecastValue.filter(
          (item: CallbackDataParams) =>
            !annotationLayers.some(
              (annotation: AnnotationLayer) =>
                item.seriesName === annotation.name,
            ),
        );
        const forecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(forecastValue, false);

        const filteredForecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(filteredForecastValue, false);

        const isForecast = Object.values(forecastValues).some(
          value =>
            value.forecastTrend || value.forecastLower || value.forecastUpper,
        );

        const formatter =
          getCustomFormatter(customFormatters, metrics) ?? defaultFormatter;

        const rows: string[][] = [];
        const total = Object.values(filteredForecastValues).reduce(
          (acc, value) =>
            value.observation !== undefined ? acc + value.observation : acc,
          0,
        );
        const allowTotal = Boolean(isMultiSeries) && richTooltip && !isForecast;
        const showPercentage = allowTotal && showTooltipPercentage;
        const keys = Object.keys(forecastValues);
        let focusedRow;
        sortedKeys
          .filter(key => keys.includes(key))
          .forEach(key => {
            const value = forecastValues[key];
            const row = formatForecastTooltipSeries({
              ...value,
              seriesName: key,
              formatter,
            });

            const annotationRow = annotationLayers.some(
              item => item.name === key,
            );

            if (
              showPercentage &&
              value.observation !== undefined &&
              !annotationRow
            ) {
              row.push(
                getNumberFormatter(',.1%').format(
                  value.observation / (total || 1),
                ),
              );
            }
            rows.push(row);
            if (key === focusedSeries) {
              focusedRow = rows.length - 1;
            }
          });

        if (allowTotal && showTooltipTotal) {
          const totalRow = ['Total', formatter.format(total)];
          if (showPercentage) {
            totalRow.push(getNumberFormatter(',.1%').format(1));
          }
          rows.push(totalRow);
        }
        return tooltipHtml(rows, tooltipFormatter(xValue), focusedRow);
      },
    },
    legend: {
      ...getLegendProps(
        legendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
        padding,
      ),
      scrollDataIndex: legendIndex || 0,
      data: legendData.sort((a: string, b: string) => {
        if (!legendSort) return 0;
        return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }) as string[],
    },
    series: dedupSeries(reorderForecastSeries(series) as SeriesOption[]),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
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
          {
            type: 'inside',
            yAxisIndex: 0,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
          },
          {
            type: 'inside',
            xAxisIndex: 0,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
          },
        ]
      : [],
  };

  const onFocusedSeries = (seriesName: string | null) => {
    focusedSeries = seriesName;
  };

  return {
    echartOptions,
    emitCrossFilters,
    formData,
    groupby: groupBy,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    setControlValue,
    width,
    legendData,
    onContextMenu,
    onLegendStateChanged,
    onFocusedSeries,
    xValueFormatter: tooltipFormatter,
    xAxis: {
      label: xAxisLabel,
      type: xAxisType,
    },
    refs,
    coltypeMapping: dataTypes,
    onLegendScroll,
  };
}

// ============================================================================
// Shared Render Component
// ============================================================================

/**
 * Unified render component for all timeseries chart variants.
 *
 * When hasExtraControls=true (Line, Area, Step, Bar, Generic):
 * - Renders ExtraControls wrapper above the chart
 * - Uses ResizeObserver to track extra controls height
 * - Subtracts extra controls height from chart height
 * - Includes ec-polygon check in dblclick handler
 *
 * When hasExtraControls=false (Scatter, SmoothLine):
 * - No ExtraControls wrapper
 * - Full height used for chart
 */
export function TimeseriesRender({
  transformedProps,
  hasExtraControls = false,
}: {
  transformedProps: TimeseriesChartTransformedProps;
  hasExtraControls?: boolean;
}) {
  const {
    formData,
    height,
    width,
    echartOptions,
    groupby,
    labelMap,
    selectedValues,
    setDataMask,
    setControlValue,
    legendData = [],
    onContextMenu,
    onLegendStateChanged,
    onFocusedSeries,
    xValueFormatter,
    xAxis,
    refs,
    emitCrossFilters,
    coltypeMapping,
    onLegendScroll,
  } = transformedProps;

  const { stack } = formData;
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const extraControlRef = useRef<HTMLDivElement>(null);
  const [extraControlHeight, setExtraControlHeight] = useState(0);

  useEffect(() => {
    if (!hasExtraControls) return;

    const element = extraControlRef.current;
    if (!element) {
      setExtraControlHeight(0);
      return;
    }

    const updateHeight = () => {
      setExtraControlHeight(element.offsetHeight || 0);
    };

    updateHeight();

    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(element);
      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, [hasExtraControls, formData.showExtraControls]);

  const hasDimensions = ensureIsArray(groupby).length > 0;

  const getModelInfo = (target: ViewRootGroup, globalModel: GlobalModel) => {
    let el = target;
    let model: ComponentModel | null = null;
    while (el) {
      // eslint-disable-next-line no-underscore-dangle
      const modelInfo = el.__ecComponentInfo;
      if (modelInfo != null) {
        model = globalModel.getComponent(modelInfo.mainType, modelInfo.index);
        break;
      }
      el = el.parent;
    }
    return model;
  };

  const getCrossFilterDataMask = useCallback(
    (value: string) => {
      const selected: string[] = Object.values(selectedValues);
      let values: string[];
      if (selected.includes(value)) {
        values = selected.filter(v => v !== value);
      } else {
        values = [value];
      }
      const groupbyValues = values.map(value => labelMap[value]);
      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : groupby.map((col, idx) => {
                    const val = groupbyValues.map(v => v[idx]);
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            label: groupbyValues.length ? groupbyValues : undefined,
            value: groupbyValues.length ? groupbyValues : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(value),
      };
    },
    [groupby, labelMap, selectedValues],
  );

  const handleChange = useCallback(
    (value: string) => {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(value).dataMask);
    },
    [emitCrossFilters, setDataMask, getCrossFilterDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      if (!hasDimensions) {
        return;
      }
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      clickTimer.current = setTimeout(() => {
        const { seriesName: name } = props;
        handleChange(name);
      }, TIMER_DURATION);
    },
    mouseout: () => {
      onFocusedSeries(null);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesName);
    },
    legendscroll: payload => {
      onLegendScroll?.(payload.scrollDataIndex);
    },
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, seriesName } = eventParams;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        const pointerEvent = eventParams.event.event;
        const values = [
          ...(eventParams.name ? [eventParams.name] : []),
          ...(labelMap[seriesName] ?? []),
        ];
        const groupBy = ensureIsArray(formData.groupby);
        if (data && xAxis.type === AxisType.Time) {
          drillToDetailFilters.push({
            col:
              xAxis.label === DTTM_ALIAS
                ? formData.granularitySqla
                : xAxis.label,
            grain: formData.timeGrainSqla,
            op: '==',
            val: data[0],
            formattedVal: xValueFormatter(data[0]),
          });
        }
        [
          ...(xAxis.type === AxisType.Category && data ? [xAxis.label] : []),
          ...groupBy,
        ].forEach((dimension, i) =>
          drillToDetailFilters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: String(values[i]),
          }),
        );
        groupBy.forEach((dimension, i) => {
          const dimensionValues = labelMap[seriesName] ?? [];
          const metricsCount = dimensionValues.length - groupBy.length;
          const val = dimensionValues[metricsCount + i];

          drillByFilters.push({
            col: dimension,
            op: '==',
            val,
            formattedVal: formatSeriesName(val, {
              timeFormatter: getTimeFormatter(formData.dateFormat),
              numberFormatter: getNumberFormatter(formData.numberFormat),
              coltype: coltypeMapping?.[getColumnLabel(dimension)],
            }),
          });
        });

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          drillBy: { filters: drillByFilters, groupbyFieldName: 'groupby' },
          crossFilter: hasDimensions
            ? getCrossFilterDataMask(seriesName)
            : undefined,
        });
      }
    },
  };

  const zrEventHandlers: EventHandlers = {
    dblclick: params => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      const pointInPixel = [params.offsetX, params.offsetY];
      const echartInstance = echartRef.current?.getEchartInstance();
      if (echartInstance?.containPixel('grid', pointInPixel)) {
        if (hasExtraControls && !stack && params.target?.type === 'ec-polygon')
          return;
        // @ts-ignore
        const globalModel = echartInstance.getModel();
        const model = getModelInfo(params.target, globalModel);
        if (model) {
          const { name } = model;
          const legendState: LegendState = legendData.reduce(
            (previous, datum) => ({
              ...previous,
              [datum]: datum === name,
            }),
            {},
          );
          onLegendStateChanged?.(legendState);
        }
      }
    },
  };

  const echart = (
    <Echart
      ref={echartRef}
      refs={refs}
      height={hasExtraControls ? height - extraControlHeight : height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      zrEventHandlers={zrEventHandlers}
      selectedValues={selectedValues}
      vizType={formData.vizType}
    />
  );

  if (!hasExtraControls) {
    return echart;
  }

  return (
    <>
      <div ref={extraControlRef}>
        <ExtraControls formData={formData} setControlValue={setControlValue} />
      </div>
      {echart}
    </>
  );
}

// ============================================================================
// Shared additionalControls pieces
// ============================================================================

/**
 * Shared query section rows - identical across all 7 charts.
 */
export const timeseriesQueryControls: ControlSetRow[] = [
  ...sections.echartsTimeSeriesQueryWithXAxisSort.controlSetRows,
  ...sections.advancedAnalyticsControls.controlSetRows,
  ...sections.annotationsAndLayersControls.controlSetRows,
  ...sections.forecastIntervalControls.controlSetRows,
];

/**
 * Shared chart options header + seriesOrder + color rows - base for all 7 charts.
 */
export const timeseriesBaseChartOptions: ControlSetRow[] = [
  ...sections.titleControls.controlSetRows,
  [
    <ControlSubSectionHeader key="chart">
      {t('Chart Options')}
    </ControlSubSectionHeader>,
  ],
  ...seriesOrderSection,
  ['color_scheme'],
  ['time_shift_color'],
];

/**
 * Area checkbox + opacity slider rows (with visibility condition).
 * Used by Line, Step, Generic charts.
 */
export const areaOpacityRows: ControlSetRow[] = [
  [
    {
      name: 'area',
      config: {
        type: 'CheckboxControl',
        label: t('Area Chart'),
        renderTrigger: true,
        default: area,
        description: t(
          'Draw area under curves. Only applicable for line types.',
        ),
      },
    },
  ],
  [
    {
      name: 'opacity',
      config: {
        type: 'SliderControl',
        label: t('Area chart opacity'),
        renderTrigger: true,
        min: 0,
        max: 1,
        step: 0.1,
        default: opacity,
        description: t(
          'Opacity of Area Chart. Also applies to confidence band.',
        ),
        visibility: ({ controls }: ControlPanelsContainerProps) =>
          Boolean(controls?.area?.value),
      },
    },
  ],
];

/**
 * markerEnabled + markerSize rows with conditional visibility.
 * Used by Line, Area, Step, Generic, SmoothLine charts.
 */
export const markerConditionalRows: ControlSetRow[] = [
  [
    {
      name: 'markerEnabled',
      config: {
        type: 'CheckboxControl',
        label: t('Marker'),
        renderTrigger: true,
        default: markerEnabled,
        description: t(
          'Draw a marker on data points. Only applicable for line types.',
        ),
      },
    },
  ],
  [
    {
      name: 'markerSize',
      config: {
        type: 'SliderControl',
        label: t('Marker Size'),
        renderTrigger: true,
        min: 0,
        max: 20,
        default: markerSize,
        description: t(
          'Size of marker. Also applies to forecast observations.',
        ),
        visibility: ({ controls }: ControlPanelsContainerProps) =>
          Boolean(controls?.markerEnabled?.value),
      },
    },
  ],
];

/**
 * Direct markerSize row without conditional visibility.
 * Used by Scatter chart (always shows markers).
 */
export const markerDirectRow: ControlSetRow[] = [
  [
    {
      name: 'markerSize',
      config: {
        type: 'SliderControl',
        label: t('Marker Size'),
        renderTrigger: true,
        min: 0,
        max: 100,
        default: markerSize,
        description: t(
          'Size of marker. Also applies to forecast observations.',
        ),
      },
    },
  ],
];

/**
 * Standard X Axis rows.
 * Used by Line, Area, Step, Generic, SmoothLine, Scatter charts.
 */
export const xAxisRows: ControlSetRow[] = [
  [
    <ControlSubSectionHeader key="xaxis">
      {t('X Axis')}
    </ControlSubSectionHeader>,
  ],
  [
    {
      name: 'x_axis_time_format',
      config: {
        ...sharedControls.x_axis_time_format,
        default: 'smart_date',
        description: `${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`,
      },
    },
  ],
  [xAxisLabelRotation],
  [xAxisLabelInterval],
  [forceMaxInterval],
];

/**
 * Standard Y Axis rows (logAxis, minorSplitLine, truncateXAxis, xAxisBounds,
 * truncateYAxis, y_axis_bounds with conditional visibility).
 * Used by Line, Area, Step, Generic, SmoothLine, Scatter charts.
 */
export const yAxisRows: ControlSetRow[] = [
  [
    <ControlSubSectionHeader key="yaxis">
      {t('Y Axis')}
    </ControlSubSectionHeader>,
  ],
  ['y_axis_format'],
  ['currency_format'],
  [
    {
      name: 'logAxis',
      config: {
        type: 'CheckboxControl',
        label: t('Logarithmic y-axis'),
        renderTrigger: true,
        default: logAxis,
        description: t('Logarithmic y-axis'),
      },
    },
  ],
  [
    {
      name: 'minorSplitLine',
      config: {
        type: 'CheckboxControl',
        label: t('Minor Split Line'),
        renderTrigger: true,
        default: minorSplitLine,
        description: t('Draw split lines for minor y-axis ticks'),
      },
    },
  ],
  [truncateXAxis],
  [xAxisBounds],
  [
    {
      name: 'truncateYAxis',
      config: {
        type: 'CheckboxControl',
        label: t('Truncate Y Axis'),
        default: truncateYAxis,
        renderTrigger: true,
        description: t(
          'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
        ),
      },
    },
  ],
  [
    {
      name: 'y_axis_bounds',
      config: {
        type: 'BoundsControl',
        label: t('Y Axis Bounds'),
        renderTrigger: true,
        default: yAxisBounds,
        description: t(
          'Bounds for the Y-axis. When left empty, the bounds are ' +
            'dynamically defined based on the min/max of the data. Note that ' +
            "this feature will only expand the axis range. It won't " +
            "narrow the data's extent.",
        ),
        visibility: ({ controls }: ControlPanelsContainerProps) =>
          Boolean(controls?.truncateYAxis?.value),
      },
    },
  ],
];

/**
 * Legend section + zoomable + minorTicks rows.
 * Used by all non-Bar charts (Bar uses its own ordering).
 */
export const legendZoomRows: ControlSetRow[] = [
  ['zoomable'],
  [minorTicks],
  ...legendSection,
];

/**
 * richTooltipSection re-exported for use in chart files.
 */
export { richTooltipSection };

/**
 * AnnotationType re-exported for metadata in chart files.
 */
export type { AnnotationType };
