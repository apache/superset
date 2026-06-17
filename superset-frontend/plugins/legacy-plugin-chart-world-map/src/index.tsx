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
import { Behavior, getValueFormatter, Currency } from '@superset-ui/core';
import {
  formatSelectOptions,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import { rgb } from 'd3-color';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/WorldMap1.jpg';
import example1Dark from './images/WorldMap1-dark.jpg';
import example2 from './images/WorldMap2.jpg';
import example2Dark from './images/WorldMap2-dark.jpg';
import { ColorBy } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactWorldMap = require('./ReactWorldMap').default;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorldMapExtra = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, WorldMapExtra>({
  metadata: {
    name: t('World Map'),
    description: t(
      'A map of the world, that can indicate values in different countries.',
    ),
    category: t('Map'),
    credits: ['http://datamaps.github.io/'],
    tags: [
      t('2D'),
      t('Comparison'),
      t('Intensity'),
      t('Legacy'),
      t('Multi-Dimensions'),
      t('Multi-Layers'),
      t('Multi-Variables'),
      t('Scatter'),
      t('Featured'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
    useLegacyApi: true,
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
  },
  arguments: {},
  additionalControls: {
    queryBefore: [
      ['entity'],
      [
        {
          name: 'country_fieldtype',
          config: {
            type: 'SelectControl',
            label: t('Country Field Type'),
            default: 'cca2',
            choices: [
              ['name', t('Full name')],
              ['cioc', t('code International Olympic Committee (cioc)')],
              ['cca2', t('code ISO 3166-1 alpha-2 (cca2)')],
              ['cca3', t('code ISO 3166-1 alpha-3 (cca3)')],
            ],
            description: t(
              'The country code standard that Superset should expect ' +
                'to find in the [country] column',
            ),
          },
        },
      ],
      ['metric'],
    ],
    query: [['row_limit'], ['sort_by_metric']],
    chartOptions: [['y_axis_format'], ['currency_format']],
  },
  middleSections: [
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_bubbles',
            config: {
              type: 'CheckboxControl',
              label: t('Show Bubbles'),
              default: false,
              renderTrigger: true,
              description: t('Whether to display bubbles on top of countries'),
            },
          },
        ],
        ['secondary_metric'],
        [
          {
            name: 'max_bubble_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Max Bubble Size'),
              default: '25',
              choices: formatSelectOptions([
                '5',
                '10',
                '15',
                '25',
                '50',
                '75',
                '100',
              ]),
            },
          },
        ],
        ['color_picker'],
        [
          {
            name: 'color_by',
            config: {
              type: 'RadioButtonControl',
              label: t('Color by'),
              default: ColorBy.Metric,
              options: [
                [ColorBy.Metric, t('Metric')],
                [ColorBy.Country, t('Country')],
              ],
              description: t(
                'Choose whether a country should be shaded by the metric, or assigned a color based on a categorical color palette',
              ),
            },
          },
        ],
        ['linear_color_scheme'],
        ['color_scheme'],
      ],
    },
  ],
  additionalControlOverrides: {
    entity: {
      label: t('Country Column'),
      description: t('3 letter code of the country'),
    },
    secondary_metric: {
      label: t('Bubble Size'),
      description: t('Metric that defines the size of the bubble'),
    },
    color_picker: {
      label: t('Bubble Color'),
    },
    linear_color_scheme: {
      label: t('Country Color Scheme'),
      visibility: ({
        controls,
      }: {
        controls?: Record<string, { value: unknown }>;
      }) => Boolean(controls?.color_by?.value === ColorBy.Metric),
    },
    color_scheme: {
      label: t('Country Color Scheme'),
      visibility: ({
        controls,
      }: {
        controls?: Record<string, { value: unknown }>;
      }) => Boolean(controls?.color_by?.value === ColorBy.Country),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
  transform: chartProps => {
    const {
      formData,
      hooks,
      inContextMenu,
      filterState,
      emitCrossFilters,
      datasource,
    } = chartProps;
    const { onContextMenu, setDataMask } = hooks as Record<string, unknown>;
    const {
      countryFieldtype,
      entity,
      maxBubbleSize,
      showBubbles,
      linearColorScheme,
      colorPicker,
      colorBy,
      colorScheme,
      sliceId,
      metric,
      yAxisFormat,
      currencyFormat,
    } = formData as Record<string, unknown>;

    const { r, g, b } = (colorPicker ?? { r: 0, g: 0, b: 0 }) as {
      r: number;
      g: number;
      b: number;
    };
    const { currencyFormats = {}, columnFormats = {} } = (datasource ?? {}) as {
      currencyFormats?: Record<string, unknown>;
      columnFormats?: Record<string, unknown>;
    };

    const formatter = getValueFormatter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metric as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currencyFormats as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columnFormats as any,
      yAxisFormat as string,
      currencyFormat as Currency,
    );

    return {
      countryFieldtype,
      entity,
      maxBubbleSize: parseInt(String(maxBubbleSize ?? '25'), 10),
      showBubbles,
      linearColorScheme,
      color: rgb(r, g, b).formatHex(),
      colorBy,
      colorScheme,
      sliceId,
      onContextMenu,
      setDataMask,
      inContextMenu,
      filterState,
      emitCrossFilters,
      formatter,
    };
  },
  render: ({ width, height, data, ...extra }) => (
    <ReactWorldMap width={width} height={height} data={data} {...extra} />
  ),
});
