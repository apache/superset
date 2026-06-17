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
 * ECharts Pie Chart - Glyph Pattern Implementation
 *
 * A classic pie/donut chart for showing proportions of a whole.
 * Supports Nightingale (rose) charts, custom labels, and "Other" grouping.
 */

import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getValueFormatter,
  NumberFormats,
  QueryFormData,
  tooltipHtml,
  ValueFormatter,
} from '@superset-ui/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { EChartsCoreOption } from 'echarts/core';
import type { PieSeriesOption } from 'echarts/charts';

import {
  defineChart,
  Metric,
  Dimension,
  Select,
  Text,
  Checkbox,
  Int,
  NumberFormat,
  Currency,
  TimeFormat,
  ChartProps,
  // Presets
  ShowLegend,
  ShowLabels,
  LegendType as LegendTypeArg,
  LegendOrientation as LegendOrientationArg,
  LegendSort as LegendSortArg,
} from '@superset-ui/glyph-core';

import { OpacityEnum } from '../constants';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from '../utils/series';
import { defaultGrid } from '../defaults';
import { convertInteger } from '../utils/convertInteger';
import { getDefaultTooltip } from '../utils/tooltip';
import { allEventHandlers } from '../utils/eventHandlers';
import Echart from '../components/Echart';
import { Refs, LegendOrientation, LegendType } from '../types';
import { CONTRIBUTION_SUFFIX } from './constants';
import {
  EchartsPieFormData,
  EchartsPieLabelType,
  PieChartDataItem,
  PieChartTransformedProps,
} from './types';

import thumbnail from './images/thumbnail.png';
import example1 from './images/Pie1.jpg';
import example1Dark from './images/Pie1-dark.jpg';
import example2 from './images/Pie2.jpg';
import example2Dark from './images/Pie2-dark.jpg';
import example3 from './images/Pie3.jpg';
import example3Dark from './images/Pie3-dark.jpg';
import example4 from './images/Pie4.jpg';
import example4Dark from './images/Pie4-dark.jpg';

// ============================================================================
// Constants & Helpers
// ============================================================================

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

const getContributionLabel = (metricLabel: string) =>
  `${metricLabel}${CONTRIBUTION_SUFFIX}`;

function parseParams({
  params,
  numberFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'>;
  numberFormatter: ValueFormatter;
  sanitizeName?: boolean;
}): string[] {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  return [name, formattedValue, formattedPercent];
}

function getTotalValuePadding({
  chartPadding,
  donut,
  width,
  height,
}: {
  chartPadding: { bottom: number; left: number; right: number; top: number };
  donut: boolean;
  width: number;
  height: number;
}) {
  const padding: { left?: string; top?: string } = {
    top: donut ? 'middle' : '0',
    left: 'center',
  };
  if (chartPadding.top) {
    padding.top = donut
      ? `${50 + (chartPadding.top / height / 2) * 100}%`
      : `${(chartPadding.top / height) * 100}%`;
  }
  if (chartPadding.bottom) {
    padding.top = donut
      ? `${50 - (chartPadding.bottom / height / 2) * 100}%`
      : '0';
  }
  if (chartPadding.left) {
    const leftPaddingPercent = (chartPadding.left / width) * 100;
    const adjustedLeftPercent = 50 + leftPaddingPercent * 0.25;
    padding.left = `${adjustedLeftPercent}%`;
  }
  if (chartPadding.right) {
    const rightPaddingPercent = (chartPadding.right / width) * 100;
    const adjustedLeftPercent = 50 - rightPaddingPercent * 0.75;
    padding.left = `${adjustedLeftPercent}%`;
  }
  return padding;
}

// ============================================================================
// Build Query - exported for testing
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const { metric, sort_by_metric } = formData;
  const metricLabel = getMetricLabel(metric);

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      ...(sort_by_metric && { orderby: [[metric, false]] }),
      post_processing: [
        {
          operation: 'contribution',
          options: {
            columns: [metricLabel],
            rename_columns: [getContributionLabel(metricLabel)],
          },
        },
      ],
    },
  ]);
}

// ============================================================================
// Select Options
// ============================================================================

const ROSE_TYPE_OPTIONS = [
  { label: t('None'), value: '' },
  { label: t('Area'), value: 'area' },
  { label: t('Radius'), value: 'radius' },
];

const LABEL_TYPE_OPTIONS = [
  { label: t('Category Name'), value: 'key' },
  { label: t('Value'), value: 'value' },
  { label: t('Percentage'), value: 'percent' },
  { label: t('Category and Value'), value: 'key_value' },
  { label: t('Category and Percentage'), value: 'key_percent' },
  { label: t('Category, Value and Percentage'), value: 'key_value_percent' },
  { label: t('Value and Percentage'), value: 'value_percent' },
  { label: t('Template'), value: 'template' },
];

