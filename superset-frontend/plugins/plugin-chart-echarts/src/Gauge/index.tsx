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
 * ECharts Gauge Chart - Glyph Pattern Implementation
 *
 * Shows a gauge visualization with optional interval coloring,
 * progress bars, and multiple data series support.
 */

import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  CategoricalColorScale,
  Currency as CurrencyType,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getValueFormatter,
  QueryFormData,
  QueryFormMetric,
  tooltipHtml,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { GaugeSeriesOption } from 'echarts/charts';
import type { GaugeDataItemOption } from 'echarts/types/src/chart/gauge/GaugeSeries';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { range } from 'lodash';

import {
  defineChart,
  Metric,
  Dimension,
  Text,
  Checkbox,
  Int,
  NumberFormat,
  Currency,
  ChartProps,
  SortByMetric,
} from '@superset-ui/glyph-core';

import { OpacityEnum } from '../constants';
import { parseNumbersList } from '../utils/controls';
import { getColtypesMapping } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { allEventHandlers } from '../utils/eventHandlers';
import Echart from '../components/Echart';
import { Refs } from '../types';
import {
  EchartsGaugeFormData,
  AxisTickLineStyle,
  GaugeChartTransformedProps,
} from './types';
import {
  defaultGaugeSeriesOption,
  INTERVAL_GAUGE_SERIES_OPTION,
  OFFSETS,
  FONT_SIZE_MULTIPLIERS,
} from './constants';

import thumbnail from './images/thumbnail.png';
import example from './images/example1.jpg';
import exampleDark from './images/example1-dark.jpg';

// ============================================================================
// Helpers
// ============================================================================

export const getIntervalBoundsAndColors = (
  intervals: string,
  intervalColorIndices: string,
  colorFn: CategoricalColorScale,
  min: number,
  max: number,
): Array<[number, string]> => {
  let intervalBoundsNonNormalized;
  let intervalColorIndicesArray;
  try {
    intervalBoundsNonNormalized = parseNumbersList(intervals, ',');
    intervalColorIndicesArray = parseNumbersList(intervalColorIndices, ',');
  } catch (error) {
    intervalBoundsNonNormalized = [] as number[];
    intervalColorIndicesArray = [] as number[];
  }

  const intervalBounds = intervalBoundsNonNormalized.map(
    bound => (bound - min) / (max - min),
  );
  const intervalColors = intervalColorIndicesArray.map(
    ind => colorFn.colors[(ind - 1) % colorFn.colors.length],
  );

  return intervalBounds.map((val, idx) => {
    const color = intervalColors[idx];
    return [val, color || colorFn.colors[idx]];
  });
};

const calculateAxisLineWidth = (
  data: DataRecord[],
  fontSize: number,
  overlap: boolean,
): number => (overlap ? fontSize : data.length * fontSize);

const calculateMin = (data: GaugeDataItemOption[]) =>
  2 * Math.min(...data.map(d => d.value as number).concat([0]));

const calculateMax = (data: GaugeDataItemOption[]) =>
  2 * Math.max(...data.map(d => d.value as number).concat([0]));

// ============================================================================
// Build Query - exported for testing
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const { metric, sort_by_metric: sortByMetric } = formData;
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      ...(sortByMetric && { orderby: [[metric, false]] }),
    },
  ]);
}

// ============================================================================
// Transform Result Type
// ============================================================================

interface GaugeTransformResult {
  transformedProps: GaugeChartTransformedProps;
}

// ============================================================================
// The Chart Definition
// ============================================================================

