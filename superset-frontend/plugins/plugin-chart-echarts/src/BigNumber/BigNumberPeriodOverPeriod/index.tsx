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
 * Big Number with Time Period Comparison - Glyph Pattern Implementation
 *
 * Showcases a metric along with a comparison of value, change, and percent
 * change for a selected time period.
 */

// Type augmentation for dayjs plugins
import 'dayjs/plugin/utc';
import { t } from '@apache-superset/core/translation';
import {
  buildQueryContext,
  ChartProps,
  ensureIsArray,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  PostProcessingRule,
  QueryFormData,
  SimpleAdhocFilter,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  getStandardizedControls,
  isTimeComparison,
  Metric,
  sections,
  sharedControls,
  timeCompareOperator,
  ColorSchemeEnum,
} from '@superset-ui/chart-controls';
import { noop, isEmpty } from 'lodash';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';

import { defineChart } from '@superset-ui/glyph-core';

import {
  headerFontSize,
  subheaderFontSize,
  subtitleControl,
  subtitleFontSize,
  showMetricNameControl,
  metricNameFontSizeWithVisibility,
} from '../sharedControls';
import { getOriginalLabel } from '../utils';
import PopKPI from './PopKPI';
import { FontSizeOptions, PopKPIProps } from './types';
import {
  getComparisonFontSize,
  getHeaderFontSize,
  getMetricNameFontSize,
} from './utils';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

// ============================================================================
// Build Query
// ============================================================================

function buildQuery(formData: QueryFormData) {
  const { cols: groupby } = formData;

  const queryContextA = buildQueryContext(formData, baseQueryObject => {
    const postProcessing: PostProcessingRule[] = [];
    postProcessing.push(timeCompareOperator(formData, baseQueryObject));

    const nonCustomNorInheritShifts = ensureIsArray(
      formData.time_compare,
    ).filter((shift: string) => shift !== 'custom' && shift !== 'inherit');
    const customOrInheritShifts = ensureIsArray(formData.time_compare).filter(
      (shift: string) => shift === 'custom' || shift === 'inherit',
    );

    let timeOffsets: string[] = [];

    if (!isEmpty(nonCustomNorInheritShifts)) {
      timeOffsets = nonCustomNorInheritShifts;
    }

    if (!isEmpty(customOrInheritShifts)) {
      if (customOrInheritShifts.includes('custom')) {
        timeOffsets = timeOffsets.concat([formData.start_date_offset]);
      }
      if (customOrInheritShifts.includes('inherit')) {
        timeOffsets = timeOffsets.concat(['inherit']);
      }
    }
    return [
      {
        ...baseQueryObject,
        groupby,
        post_processing: postProcessing,
        time_offsets: isTimeComparison(formData, baseQueryObject)
          ? ensureIsArray(timeOffsets)
          : [],
      },
    ];
  });

  return {
    ...queryContextA,
  };
}

// ============================================================================
// Transform
// ============================================================================

const parseMetricValue = (metricValue: number | string | null) => {
  if (typeof metricValue === 'string') {
    const dateObject = dayjs.utc(metricValue, undefined, true);
    if (dateObject.isValid()) {
      return dateObject.valueOf();
    }
    return 0;
  }
  return metricValue ?? 0;
};

interface PopKPITransformResult {
  popKPIProps: PopKPIProps;
}