// Legend options imported from glyph-core/presets

// ============================================================================
// Transform Result Type
// ============================================================================

interface PieTransformResult {
  transformedProps: PieChartTransformedProps;
}

// ============================================================================
// The Chart Definition
// ============================================================================

export default defineChart<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  PieTransformResult
>({
  metadata: {
    name: t('Pie Chart'),
    description: t(
      `The classic. Great for showing how much of a company each investor gets, what demographics follow your blog, or what portion of the budget goes to the military industrial complex.

      Pie charts can be difficult to interpret precisely. If clarity of relative proportion is important, consider using a bar or other chart type instead.`,
    ),
    category: t('Part of a Whole'),
    tags: [
      t('Categorical'),
      t('Circular'),
      t('Comparison'),
      t('Percentages'),
      t('Featured'),
      t('Proportional'),
      t('Nightingale'),
    ],
    thumbnail,
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
      { url: example3, urlDark: example3Dark },
      { url: example4, urlDark: example4Dark },
    ],
  },

  arguments: {
    // Query section
    groupby: Dimension.with({
      label: t('Dimensions'),
      description: t('Columns to group by on the pie slices'),
    }),

    metric: Metric.with({
      label: t('Metric'),
      description: t('The metric used to determine slice size'),
    }),

    sortByMetric: Checkbox.with({
      label: t('Sort by metric'),
      description: t('Sort slices by the metric value'),
      default: true,
    }),

    // Chart options
    showLabelsThreshold: Text.with({
      label: t('Percentage threshold'),
      description: t(
        'Minimum threshold in percentage points for showing labels.',
      ),
      default: '5',
    }),

    thresholdForOther: Int.with({
      label: t('Threshold for Other'),
      description: t(
        'Values less than this percentage will be grouped into the Other category.',
      ),
      default: 0,
      min: 0,
      max: 100,
      step: 1,
    }),

    roseType: Select.with({
      label: t('Rose Type'),
      description: t('Whether to show as Nightingale chart.'),
      options: ROSE_TYPE_OPTIONS,
      default: '',
    }),

    // Legend section
    showLegend: ShowLegend,

    legendType: { arg: LegendTypeArg, visibleWhen: { showLegend: true } },
    legendOrientation: {
      arg: LegendOrientationArg,
      visibleWhen: { showLegend: true },
    },

    legendMargin: {
      arg: Text.with({
        label: t('Legend Margin'),
        description: t('Additional padding for legend.'),
        default: '',
      }),
      visibleWhen: { showLegend: true },
    },

    legendSort: { arg: LegendSortArg, visibleWhen: { showLegend: true } },

    // Label section
    labelType: Select.with({
      label: t('Label Type'),
      description: t('What should be shown on the label?'),
      options: LABEL_TYPE_OPTIONS,
      default: 'key',
    }),

    labelTemplate: {
      arg: Text.with({
        label: t('Label Template'),
        description: t(
          'Format data labels. Use variables: {name}, {value}, {percent}. ' +
            '\\n represents a new line.',
        ),
        default: '',
      }),
      visibleWhen: { labelType: 'template' },
    },

    numberFormat: NumberFormat,
    currencyFormat: Currency,
    dateFormat: TimeFormat,

    showLabels: ShowLabels,

    labelsOutside: {
      arg: Checkbox.with({
        label: t('Put labels outside'),
        description: t('Put the labels outside of the pie?'),
        default: true,
      }),
      visibleWhen: { showLabels: true },
    },

    labelLine: {
      arg: Checkbox.with({
        label: t('Label Line'),
        description: t('Draw line from Pie to label when labels outside?'),
        default: false,
      }),
      visibleWhen: { showLabels: true },
    },

    showTotal: Checkbox.with({
      label: t('Show Total'),
      description: t('Whether to display the aggregate count'),
      default: false,
    }),

    // Pie shape section
    outerRadius: Int.with({
      label: t('Outer Radius'),
      description: t('Outer edge of Pie chart'),
      default: 70,
      min: 10,
      max: 100,
      step: 1,
    }),

    donut: Checkbox.with({
      label: t('Donut'),
      description: t('Do you want a donut or a pie?'),
      default: false,
    }),

    innerRadius: {
      arg: Int.with({
        label: t('Inner Radius'),
        description: t('Inner radius of donut hole'),
        default: 30,
        min: 0,
        max: 100,
        step: 1,
      }),
      visibleWhen: { donut: true },
    },
  },

  additionalControls: {
    query: [['groupby'], ['adhoc_filters'], ['row_limit']],
    chartOptions: [['color_scheme']],
  },

  controlOverrides: {
    row_limit: {
      default: 100,
    },
  },

  buildQuery,

  transform: (chartProps: ChartProps, _argValues): PieTransformResult => {
    const {
      formData,
      height,
      hooks,
      filterState,
      queriesData,
      width,
      theme,
      inContextMenu,
      emitCrossFilters,
      datasource,
    } = chartProps;

    const { columnFormats = {}, currencyFormats = {} } = datasource ?? {};
    const {
      data: rawData = [],
      colnames = [],
      coltypes = [],
    } = queriesData[0] ?? {};
    const coltypeMapping = getColtypesMapping({ colnames, coltypes });

    const {
      colorScheme,
      donut = false,
      groupby = [],
      innerRadius = 30,
      labelsOutside = true,
      labelLine = false,
      labelType = EchartsPieLabelType.Key,
      labelTemplate,
      legendMargin,
      legendOrientation = LegendOrientation.Top,
      legendType = LegendType.Scroll,
      legendSort,
      metric = '',
      numberFormat = 'SMART_NUMBER',
      currencyFormat,
      dateFormat = 'smart_date',
      outerRadius = 70,
      showLabels = true,
      showLegend = true,
      showLabelsThreshold = 5,
      sliceId,
      showTotal = false,
      roseType,
      thresholdForOther = 0,
    } = formData;

    const refs: Refs = {};
    const metricLabel = getMetricLabel(metric);
    const contributionLabel = getContributionLabel(metricLabel);
    const groupbyLabels = (groupby || []).map(getColumnLabel);
    const minShowLabelAngle = (showLabelsThreshold || 0) * 3.6;

    const numberFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      numberFormat,
      currencyFormat,
    );

    let data = rawData;
    const otherRows: DataRecord[] = [];
    const otherTooltipData: string[][] = [];
    let otherDatum: PieChartDataItem | null = null;
    let otherSum = 0;

    if (thresholdForOther) {
      let contributionSum = 0;
      data = data.filter((datum: DataRecord) => {
        const contribution = datum[contributionLabel] as number;
        if (!contribution || contribution * 100 >= thresholdForOther) {
          return true;
        }
        otherSum += datum[metricLabel] as number;
        contributionSum += contribution;
        otherRows.push(datum);
        otherTooltipData.push([
          extractGroupbyLabel({
            datum,
            groupby: groupbyLabels,
            coltypeMapping,
            timeFormatter: getTimeFormatter(dateFormat),
          }),
          numberFormatter(datum[metricLabel] as number),
          percentFormatter(contribution),
        ]);
        return false;
      });
      const otherName = t('Other');
      otherTooltipData.push([
        t('Total'),
        numberFormatter(otherSum),
        percentFormatter(contributionSum),
      ]);
      if (otherSum) {
        otherDatum = {
          name: otherName,
          value: otherSum,
          itemStyle: {
            // eslint-disable-next-line theme-colors/no-literal-colors
            color: (theme as { colorText?: string })?.colorText ?? '#000',
            opacity:
              filterState?.selectedValues &&
              !filterState.selectedValues.includes(otherName)
                ? OpacityEnum.SemiTransparent
                : OpacityEnum.NonTransparent,
          },
          isOther: true,
        };
      }
    }

    const labelMap = data.reduce(
      (acc: Record<string, string[]>, datum: DataRecord) => {
        const label = extractGroupbyLabel({
          datum,
          groupby: groupbyLabels,
          coltypeMapping,
          timeFormatter: getTimeFormatter(dateFormat),
        });
        return {
          ...acc,
          [label]: groupbyLabels.map((col: string) => datum[col] as string),
        };
      },
      {},
    );

    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};
    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

    let totalValue = 0;

    const transformedData: PieSeriesOption[] = data.map((datum: DataRecord) => {
      const name = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping,
        timeFormatter: getTimeFormatter(dateFormat),
      });

      const isFiltered =
        filterState?.selectedValues &&
        !filterState.selectedValues.includes(name);
      const value = datum[metricLabel];

      if (typeof value === 'number' || typeof value === 'string') {
        totalValue += convertInteger(value);
      }

      return {
        value,
        name,
        itemStyle: {
          color: colorFn(name, sliceId),
          opacity: isFiltered
            ? OpacityEnum.SemiTransparent
            : OpacityEnum.NonTransparent,
        },
      };
    });

    if (otherDatum) {
      transformedData.push(otherDatum);
      totalValue += otherSum;
    }

    const selectedValues = (filterState?.selectedValues || []).reduce(
      (acc: Record<string, number>, selectedValue: string) => {
        const index = transformedData.findIndex(
          ({ name }) => name === selectedValue,
        );
        return {
          ...acc,
          [index]: selectedValue,
        };
      },
      {},
    );

    const formatTemplate = (
      template: string,
      formattedParams: { name: string; value: string; percent: string },
      rawParams: CallbackDataParams,
    ) => {
      const items = {
        '{name}': formattedParams.name,
        '{value}': formattedParams.value,
        '{percent}': formattedParams.percent,
        '{a}': rawParams.seriesName || '',
        '{b}': rawParams.name,
        '{c}': `${rawParams.value}`,
        '{d}': `${rawParams.percent}`,
        '\\n': '\n',
      };
      return Object.entries(items).reduce(
        (acc, [key, value]) => acc.replaceAll(key, value),
        template,
      );
    };

    const formatter = (params: CallbackDataParams) => {
      const [name, formattedValue, formattedPercent] = parseParams({
        params,
        numberFormatter,
      });
      switch (labelType) {
        case EchartsPieLabelType.Key:
          return name;
        case EchartsPieLabelType.Value:
          return formattedValue;
        case EchartsPieLabelType.Percent:
          return formattedPercent;
        case EchartsPieLabelType.KeyValue:
          return `${name}: ${formattedValue}`;
        case EchartsPieLabelType.KeyValuePercent:
          return `${name}: ${formattedValue} (${formattedPercent})`;
        case EchartsPieLabelType.KeyPercent:
          return `${name}: ${formattedPercent}`;
        case EchartsPieLabelType.ValuePercent:
          return `${formattedValue} (${formattedPercent})`;
        case EchartsPieLabelType.Template:
          if (!labelTemplate) return '';
          return formatTemplate(
            labelTemplate,
            { name, value: formattedValue, percent: formattedPercent },
            params,
          );
        default:
          return name;
      }
    };

    const defaultLabel = {
      formatter,
      show: showLabels,
      // eslint-disable-next-line theme-colors/no-literal-colors
      color: (theme as { colorText?: string })?.colorText ?? '#000',
    };

    const chartPadding = getChartPadding(
      showLegend,
      legendOrientation,
      legendMargin,
    );

    const series: PieSeriesOption[] = [
      {
        type: 'pie',
        ...chartPadding,
        animation: false,
        roseType: roseType || undefined,
        radius: [`${donut ? innerRadius : 0}%`, `${outerRadius}%`],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        labelLine:
          labelsOutside && labelLine ? { show: true } : { show: false },
        minShowLabelAngle,
        label: labelsOutside
          ? {
              ...defaultLabel,
              position: 'outer',
              alignTo: 'none',
              bleedMargin: 5,
            }
          : {
              ...defaultLabel,
              position: 'inner',
            },
        emphasis: {
          label: {
            show: true,
            fontWeight: 'bold',
            /* eslint-disable theme-colors/no-literal-colors */
            backgroundColor:
              (theme as { colorBgContainer?: string })?.colorBgContainer ??
              '#fff',
            /* eslint-enable theme-colors/no-literal-colors */
          },
        },
        data: transformedData,
      },
    ];

    const echartOptions: EChartsCoreOption = {
      grid: { ...defaultGrid },
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu,
        trigger: 'item',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const [name, formattedValue, formattedPercent] = parseParams({
            params,
            numberFormatter,
            sanitizeName: true,
          });
          if (params?.data?.isOther) {
            return tooltipHtml(otherTooltipData, name);
          }
          return tooltipHtml(
            [[metricLabel, formattedValue, formattedPercent]],
            name,
          );
        },
      },
      legend: {
        ...getLegendProps(legendType, legendOrientation, showLegend, theme),
        data: transformedData
          .map(datum => datum.name)
          .sort((a: string, b: string) => {
            if (!legendSort) return 0;
            return legendSort === 'asc'
              ? a.localeCompare(b)
              : b.localeCompare(a);
          }),
      },
      graphic: showTotal
        ? {
            type: 'text',
            ...getTotalValuePadding({ chartPadding, donut, width, height }),
            style: {
              text: t('Total: %s', numberFormatter(totalValue)),
              fontSize: 16,
              fontWeight: 'bold',
              // eslint-disable-next-line theme-colors/no-literal-colors
              fill: (theme as { colorText?: string })?.colorText ?? '#000',
            },
            z: 10,
          }
        : null,
      series,
    };

    return {
      transformedProps: {
        formData: formData as EchartsPieFormData,
        width,
        height,
        echartOptions,
        setDataMask,
        labelMap,
        groupby,
        selectedValues,
        onContextMenu,
        refs,
        emitCrossFilters,
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