export default defineChart<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  GaugeTransformResult
>({
  metadata: {
    name: t('Gauge Chart'),
    description: t(
      'Uses a gauge to showcase the variation of a metric across one or multiple groups.',
    ),
    category: t('KPI'),
    tags: [
      t('Multi-Variables'),
      t('Business'),
      t('Comparison'),
      t('ECharts'),
      t('Report'),
      t('Featured'),
    ],
    thumbnail,
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },

  arguments: {
    // Query section
    groupby: Dimension.with({
      label: t('Dimensions'),
      description: t('Columns to group by'),
    }),

    metric: Metric.with({
      label: t('Metric'),
      description: t('The metric to display'),
    }),

    sortByMetric: SortByMetric,

    // General options
    minVal: Text.with({
      label: t('Min'),
      description: t('Minimum value on the gauge axis'),
      default: '',
    }),

    maxVal: Text.with({
      label: t('Max'),
      description: t('Maximum value on the gauge axis'),
      default: '',
    }),

    startAngle: Int.with({
      label: t('Start Angle'),
      description: t('Angle at which to start progress axis'),
      default: 225,
      min: 0,
      max: 360,
      step: 1,
    }),

    endAngle: Int.with({
      label: t('End Angle'),
      description: t('Angle at which to end progress axis'),
      default: -45,
      min: -360,
      max: 360,
      step: 1,
    }),

    fontSize: Int.with({
      label: t('Font Size'),
      description: t(
        'Font size for axis labels, detail value and other text elements',
      ),
      default: 15,
      min: 10,
      max: 20,
      step: 1,
    }),

    numberFormat: NumberFormat,
    currencyFormat: Currency,

    valueFormatter: Text.with({
      label: t('Value Format'),
      description: t(
        'Additional text to add before or after the value, e.g. unit',
      ),
      default: '{value}',
    }),

    showPointer: Checkbox.with({
      label: t('Show Pointer'),
      description: t('Whether to show the pointer'),
      default: true,
    }),

    animation: Checkbox.with({
      label: t('Animation'),
      description: t(
        'Whether to animate the progress and the value or just display them',
      ),
      default: true,
    }),

    // Axis options
    showAxisTick: Checkbox.with({
      label: t('Show Axis Line Ticks'),
      description: t('Whether to show minor ticks on the axis'),
      default: false,
    }),

    showSplitLine: Checkbox.with({
      label: t('Show Split Lines'),
      description: t('Whether to show the split lines on the axis'),
      default: false,
    }),

    splitNumber: Int.with({
      label: t('Split Number'),
      description: t('Number of split segments on the axis'),
      default: 10,
      min: 3,
      max: 30,
      step: 1,
    }),

    // Progress options
    showProgress: Checkbox.with({
      label: t('Show Progress'),
      description: t('Whether to show the progress of gauge chart'),
      default: true,
    }),

    overlap: Checkbox.with({
      label: t('Overlap'),
      description: t(
        'Whether the progress bar overlaps when there are multiple groups of data',
      ),
      default: true,
    }),

    roundCap: Checkbox.with({
      label: t('Round Cap'),
      description: t('Style the ends of the progress bar with a round cap'),
      default: false,
    }),

    // Interval options
    intervals: Text.with({
      label: t('Interval Bounds'),
      description: t(
        'Comma-separated interval bounds, e.g. 2,4,5 for intervals 0-2, 2-4 and 4-5. Last number should match the value provided for MAX.',
      ),
      default: '',
    }),

    intervalColorIndices: Text.with({
      label: t('Interval Colors'),
      description: t(
        'Comma-separated color picks for the intervals, e.g. 1,2,4. Integers denote colors from the chosen color scheme and are 1-indexed. Length must be matching that of interval bounds.',
      ),
      default: '',
    }),
  },

  buildQuery,

  transform: (chartProps: ChartProps): GaugeTransformResult => {
    const {
      width,
      height,
      formData,
      queriesData,
      hooks,
      filterState,
      theme,
      emitCrossFilters,
      datasource,
    } = chartProps;

    const rawFormData = formData as Record<string, unknown>;
    const gaugeSeriesOptions = defaultGaugeSeriesOption(theme);
    const {
      verboseMap = {},
      currencyFormats = {},
      columnFormats = {},
    } = datasource ?? {};

    // Extract form values
    const groupby = (rawFormData.groupby as string[]) || [];
    const metric = (rawFormData.metric as string) ?? '';
    const minVal = rawFormData.min_val as string | number | null;
    const maxVal = rawFormData.max_val as string | number | null;
    const colorScheme = rawFormData.color_scheme as string;
    const fontSize = (rawFormData.font_size as number) ?? 15;
    const numberFormat =
      (rawFormData.number_format as string) ?? 'SMART_NUMBER';
    const currencyFormat = rawFormData.currency_format as
      | CurrencyType
      | undefined;
    const animation = (rawFormData.animation as boolean) ?? true;
    const showProgress = (rawFormData.show_progress as boolean) ?? true;
    const overlap = (rawFormData.overlap as boolean) ?? true;
    const roundCap = (rawFormData.round_cap as boolean) ?? false;
    const showAxisTick = (rawFormData.show_axis_tick as boolean) ?? false;
    const showSplitLine = (rawFormData.show_split_line as boolean) ?? false;
    const splitNumber = (rawFormData.split_number as number) ?? 10;
    const startAngle = (rawFormData.start_angle as number) ?? 225;
    const endAngle = (rawFormData.end_angle as number) ?? -45;
    const showPointer = (rawFormData.show_pointer as boolean) ?? true;
    const intervals = (rawFormData.intervals as string) ?? '';
    const intervalColorIndices =
      (rawFormData.interval_color_indices as string) ?? '';
    const valueFormatter = (rawFormData.value_formatter as string) ?? '{value}';
    const sliceId = rawFormData.slice_id as number | undefined;

    const refs: Refs = {};
    const data = (queriesData[0]?.data || []) as DataRecord[];
    const { colnames = [], coltypes = [] } =
      (queriesData[0] as { colnames?: string[]; coltypes?: number[] }) ?? {};
    const coltypeMapping = getColtypesMapping({ colnames, coltypes });
    const numberFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      numberFormat,
      currencyFormat,
    );
    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
    const axisLineWidth = calculateAxisLineWidth(data, fontSize, overlap);
    const groupbyLabels = groupby.map(getColumnLabel);
    const formatValue = (value: number) =>
      valueFormatter.replace('{value}', numberFormatter(value));
    const axisTickLength = FONT_SIZE_MULTIPLIERS.axisTickLength * fontSize;
    const splitLineLength = FONT_SIZE_MULTIPLIERS.splitLineLength * fontSize;
    const titleOffsetFromTitle =
      FONT_SIZE_MULTIPLIERS.titleOffsetFromTitle * fontSize;
    const detailOffsetFromTitle =
      FONT_SIZE_MULTIPLIERS.detailOffsetFromTitle * fontSize;
    const columnsLabelMap = new Map<string, string[]>();
    const metricLabel = getMetricLabel(metric as QueryFormMetric);

    const transformedData: GaugeDataItemOption[] = data.map(
      (dataPoint: DataRecord, index: number) => {
        const name = groupbyLabels
          .map(
            (column: string) =>
              `${verboseMap[column] || column}: ${dataPoint[column]}`,
          )
          .join(', ');
        const colorLabel = groupbyLabels.map(
          (col: string) => dataPoint[col] as string,
        );
        columnsLabelMap.set(
          name,
          groupbyLabels.map((col: string) => dataPoint[col] as string),
        );
        let item: GaugeDataItemOption = {
          value: dataPoint[metricLabel] as number,
          name,
          itemStyle: {
            color: colorFn(colorLabel, sliceId),
          },
          title: {
            offsetCenter: [
              '0%',
              `${index * titleOffsetFromTitle + OFFSETS.titleFromCenter}%`,
            ],
            fontSize,
            /* eslint-disable theme-colors/no-literal-colors */
            color:
              (theme as { colorTextSecondary?: string })?.colorTextSecondary ??
              '#666',
            /* eslint-enable theme-colors/no-literal-colors */
          },
          detail: {
            offsetCenter: [
              '0%',
              `${
                index * titleOffsetFromTitle +
                OFFSETS.titleFromCenter +
                detailOffsetFromTitle
              }%`,
            ],
            fontSize: FONT_SIZE_MULTIPLIERS.detailFontSize * fontSize,
            // eslint-disable-next-line theme-colors/no-literal-colors
            color: (theme as { colorText?: string })?.colorText ?? '#000',
          },
        };
        if (
          filterState?.selectedValues &&
          !filterState.selectedValues.includes(name)
        ) {
          item = {
            ...item,
            itemStyle: {
              color: colorFn(index, sliceId),
              opacity: OpacityEnum.SemiTransparent,
            },
            detail: {
              show: false,
            },
            title: {
              show: false,
            },
          };
        }
        return item;
      },
    );

    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};

    const isValidNumber = (
      val: number | null | undefined | string,
    ): val is number => {
      if (val == null || val === '') return false;
      const num = typeof val === 'string' ? Number(val) : val;
      return !Number.isNaN(num) && Number.isFinite(num);
    };

    const min = isValidNumber(minVal)
      ? Number(minVal)
      : calculateMin(transformedData);
    const max = isValidNumber(maxVal)
      ? Number(maxVal)
      : calculateMax(transformedData);
    const axisLabels = range(min, max, (max - min) / splitNumber);
    const axisLabelLength = Math.max(
      ...axisLabels.map(label => numberFormatter(label).length).concat([1]),
    );
    const intervalBoundsAndColors = getIntervalBoundsAndColors(
      intervals,
      intervalColorIndices,
      colorFn,
      min,
      max,
    );
    const splitLineDistance =
      axisLineWidth + splitLineLength + OFFSETS.ticksFromLine;
    const axisLabelDistance =
      FONT_SIZE_MULTIPLIERS.axisLabelDistance *
        fontSize *
        FONT_SIZE_MULTIPLIERS.axisLabelLength *
        axisLabelLength +
      (showSplitLine ? splitLineLength : 0) +
      (showAxisTick ? axisTickLength : 0) +
      OFFSETS.ticksFromLine -
      axisLineWidth;
    const axisTickDistance =
      axisLineWidth + axisTickLength + OFFSETS.ticksFromLine;

    const progress = {
      show: showProgress,
      overlap,
      roundCap,
      width: fontSize,
    };
    const splitLine = {
      show: showSplitLine,
      distance: -splitLineDistance,
      length: splitLineLength,
      lineStyle: {
        width: FONT_SIZE_MULTIPLIERS.splitLineWidth * fontSize,
        color: gaugeSeriesOptions.splitLine?.lineStyle?.color,
      },
    };
    const axisLine = {
      roundCap,
      lineStyle: {
        width: axisLineWidth,
        color: gaugeSeriesOptions.axisLine?.lineStyle?.color,
      },
    };
    const axisLabel = {
      distance: -axisLabelDistance,
      fontSize,
      formatter: numberFormatter,
      color: gaugeSeriesOptions.axisLabel?.color,
    };
    const axisTick = {
      show: showAxisTick,
      distance: -axisTickDistance,
      length: axisTickLength,
      lineStyle: gaugeSeriesOptions.axisTick?.lineStyle as AxisTickLineStyle,
    };
    const detail = {
      valueAnimation: animation,
      formatter: (value: number) => formatValue(value),
      color: gaugeSeriesOptions.detail?.color,
    };
    const tooltip = {
      ...getDefaultTooltip(refs),
      formatter: (params: CallbackDataParams) => {
        const { name, value } = params;
        return tooltipHtml([[metricLabel, formatValue(value as number)]], name);
      },
    };

    let pointer;
    if (intervalBoundsAndColors.length) {
      splitLine.lineStyle.color =
        INTERVAL_GAUGE_SERIES_OPTION.splitLine?.lineStyle?.color;
      axisTick.lineStyle.color = INTERVAL_GAUGE_SERIES_OPTION?.axisTick
        ?.lineStyle?.color as string;
      axisLabel.color = INTERVAL_GAUGE_SERIES_OPTION.axisLabel?.color;
      axisLine.lineStyle.color = intervalBoundsAndColors;
      pointer = {
        show: showPointer,
        showAbove: false,
        itemStyle: INTERVAL_GAUGE_SERIES_OPTION.pointer?.itemStyle,
      };
    } else {
      pointer = {
        show: showPointer,
        showAbove: false,
      };
    }

    const series: GaugeSeriesOption[] = [
      {
        type: 'gauge',
        startAngle,
        endAngle,
        min,
        max,
        progress,
        animation,
        axisLine: axisLine as GaugeSeriesOption['axisLine'],
        splitLine,
        splitNumber,
        axisLabel,
        axisTick,
        pointer,
        detail,
        // @ts-ignore
        tooltip,
        radius:
          Math.min(width, height) / 2 - axisLabelDistance - axisTickDistance,
        center: ['50%', '55%'],
        data: transformedData,
      },
    ];

    const echartOptions: EChartsCoreOption = {
      tooltip: {
        ...getDefaultTooltip(refs),
        trigger: 'item',
      },
      series,
    };

    return {
      transformedProps: {
        formData: formData as EchartsGaugeFormData,
        width,
        height,
        echartOptions,
        setDataMask,
        emitCrossFilters,
        labelMap: Object.fromEntries(columnsLabelMap),
        groupby,
        selectedValues: filterState?.selectedValues || [],
        onContextMenu,
        refs,
        coltypeMapping,
      },
    };
  },

  render: ({ transformedProps }) => {
    const { height, width, echartOptions, selectedValues, refs, formData } =
      transformedProps;

    const eventHandlers = allEventHandlers(transformedProps);

    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        selectedValues={selectedValues}
        vizType={formData.vizType}
      />
    );
  },
});
