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
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  getColumnLabel,
  QueryFormColumn,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  DEFAULT_TIME_FORMAT,
  getStandardizedControls,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  legendSection,
  tooltipTimeFormatControl,
  tooltipValuesFormatControl,
  xAxisLabelInterval,
  xAxisLabelRotation,
} from '../controls';
import {
  CANDLESTICK_SERIES_NAME,
  DEFAULT_DECREASE_COLOR,
  DEFAULT_INCREASE_COLOR,
  DEFAULT_SERIES_STYLE,
} from './constants';
import { MOVING_AVERAGE_PERIODS } from './utils';

function hasSeriesDimension({
  controls,
}: ControlPanelsContainerProps): boolean {
  return ensureIsArray(controls?.series?.value).length > 0;
}

type QueryRow = Record<string, unknown>;
type ChartQueryResponse = { data?: QueryRow[] };

const uniqueSeriesCountByResponse = new WeakMap<
  ChartQueryResponse,
  Map<string, number>
>();

function getSeriesColumnLabel(
  props: ControlPanelsContainerProps,
): string | undefined {
  const [series] = ensureIsArray(props.controls?.series?.value);
  if (series == null) {
    return undefined;
  }
  return getColumnLabel(series as QueryFormColumn);
}

function getChartQueryResponse(
  props: ControlPanelsContainerProps,
): ChartQueryResponse | undefined {
  return (props as { chart?: { queriesResponse?: ChartQueryResponse[] } }).chart
    ?.queriesResponse?.[0];
}

function countUniqueSeriesValues(
  props: ControlPanelsContainerProps,
): number | undefined {
  const seriesColumn = getSeriesColumnLabel(props);
  if (!seriesColumn) {
    return undefined;
  }
  const queryResponse = getChartQueryResponse(props);
  const rows = queryResponse?.data;
  if (!queryResponse || !rows) {
    return undefined;
  }
  let cachedByColumn = uniqueSeriesCountByResponse.get(queryResponse);
  if (!cachedByColumn) {
    cachedByColumn = new Map<string, number>();
    uniqueSeriesCountByResponse.set(queryResponse, cachedByColumn);
  }
  const cachedCount = cachedByColumn.get(seriesColumn);
  if (cachedCount !== undefined) {
    return cachedCount;
  }
  const count = new Set(
    rows.map(row =>
      row[seriesColumn] == null ? null : String(row[seriesColumn]),
    ),
  ).size;
  cachedByColumn.set(seriesColumn, count);
  return count;
}

function hasMultipleSeries(props: ControlPanelsContainerProps): boolean {
  return (countUniqueSeriesValues(props) ?? 0) > 1;
}

function showColorByDirection(props: ControlPanelsContainerProps): boolean {
  return !hasMultipleSeries(props);
}

function showDirectionColors(props: ControlPanelsContainerProps): boolean {
  return (
    showColorByDirection(props) &&
    props.controls?.color_by_direction?.value !== false
  );
}

