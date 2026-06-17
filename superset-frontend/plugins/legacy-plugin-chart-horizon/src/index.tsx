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
import { formatSelectOptions } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import example from './images/Horizon_Chart.jpg';
import exampleDark from './images/Horizon_Chart-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const HorizonChart = require('./HorizonChart').default;

type HorizonExtra = {
  colorScale: string;
  seriesHeight: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, HorizonExtra>({
  metadata: {
    name: t('Horizon Chart'),
    description: t(
      'Compares how a metric changes over time between different groups. Each group is mapped to a row and change over time is visualized bar lengths and color.',
    ),
    category: t('Distribution'),
    credits: ['http://kmandov.github.io/d3-horizon-chart/'],
    tags: [t('Legacy')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
    useLegacyApi: true,
  },
  arguments: {},
  prependSections: [
    {
      label: t('Time'),
      expanded: true,
      description: t('Time related form attributes'),
      controlSetRows: [['granularity_sqla'], ['time_range']],
    },
  ],
  additionalControls: {
    queryBefore: [['metrics']],
    query: [
      ['groupby'],
      ['limit', 'timeseries_limit_metric'],
      ['order_desc'],
      [
        {
          name: 'contribution',
          config: {
            type: 'CheckboxControl',
            label: t('Contribution'),
            default: false,
            description: t('Compute the contribution to the total'),
          },
        },
      ],
      ['row_limit', null],
    ],
    chartOptions: [
      [
        {
          name: 'series_height',
          config: {
            type: 'SelectControl',
            renderTrigger: true,
            freeForm: true,
            label: t('Series Height'),
            default: '25',
            choices: formatSelectOptions([
              '10',
              '25',
              '40',
              '50',
              '75',
              '100',
              '150',
              '200',
            ]),
            description: t('Pixel height of each series'),
          },
        },
        {
          name: 'horizon_color_scale',
          config: {
            type: 'SelectControl',
            renderTrigger: true,
            label: t('Value Domain'),
            choices: [
              ['series', t('series')],
              ['overall', t('overall')],
              ['change', t('change')],
            ],
            default: 'series',
            description: t(
              'series: Treat each series independently; overall: All series use the same scale; change: Show changes compared to the first data point in each series',
            ),
          },
        },
      ],
    ],
  },
  transform: chartProps => {
    const { formData } = chartProps;
    const { horizonColorScale, seriesHeight } = formData as Record<
      string,
      string
    >;
    return {
      colorScale: horizonColorScale ?? 'series',
      seriesHeight: parseInt(seriesHeight ?? '25', 10),
    };
  },
  render: ({ width, height, data, colorScale, seriesHeight }) => (
    <HorizonChart
      width={width}
      height={height}
      data={data}
      colorScale={colorScale}
      seriesHeight={seriesHeight}
    />
  ),
});
