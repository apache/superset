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
import { invert } from 'lodash';
import {
  AnnotationLayer,
  AxisType,
  buildCustomFormatters,
  CategoricalColorNamespace,
  CurrencyFormatter,
  ensureIsArray,
  tooltipHtml,
  GenericDataType,
  getCustomFormatter,
  getMetricLabel,
  getNumberFormatter,
  getXAxisLabel,
  isDefined,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isPhysicalColumn,
  isTimeseriesAnnotationLayer,
  t,
  TimeseriesChartDataResponseResult,
  NumberFormats,
} from '@superset-ui/core';
import {
  extractExtraMetrics,
  getOriginalSeries,
  isDerivedSeries,
  getTimeOffset,
} from '@superset-ui/chart-controls';
import type { EChartsCoreOption } from 'echarts/core';
import type { LineStyleOption } from 'echarts/types/src/util/types';
import type { SeriesOption } from 'echarts';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
  OrientationType,
  TimeseriesChartTransformedProps,
} from './types';
import { DEFAULT_FORM_DATA } from './constants';
import { ForecastSeriesEnum, ForecastValue, Refs } from '../types';
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

export default function transformProps(
  chartProps: EchartsTimeseriesChartProps,
): TimeseriesChartTransformedProps {
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
    area,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    adhocFilters,
    extraFormData,
    groupby,
    groupByHidden,
    legendOrientation,
    legendType,
    legendMargin,
    logAxis,
    markerEnabled,
    markerSize,
    metrics,
    minorSplitLine,
    minorTicks,
    onlyTotal,
    opacity,
    orientation,
    percentageThreshold,
    richTooltip,
    fromToTooltip,
    disableSanitizeHtml,
    seriesType,
    connectPoints,
    waterfallView,
    showLegend,
    showValue,
    sliceId,
    sortSeriesType,
    sortSeriesAscending,
    timeGrainSqla,
    timeCompare,
    timeShiftColor,
    stack,
    tooltipTimeFormat,
    tooltipSortByMetric,
    truncateXAxis,
    truncateYAxis,
    xAxis: xAxisOrig,
    xAxisBounds,
    xAxisForceCategorical,
    xAxisLabelRotation,
    xAxisSortSeries,
    xAxisSortSeriesAscending,
    xAxisTimeFormat,
    xAxisTitle,
    xAxisTitleMargin,
    yAxisBounds,
    yAxisFormat,
    currencyFormat,
    yAxisTitle,
    yAxisTitleMargin,
    yAxisTitlePosition,
    yAxisTitleSuffix,
    yAxisInvert,
    zoomable,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const refs: Refs = {};
  const groupBy = ensureIsArray(groupby);
  const labelMap = Object.entries(label_map).reduce((acc, entry) => {
    if (
      entry[1].length > groupBy.length &&
      Array.isArray(timeCompare) &&
      timeCompare.includes(entry[1][0])
    ) {
      entry[1].shift();
    }
    return { ...acc, [entry[0]]: entry[1] };
  }, {});

  const stackSet: any[] = [
    ...new Set(
      Object.entries(labelMap).map((x: [string, string[]]) =>
        x[1].slice(-groupBy.length).join(),
      ),
    ),
  ];
  const stackMap: any = Object.entries(labelMap).reduce(
    (acc, entry: [string, string[]]) => ({
      ...acc,
      [entry[0]]: stackSet.indexOf(entry[1].slice(-groupBy.length).join()),
    }),
    {},
  );

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseForecastDatum(data, verboseMap);
  let xAxisLabel = getXAxisLabel(chartProps.rawFormData) as string;
  if (
    isPhysicalColumn(chartProps.rawFormData?.x_axis) &&
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
  const extraMetricLabels = extractExtraMetrics(chartProps.rawFormData).map(
    getMetricLabel,
  );

  const isMultiSeries = groupBy.length || metrics?.length > 1;

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
      xAxisSortSeries: isMultiSeries ? xAxisSortSeries : undefined,
      xAxisSortSeriesAscending: isMultiSeries
        ? xAxisSortSeriesAscending
        : undefined,
    },
  );
  const showValueIndexes = extractShowValueIndexes(rawSeries, {
    stack,
    onlyTotal,
    isHorizontal,
    legendState,
  });
  if (groupByHidden !== undefined) {
    rawSeries.forEach(option => {
      const displayLabel = labelMap[option.id as string]
        .filter((_: any, i: number) => i !== formData.groupByHidden)
        .join();
      // eslint-disable-next-line no-param-reassign
      option.id = displayLabel;
      // eslint-disable-next-line no-param-reassign
      option.name = displayLabel;
    });
  }

  const seriesContexts = extractForecastSeriesContexts(
    rawSeries.map(series => series.name as string),
  );
  const isAreaExpand = stack === StackControlsValue.Expand;
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];

  const xAxisType = getAxisType(stack, xAxisForceCategorical, xAxisDataType);
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

  const array = ensureIsArray(chartProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  const offsetLineWidths: { [key: string]: number } = {};

  /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["series"] }] */
  const updateStackIndex = (series: any) => {
    if (series.stack) {
      series.stack = `${series.stack}.${stackMap[series.id]}`;
    }
    return series;
  };

  /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["series"] }] */
  const updateSeriesStyle = (series: any) => {
    if (labelMap[series.id][0] === (metrics[0] as any).label) {
      series.itemStyle.color = 'transparent';
      series.name = undefined;
      series.silent = true;
    }
  };

  rawSeries.forEach(entry => {
    const derivedSeries = isDerivedSeries(entry, chartProps.rawFormData);
    const lineStyle: LineStyleOption = {};
    if (derivedSeries) {
      const offset = getTimeOffset(
        entry,
        ensureIsArray(chartProps.rawFormData?.time_compare),
      )!;
      if (!offsetLineWidths[offset]) {
        offsetLineWidths[offset] = Object.keys(offsetLineWidths).length + 1;
      }
      lineStyle.type = 'dashed';
      lineStyle.width = offsetLineWidths[offset];
      lineStyle.opacity = OpacityEnum.DerivedSeries;
    }

    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;
    const colorScaleKey = getOriginalSeries(seriesName, array);

    if (connectPoints && seriesType === EchartsTimeseriesSeriesType.Line) {
      // eslint-disable-next-line no-param-reassign
      entry.data = (entry.data as any).filter((en: any[]) => en[1]);
    }
    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area,
        connectNulls: derivedSeries,
        filterState,
        seriesContexts,
        markerEnabled,
        markerSize,
        areaOpacity: opacity,
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
      },
    );
    if (transformedSeries) {
      if (waterfallView) {
        updateSeriesStyle(transformedSeries);
      }
      if (stack === StackControlsValue.Stream) {
        // bug in Echarts - `stackStrategy: 'all'` doesn't work with nulls, so we cast them to 0
        series.push({
          ...transformedSeries,
          data: (transformedSeries.data as any).map(
            (row: [string | number, number]) => [row[0], row[1] ?? 0],
          ),
        });
      } else if (stack === StackControlsValue.StackNone) {
        series.push(updateStackIndex(transformedSeries));
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
            markerSize,
            data,
            annotationData,
            colorScale,
            sliceId,
          ),
        );
      }
    });

  // axis bounds need to be parsed to replace incompatible values with undefined
  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  let [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if ((contributionMode === 'row' || isAreaExpand) && stack) {
    if (yAxisMin === undefined) yAxisMin = 0;
    if (yAxisMax === undefined) yAxisMax = 1;
  } else if (
    logAxis &&
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
      : String;

  const {
    setDataMask = () => {},
    setControlValue = () => {},
    onContextMenu,
    onLegendStateChanged,
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
    .concat(extractAnnotationLabels(annotationLayers, annotationData));

  const yAxisNameComputed = [yAxisTitle]
    .concat(
      adhocFilters?.find((x: any) => x.subject === yAxisTitleSuffix)
        ?.comparator,
    )
    .concat(
      extraFormData.filters?.find((x: any) => x.col === yAxisTitleSuffix)?.val,
    )
    ?.filter(Boolean)
    .join(', ');

  let xAxis: any = {
    type: xAxisType,
    name: xAxisTitle,
    nameGap: convertInteger(xAxisTitleMargin),
    nameLocation: 'middle',
    axisLabel: {
      hideOverlap: true,
      formatter: xAxisFormatter,
      rotate: xAxisLabelRotation,
    },
    minorTick: { show: minorTicks },
    minInterval:
      xAxisType === AxisType.Time && timeGrainSqla
        ? TIMEGRAIN_TO_TIMESTAMP[timeGrainSqla]
        : 0,
    ...getMinAndMaxFromBounds(
      xAxisType,
      truncateXAxis,
      xAxisMin,
      xAxisMax,
      seriesType,
    ),
  };

  let yAxis: any = {
    ...defaultYAxis,
    type: logAxis ? AxisType.Log : AxisType.Value,
    min: yAxisMin,
    max: yAxisMax,
    inverse: yAxisInvert,
    minorTick: { show: minorTicks },
    minorSplitLine: { show: minorSplitLine },
    axisLabel: {
      formatter: getYAxisFormatter(
        metrics,
        forcePercentFormatter,
        customFormatters,
        defaultFormatter,
        yAxisFormat,
      ),
    },
    scale: truncateYAxis,
    name: yAxisNameComputed,
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
        if (!params.value) {
          // eslint-disable-next-line no-param-reassign
          params.value = [];
        }
        const xValue: number = richTooltip
          ? params[0].value[xIndex]
          : params.value[xIndex];
        const forecastValue: any[] = richTooltip ? params : [params];
        const sortedKeys = extractTooltipKeys(
          forecastValue,
          yIndex,
          richTooltip,
          tooltipSortByMetric,
        );
        const forecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(forecastValue, isHorizontal);

        const isForecast = Object.values(forecastValues).some(
          value =>
            value.forecastTrend || value.forecastLower || value.forecastUpper,
        );

        const formatter = forcePercentFormatter
          ? percentFormatter
          : (getCustomFormatter(customFormatters, metrics) ?? defaultFormatter);

        const rows: string[][] = [];
        const total = Object.values(forecastValues).reduce(
          (acc, value) =>
            value.observation !== undefined ? acc + value.observation : acc,
          0,
        );
        const showTotal = Boolean(isMultiSeries) && richTooltip && !isForecast;
        const showPercentage = showTotal && !forcePercentFormatter;
        const keys = Object.keys(forecastValues);
        let focusedRow;
        let cumulativeObservation = 0;
        sortedKeys
          .filter(key => keys.includes(key))
          .forEach(key => {
            const value = forecastValues[key];
            if (value.observation === 0 && stack) {
              return;
            }
            if (value.observation) {
              cumulativeObservation += value.observation;
              value.cumulative = value.cumulative
                ? (value.cumulative += cumulativeObservation)
                : cumulativeObservation;
            }
            const row = formatForecastTooltipSeries({
              ...value,
              seriesName: key,
              formatter,
              disableSanitizeHtml,
              fromToTooltip,
            });
            if (
              showPercentage &&
              value.observation !== undefined &&
              !value.isTooltipHidden
            ) {
              row.push(
                percentFormatter.format(value.observation / (total || 1)),
              );
            }
            if (!value.isTooltipHidden) {
              rows.push(row);
            }
            if (key === focusedSeries) {
              focusedRow = rows.length - 1;
            }
          });
        if (stack && !yAxisInvert) {
          rows.reverse();
          if (focusedRow !== undefined) {
            focusedRow = rows.length - focusedRow - 1;
          }
        }
        if (showTotal) {
          const totalRow = [t('Total'), formatter.format(total)];
          if (showPercentage) {
            totalRow.push(percentFormatter.format(1));
          }
          if (fromToTooltip) {
            totalRow.splice(1, 0, '');
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
      ),
      data: legendData as string[],
    },
    series: dedupSeries(series),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          ...(stack ? { yAxisIndex: false } : {}), // disable y-axis zoom for stacked charts
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
  };
}
