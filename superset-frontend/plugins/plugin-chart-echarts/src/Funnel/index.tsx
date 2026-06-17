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
 * ECharts Funnel Chart - Glyph Pattern Implementation
 *
 * Showcases how a metric changes as the funnel progresses.
 * Useful for visualizing drop-off between stages in a pipeline.
 */

import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  Currency as CurrencyType,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  NumberFormats,
  QueryFormData,
  tooltipHtml,
  ValueFormatter,
  VizType,
} from '@superset-ui/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { EChartsCoreOption } from 'echarts/core';
import type { FunnelSeriesOption } from 'echarts/charts';

import {
  defineChart,
  Metric,
  Dimension,
  Select,
  Checkbox,
  Int,
  NumberFormat,
  Currency,
  ChartProps,
  // Presets
  ShowLegend,
  ShowLabels,
  LabelType,
  LegendType as LegendTypeArg,
  LegendOrientation as LegendOrientationArg,
  LegendSort as LegendSortArg,
  SortByMetric,
  LABEL_TYPE_OPTIONS,
  SORT_OPTIONS,
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
import { getDefaultTooltip } from '../utils/tooltip';
import { allEventHandlers } from '../utils/eventHandlers';
import Echart from '../components/Echart';
import { Refs, LegendOrientation, LegendType } from '../types';
import {
  EchartsFunnelFormData,
  EchartsFunnelLabelType,
  FunnelChartTransformedProps,
  PercentCalcType,
} from './types';

import thumbnail from './images/thumbnail.png';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';

// ============================================================================
// Constants & Helpers
// ============================================================================

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

const PERCENT_CALC_OPTIONS = [
  { label: t('Calculate from first step'), value: PercentCalcType.FirstStep },
  {
    label: t('Calculate from previous step'),
    value: PercentCalcType.PreviousStep,
  },
  { label: t('Percent of total'), value: PercentCalcType.Total },
];

const ORIENT_OPTIONS = [
  { label: t('Vertical'), value: 'vertical' },
  { label: t('Horizontal'), value: 'horizontal' },
];

// Map string label types to enum values for formatter
const LABEL_TYPE_MAP: Record<string, EchartsFunnelLabelType> = {
  key: EchartsFunnelLabelType.Key,
  value: EchartsFunnelLabelType.Value,
  percent: EchartsFunnelLabelType.Percent,
  key_value: EchartsFunnelLabelType.KeyValue,
  key_percent: EchartsFunnelLabelType.KeyPercent,
  key_value_percent: EchartsFunnelLabelType.KeyValuePercent,
  value_percent: EchartsFunnelLabelType.ValuePercent,
};

export function parseParams({
  params,
  numberFormatter,
  percentCalculationType = PercentCalcType.FirstStep,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent' | 'data'>;
  numberFormatter: ValueFormatter;
  percentCalculationType?: PercentCalcType;
  sanitizeName?: boolean;
}) {
  const { name: rawName = '', value, percent: totalPercent, data } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const { firstStepPercent, prevStepPercent } = data as {
    firstStepPercent: number;
    prevStepPercent: number;
  };
  let percent;

  if (percentCalculationType === PercentCalcType.Total) {
    percent = (totalPercent ?? 0) / 100;
  } else if (percentCalculationType === PercentCalcType.PreviousStep) {
    percent = prevStepPercent ?? 0;
  } else {
    percent = firstStepPercent ?? 0;
  }
  const formattedPercent = percentFormatter(percent);
  return [name, formattedValue, formattedPercent];
}

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

interface FunnelTransformResult {
  transformedProps: FunnelChartTransformedProps;
}

// ============================================================================
// The Chart Definition
// ============================================================================

export default defineChart<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  FunnelTransformResult
>({
  metadata: {
    name: t('Funnel Chart'),
    description: t(
      'Showcases how a metric changes as the funnel progresses. This classic chart is useful for visualizing drop-off between stages in a pipeline or lifecycle.',
    ),
    category: t('KPI'),
    tags: [
      t('Business'),
      t('ECharts'),
      t('Progressive'),
      t('Report'),
      t('Sequential'),
      t('Trend'),
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
      description: t('The metric used to determine funnel size'),
    }),

    sortByMetric: SortByMetric,

    percentCalculationType: Select.with({
      label: t('% Calculation'),
      description: t(
        'Display percents in the label and tooltip as the percent of the total value, from the first step of the funnel, or from the previous step in the funnel.',
      ),
      options: PERCENT_CALC_OPTIONS,
      default: PercentCalcType.FirstStep,
    }),

    // Chart options
    sort: Select.with({
      label: t('Sort'),
      description: t('How to sort the funnel stages'),
      options: SORT_OPTIONS,
      default: 'descending',
    }),

    orient: Select.with({
      label: t('Orientation'),
      description: t('Funnel orientation'),
      options: ORIENT_OPTIONS,
      default: 'vertical',
    }),

    gap: Int.with({
      label: t('Gap'),
      description: t('Gap between funnel segments'),
      default: 0,
      min: 0,
      max: 50,
      step: 1,
    }),

    // Legend section
    showLegend: ShowLegend,

    legendType: { arg: LegendTypeArg, visibleWhen: { showLegend: true } },
    legendOrientation: {
      arg: LegendOrientationArg,
      visibleWhen: { showLegend: true },
    },

    legendMargin: {
      arg: Int.with({
        label: t('Legend Margin'),
        description: t('Additional padding for legend'),
        default: 0,
        min: 0,
        max: 100,
        step: 1,
      }),
      visibleWhen: { showLegend: true },
    },

    legendSort: { arg: LegendSortArg, visibleWhen: { showLegend: true } },

    // Label section
    labelType: LabelType,

    tooltipLabelType: Select.with({
      label: t('Tooltip Contents'),
      description: t('What should be shown in the tooltip?'),
      options: LABEL_TYPE_OPTIONS,
      default: 'key_value_percent',
    }),

    numberFormat: NumberFormat,
    currencyFormat: Currency,

    showLabels: ShowLabels,

    labelLine: {
      arg: Checkbox.with({
        label: t('Label Line'),
        description: t('Draw line from funnel to label'),
        default: false,
      }),
      visibleWhen: { showLabels: true },
    },

    showTooltipLabels: Checkbox.with({
      label: t('Show Tooltip Labels'),
      description: t('Whether to display the tooltip labels'),
      default: true,
    }),
  },

  buildQuery,

  transform: (chartProps: ChartProps): FunnelTransformResult => {
    const {
      formData,
      height,
      hooks,
      filterState,
      queriesData,
      width,
      theme,
      emitCrossFilters,
      datasource,
      inContextMenu,
    } = chartProps;

    const rawFormData = formData as Record<string, unknown>;
    const data: DataRecord[] = (queriesData[0]?.data as DataRecord[]) || [];
    const { colnames = [], coltypes = [] } =
      (queriesData[0] as { colnames?: string[]; coltypes?: number[] }) ?? {};
    const coltypeMapping = getColtypesMapping({ colnames, coltypes });
    const { columnFormats = {}, currencyFormats = {} } = datasource ?? {};

    // Extract form values
    const colorScheme = rawFormData.color_scheme as string;
    const groupby = (rawFormData.groupby as string[]) || [];
    const orient = rawFormData.orient as 'vertical' | 'horizontal' | undefined;
    const sort = rawFormData.sort as
      | 'descending'
      | 'ascending'
      | 'none'
      | undefined;
    const gap = (rawFormData.gap as number) ?? 0;
    const labelLine = (rawFormData.label_line as boolean) ?? false;
    const labelType =
      LABEL_TYPE_MAP[rawFormData.label_type as string] ??
      EchartsFunnelLabelType.Key;
    const tooltipLabelType =
      LABEL_TYPE_MAP[rawFormData.tooltip_label_type as string] ??
      EchartsFunnelLabelType.KeyValuePercent;
    const legendMargin = (rawFormData.legend_margin as number) ?? 0;
    const legendOrientation =
      (rawFormData.legend_orientation as LegendOrientation) ??
      LegendOrientation.Top;
    const legendType =
      (rawFormData.legend_type as LegendType) ?? LegendType.Scroll;
    const legendSort = (rawFormData.legend_sort as string) ?? '';
    const metric = (rawFormData.metric as string) ?? '';
    const numberFormat =
      (rawFormData.number_format as string) ?? 'SMART_NUMBER';
    const currencyFormat = rawFormData.currency_format as
      | CurrencyType
      | undefined;
    const showLabels = (rawFormData.show_labels as boolean) ?? true;
    const showTooltipLabels =
      (rawFormData.show_tooltip_labels as boolean) ?? true;
    const showLegend = (rawFormData.show_legend as boolean) ?? true;
    const sliceId = rawFormData.slice_id as number | undefined;
    const percentCalculationType =
      (rawFormData.percent_calculation_type as PercentCalcType) ??
      PercentCalcType.FirstStep;

    const refs: Refs = {};
    const metricLabel = getMetricLabel(metric);
    const groupbyLabels = groupby.map(getColumnLabel);
    const keys = data.map(datum =>
      extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping: {},
      }),
    );
    const labelMap = data.reduce(
      (acc: Record<string, string[]>, datum: DataRecord) => {
        const label = extractGroupbyLabel({
          datum,
          groupby: groupbyLabels,
          coltypeMapping: {},
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
    const numberFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      numberFormat,
      currencyFormat,
    );

    const transformedData: {
      value: number;
      name: string;
      itemStyle: { color: string; opacity: OpacityEnum };
      firstStepPercent: number;
      prevStepPercent: number;
    }[] = data.map((datum: DataRecord, index: number) => {
      const name = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping: {},
      });
      const value = datum[metricLabel] as number;
      const isFiltered =
        filterState?.selectedValues &&
        !filterState.selectedValues.includes(name);
      const firstStepPercent = value / (data[0][metricLabel] as number);
      const prevStepPercent =
        index === 0 ? 1 : value / (data[index - 1][metricLabel] as number);
      return {
        value,
        name,
        itemStyle: {
          color: colorFn(name, sliceId),
          opacity: isFiltered
            ? OpacityEnum.SemiTransparent
            : OpacityEnum.NonTransparent,
        },
        firstStepPercent,
        prevStepPercent,
      };
    });

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

    const formatter = (params: CallbackDataParams) => {
      const [name, formattedValue, formattedPercent] = parseParams({
        params,
        numberFormatter,
        percentCalculationType,
      });
      switch (labelType) {
        case EchartsFunnelLabelType.Key:
          return name;
        case EchartsFunnelLabelType.Value:
          return formattedValue;
        case EchartsFunnelLabelType.Percent:
          return formattedPercent;
        case EchartsFunnelLabelType.KeyValue:
          return `${name}: ${formattedValue}`;
        case EchartsFunnelLabelType.KeyValuePercent:
          return `${name}: ${formattedValue} (${formattedPercent})`;
        case EchartsFunnelLabelType.KeyPercent:
          return `${name}: ${formattedPercent}`;
        case EchartsFunnelLabelType.ValuePercent:
          return `${formattedValue} (${formattedPercent})`;
        default:
          return name;
      }
    };

    const defaultLabel = {
      formatter,
      show: showLabels,
      /* eslint-disable theme-colors/no-literal-colors */
      color: (theme as { colorText?: string })?.colorText ?? '#000',
      textBorderColor:
        (theme as { colorBgBase?: string })?.colorBgBase ?? '#fff',
      /* eslint-enable theme-colors/no-literal-colors */
      textBorderWidth: 1,
    };

    const series: FunnelSeriesOption[] = [
      {
        type: VizType.Funnel,
        ...getChartPadding(showLegend, legendOrientation, legendMargin),
        animation: true,
        minSize: '0%',
        maxSize: '100%',
        sort,
        orient,
        gap,
        funnelAlign: 'center',
        labelLine: { show: !!labelLine },
        label: {
          ...defaultLabel,
          position: labelLine ? 'outer' : 'inner',
        },
        emphasis: {
          label: {
            show: true,
            fontWeight: 'bold',
          },
        },
        // @ts-ignore
        data: transformedData,
      },
    ];

    const echartOptions: EChartsCoreOption = {
      grid: {
        ...defaultGrid,
      },
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu && showTooltipLabels,
        trigger: 'item',
        formatter: (params: CallbackDataParams) => {
          const [name, formattedValue, formattedPercent] = parseParams({
            params,
            numberFormatter,
            percentCalculationType,
          });
          const row = [];
          const enumName = EchartsFunnelLabelType[tooltipLabelType];
          const title = enumName.includes('Key') ? name : undefined;
          if (enumName.includes('Value') || enumName.includes('Percent')) {
            row.push(metricLabel);
          }
          if (enumName.includes('Value')) {
            row.push(formattedValue);
          }
          if (enumName.includes('Percent')) {
            row.push(formattedPercent);
          }
          return tooltipHtml([row], title);
        },
      },
      legend: {
        ...getLegendProps(legendType, legendOrientation, showLegend, theme),
        data: keys.sort((a: string, b: string) => {
          if (!legendSort) return 0;
          return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
        }),
      },
      series,
    };

    return {
      transformedProps: {
        formData: formData as EchartsFunnelFormData,
        width,
        height,
        echartOptions,
        setDataMask,
        emitCrossFilters,
        labelMap,
        groupby,
        selectedValues,
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