function showColorScheme(props: ControlPanelsContainerProps): boolean {
  return (
    hasMultipleSeries(props) ||
    props.controls?.color_by_direction?.value === false
  );
}

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['x_axis'],
        ['time_grain_sqla'],
        [
          {
            name: 'open',
            config: {
              ...sharedControls.metric,
              label: t('Open'),
              description: t('Opening value for each period.'),
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'close',
            config: {
              ...sharedControls.metric,
              label: t('Close'),
              description: t('Closing value for each period.'),
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'high',
            config: {
              ...sharedControls.metric,
              label: t('High'),
              description: t('Highest value for each period.'),
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'low',
            config: {
              ...sharedControls.metric,
              label: t('Low'),
              description: t('Lowest value for each period.'),
              validators: [validateNonEmpty],
            },
          },
        ],
        ['series'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    sections.titleControls,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['zoomable'],
        [
          {
            name: 'series_style',
            config: {
              type: 'SelectControl',
              label: t('Series style'),
              renderTrigger: true,
              default: DEFAULT_SERIES_STYLE,
              clearable: false,
              choices: [
                ['candlestick', t('Candlestick')],
                ['ohlc', t('OHLC')],
              ],
              description: t(
                'Candlestick draws a filled body between open and close. OHLC draws ticks for open and close on a high-low stem.',
              ),
            },
          },
        ],
        [
          {
            name: 'candlestick_series_name',
            config: {
              type: 'TextControl',
              label: t('Series name'),
              default: CANDLESTICK_SERIES_NAME,
              renderTrigger: true,
              description: t(
                'Name used for the candlestick series in the legend and tooltip when no series dimension is set.',
              ),
              visibility: (props: ControlPanelsContainerProps) =>
                !hasSeriesDimension(props),
            },
          },
        ],
        [
          {
            name: 'moving_averages',
            config: {
              type: 'SelectControl',
              multi: true,
              freeForm: true,
              label: t('Moving averages'),
              choices: MOVING_AVERAGE_PERIODS.map(period => [
                period,
                `MA${period}`,
              ]),
              renderTrigger: true,
              description: t(
                'Overlay simple moving averages of the close price (MA5, MA10, MA15, ...). Type a custom period to add it.',
              ),
            },
          },
        ],
        ...legendSection,
        [
          <ControlSubSectionHeader key="series-colors">
            {t('Series colors')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'color_by_direction',
            config: {
              type: 'CheckboxControl',
              label: t('Color by direction'),
              default: true,
              renderTrigger: true,
              visibility: showColorByDirection,
              description: t(
                'When enabled, increasing candles use the increase color and decreasing candles use the decrease color. Turn off to use one series color, with a filled body for increases and a hollow body for decreases.',
              ),
            },
          },
        ],
        [
          {
            name: 'color_scheme',
            config: {
              ...sharedControls.color_scheme,
              visibility: showColorScheme,
            },
          },
        ],
        [
          {
            name: 'increase_color',
            config: {
              label: t('Increase color'),
              type: 'ColorPickerControl',
              default: DEFAULT_INCREASE_COLOR,
              renderTrigger: true,
              visibility: showDirectionColors,
              description: t(
                'Color used when the close value is greater than or equal to the open value.',
              ),
            },
          },
          {
            name: 'increase_label',
            config: {
              label: t('Increase label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Label used for increasing candles in the tooltip.',
              ),
            },
          },
        ],
        [
          {
            name: 'decrease_color',
            config: {
              label: t('Decrease color'),
              type: 'ColorPickerControl',
              default: DEFAULT_DECREASE_COLOR,
              renderTrigger: true,
              visibility: showDirectionColors,
              description: t(
                'Color used when the close value is less than the open value.',
              ),
            },
          },
          {
            name: 'decrease_label',
            config: {
              label: t('Decrease label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Label used for decreasing candles in the tooltip.',
              ),
            },
          },
        ],
        [
          <ControlSubSectionHeader key="x-axis">
            {t('X Axis')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'show_x_axis',
            config: {
              type: 'CheckboxControl',
              label: t('Show X axis'),
              renderTrigger: true,
              default: true,
              description: t('Show or hide the X axis line, ticks, and labels'),
            },
          },
        ],
        [
          {
            name: 'x_axis_time_format',
            config: {
              ...sharedControls.x_axis_time_format,
              default: DEFAULT_TIME_FORMAT,
              description: `${D3_TIME_FORMAT_DOCS}.`,
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                controls?.show_x_axis?.value !== false,
            },
          },
        ],
        [xAxisLabelRotation],
        [xAxisLabelInterval],
        [
          <ControlSubSectionHeader key="tooltip">
            {t('Tooltip')}
          </ControlSubSectionHeader>,
        ],
        [tooltipTimeFormatControl],
        [tooltipValuesFormatControl],
        [
          <ControlSubSectionHeader key="y-axis">
            {t('Y Axis')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'show_y_axis',
            config: {
              type: 'CheckboxControl',
              label: t('Show Y axis'),
              renderTrigger: true,
              default: true,
              description: t('Show or hide the Y axis line and labels'),
            },
          },
        ],
        ['y_axis_format'],
        ['currency_format'],
        ['echart_options'],
      ],
    },
  ],
  controlOverrides: {
    series: {
      label: t('Series'),
      description: t(
        'Optional dimension used to split the chart into multiple candlestick series.',
      ),
      multi: false,
    },
  },
  formDataOverrides: formData => {
    const [open, close, high, low] = getStandardizedControls()
      .popAllMetrics()
      .slice(0, 4);
    return {
      ...formData,
      ...(open !== undefined ? { open } : {}),
      ...(close !== undefined ? { close } : {}),
      ...(high !== undefined ? { high } : {}),
      ...(low !== undefined ? { low } : {}),
    };
  },
};

export default config;
