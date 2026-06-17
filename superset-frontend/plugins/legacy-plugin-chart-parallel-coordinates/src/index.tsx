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
import { defineChart } from '@superset-ui/glyph-core';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.jpg';
import example1Dark from './images/example1-dark.jpg';
import example2 from './images/example2.jpg';
import example2Dark from './images/example2-dark.jpg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactParallelCoordinates = require('./ReactParallelCoordinates').default;

type ParallelCoordinatesExtra = {
  includeSeries: boolean;
  linearColorScheme: string;
  metrics: string[];
  colorMetric: string | undefined;
  series: string;
  showDatatable: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, ParallelCoordinatesExtra>({
  metadata: {
    name: t('Parallel Coordinates'),
    description: t(
      'Plots the individual metrics for each row in the data vertically and links them together as a line. This chart is useful for comparing multiple metrics across all of the samples or rows in the data.',
    ),
    category: t('Ranking'),
    credits: ['https://syntagmatic.github.io/parallel-coordinates'],
    tags: [t('Directional'), t('Legacy'), t('Relational')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
    useLegacyApi: true,
  },
  arguments: {},
  additionalControls: {
    queryBefore: [['series'], ['metrics'], ['secondary_metric']],
    query: [
      ['limit', 'row_limit'],
      ['timeseries_limit_metric'],
      ['order_desc'],
    ],
  },
  middleSections: [
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_datatable',
            config: {
              type: 'CheckboxControl',
              label: t('Data Table'),
              default: false,
              renderTrigger: true,
              description: t('Whether to display the interactive data table'),
            },
          },
          {
            name: 'include_series',
            config: {
              type: 'CheckboxControl',
              label: t('Include Series'),
              renderTrigger: true,
              default: false,
              description: t('Include series name as an axis'),
            },
          },
        ],
        ['linear_color_scheme'],
      ],
    },
  ],
  transform: chartProps => {
    const { formData } = chartProps;
    const {
      includeSeries,
      linearColorScheme,
      metrics,
      secondaryMetric,
      series,
      showDatatable,
    } = formData as Record<string, unknown>;

    return {
      includeSeries: (includeSeries as boolean) ?? false,
      linearColorScheme: (linearColorScheme as string) ?? '',
      metrics: ((metrics as Array<string | { label: string }>) ?? []).map(
        m => (m as { label?: string }).label || (m as string),
      ),
      colorMetric:
        secondaryMetric && (secondaryMetric as { label?: string }).label
          ? (secondaryMetric as { label: string }).label
          : (secondaryMetric as string | undefined),
      series: (series as string) ?? '',
      showDatatable: (showDatatable as boolean) ?? false,
    };
  },
  render: ({
    width,
    height,
    data,
    includeSeries,
    linearColorScheme,
    metrics,
    colorMetric,
    series,
    showDatatable,
  }) => (
    <ReactParallelCoordinates
      width={width}
      height={height}
      data={data}
      includeSeries={includeSeries}
      linearColorScheme={linearColorScheme}
      metrics={metrics}
      colorMetric={colorMetric}
      series={series}
      showDatatable={showDatatable}
    />
  ),
});