function transformPopKPI(chartProps: ChartProps): PopKPIProps {
  const {
    width,
    height,
    formData,
    queriesData,
    datasource: { currencyFormats = {}, columnFormats = {} },
  } = chartProps;
  const {
    boldText,
    headerFontSize,
    headerText,
    metric,
    metricNameFontSize,
    yAxisFormat,
    currencyFormat,
    subheaderFontSize,
    comparisonColorScheme,
    comparisonColorEnabled,
    percentDifferenceFormat,
    subtitle = '',
    subtitleFontSize,
    columnConfig = {},
  } = formData;
  const { data: dataA = [] } = queriesData[0];
  const data = dataA;
  const metricName = metric ? getMetricLabel(metric) : '';
  const metrics = chartProps.datasource?.metrics || [];
  const originalLabel = getOriginalLabel(metric, metrics);
  const showMetricName = chartProps.rawFormData?.show_metric_name ?? false;
  const timeComparison = ensureIsArray(chartProps.rawFormData?.time_compare)[0];
  const startDateOffset = chartProps.rawFormData?.start_date_offset;
  const currentTimeRangeFilter = chartProps.rawFormData?.adhoc_filters?.filter(
    (adhoc_filter: SimpleAdhocFilter) =>
      adhoc_filter.operator === 'TEMPORAL_RANGE',
  )?.[0];

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === metric,
    );
  }

  const isCustomOrInherit =
    timeComparison === 'custom' || timeComparison === 'inherit';
  let dataOffset: string[] = [];
  if (isCustomOrInherit) {
    if (timeComparison && timeComparison === 'custom') {
      dataOffset = [startDateOffset];
    } else {
      dataOffset = ensureIsArray(timeComparison) || [];
    }
  }

  const { value1, value2 } = data.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: { value1: number; value2: number }, curr: { [x: string]: any }) => {
      Object.keys(curr).forEach(key => {
        if (
          key.includes(
            `${metricName}__${
              !isCustomOrInherit ? timeComparison : dataOffset[0]
            }`,
          )
        ) {
          acc.value2 += curr[key];
        } else if (key.includes(metricName)) {
          acc.value1 += curr[key];
        }
      });
      return acc;
    },
    { value1: 0, value2: 0 },
  );

  let bigNumber: number | string =
    data.length === 0 ? 0 : parseMetricValue(value1);
  let prevNumber: number | string =
    data.length === 0 ? 0 : parseMetricValue(value2);

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    metricEntry?.d3format || yAxisFormat,
    currencyFormat,
  );

  const compTitles = {
    r: 'Range' as string,
    y: 'Year' as string,
    m: 'Month' as string,
    w: 'Week' as string,
  };

  const formatPercentChange = getNumberFormatter(percentDifferenceFormat);

  let valueDifference: number | string = bigNumber - prevNumber;

  let percentDifferenceNum;

  if (!bigNumber && !prevNumber) {
    percentDifferenceNum = 0;
  } else if (!bigNumber || !prevNumber) {
    percentDifferenceNum = bigNumber ? 1 : -1;
  } else {
    percentDifferenceNum = (bigNumber - prevNumber) / Math.abs(prevNumber);
  }

  const compType =
    compTitles[formData.timeComparison as keyof typeof compTitles];
  bigNumber = numberFormatter(bigNumber);
  prevNumber = numberFormatter(prevNumber);
  valueDifference = numberFormatter(valueDifference);
  const percentDifference: string = formatPercentChange(percentDifferenceNum);

  return {
    width,
    height,
    data,
    metrics,
    metricName: originalLabel,
    bigNumber,
    prevNumber,
    valueDifference,
    percentDifferenceFormattedString: percentDifference,
    boldText,
    subtitle,
    subtitleFontSize,
    showMetricName,
    metricNameFontSize: getMetricNameFontSize(metricNameFontSize),
    headerFontSize: getHeaderFontSize(
      headerFontSize,
    ) as unknown as FontSizeOptions,
    subheaderFontSize: getComparisonFontSize(
      subheaderFontSize,
    ) as unknown as FontSizeOptions,
    headerText,
    compType,
    comparisonColorEnabled,
    comparisonColorScheme,
    percentDifferenceNumber: percentDifferenceNum,
    currentTimeRangeFilter,
    startDateOffset,
    shift: timeComparison,
    dashboardTimeRange: formData?.extraFormData?.time_range,
    columnConfig,
  };
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  PopKPITransformResult
>({
  metadata: {
    name: t('Big Number with Time Period Comparison'),
    description: t(
      'Showcases a metric along with a comparison of value, change, and percent change for a selected time period.',
    ),
    category: t('KPI'),
    tags: [
      t('Comparison'),
      t('Business'),
      t('ECharts'),
      t('Percentages'),
      t('Report'),
      t('Advanced-Analytics'),
    ],
    thumbnail,
    thumbnailDark,
  },

  arguments: {},

  additionalControls: {
    query: [
      ['metric'],
      ['adhoc_filters'],
      [
        {
          name: 'row_limit',
          config: sharedControls.row_limit,
        },
      ],
    ],
    chartOptions: [
      ['y_axis_format'],
      [
        {
          name: 'percentDifferenceFormat',
          config: {
            ...sharedControls.y_axis_format,
            label: t('Percent Difference format'),
          },
        },
      ],
      ['currency_format'],
      [
        {
          ...headerFontSize,
          config: { ...headerFontSize.config, default: 0.2 },
        },
      ],
      [subtitleControl],
      [subtitleFontSize],
      [showMetricNameControl],
      [metricNameFontSizeWithVisibility],
      [
        {
          ...subheaderFontSize,
          config: {
            ...subheaderFontSize.config,
            default: 0.125,
            label: t('Comparison font size'),
          },
        },
      ],
      [
        {
          name: 'comparison_color_enabled',
          config: {
            type: 'CheckboxControl',
            label: t('Add color for positive/negative change'),
            renderTrigger: true,
            default: false,
            description: t('Add color for positive/negative change'),
          },
        },
      ],
      [
        {
          name: 'comparison_color_scheme',
          config: {
            type: 'SelectControl',
            label: t('color scheme for comparison'),
            default: ColorSchemeEnum.Green,
            renderTrigger: true,
            choices: [
              [ColorSchemeEnum.Green, 'Green for increase, red for decrease'],
              [ColorSchemeEnum.Red, 'Red for increase, green for decrease'],
            ],
            visibility: ({
              controls,
            }: {
              controls?: Record<string, { value?: unknown }>;
            }) => controls?.comparison_color_enabled?.value === true,
            description: t(
              'Adds color to the chart symbols based on the positive or ' +
                'negative change from the comparison value.',
            ),
          },
        },
      ],
      [
        {
          name: 'column_config',
          config: {
            type: 'ColumnConfigControl',
            label: t('Customize columns'),
            description: t('Further customize how to display each column'),
            width: 400,
            height: 320,
            renderTrigger: true,
            configFormLayout: {
              [GenericDataType.Numeric]: [
                {
                  tab: t('General'),
                  children: [
                    ['customColumnName'],
                    ['displayTypeIcon'],
                    ['visible'],
                  ],
                },
              ],
            },
            shouldMapStateToProps() {
              return true;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mapStateToProps(explore: any, _: any, chart: any) {
              noop(explore, _, chart);
              return {
                columnsPropsObject: {
                  colnames: ['Previous value', 'Delta', 'Percent change'],
                  coltypes: [
                    GenericDataType.Numeric,
                    GenericDataType.Numeric,
                    GenericDataType.Numeric,
                  ],
                },
              };
            },
          },
        },
      ],
    ],
  },

  additionalSections: [
    sections.timeComparisonControls({
      multi: false,
      showCalculationType: false,
      showFullChoices: false,
    }),
  ],

  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },

  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): PopKPITransformResult => ({
    popKPIProps: transformPopKPI(chartProps),
  }),

  render: ({ popKPIProps }) => <PopKPI {...popKPIProps} />,
});
