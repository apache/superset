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
  buildQueryContext,
  ChartProps,
  getColumnLabel,
  QueryFormOrderBy,
  validateNonEmpty,
} from '@superset-ui/core';
import { getStandardizedControls } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import WordCloud, {
  WordCloudEncoding,
  WordCloudProps,
} from './chart/WordCloud';
import { WordCloudFormData } from './types';
import { RotationControl, ColorSchemeControl } from './controls';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/Word_Cloud.jpg';
import example1Dark from './images/Word_Cloud-dark.jpg';
import example2 from './images/Word_Cloud_2.jpg';
import example2Dark from './images/Word_Cloud_2-dark.jpg';

export * from './types';

// ─── buildQuery ──────────────────────────────────────────────────────────────

function buildQuery(formData: WordCloudFormData) {
  const { metric, sort_by_metric, sort_by_series, series, row_limit } =
    formData;
  const orderby: QueryFormOrderBy[] = [];
  const shouldApplyOrderBy =
    row_limit !== undefined && row_limit !== null && row_limit !== 0;

  if (sort_by_metric && metric) {
    orderby.push([metric, false]);
  }
  if (sort_by_series !== false && series) {
    orderby.push([series, true]);
  }

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      ...(shouldApplyOrderBy && orderby.length > 0 && { orderby }),
    },
  ]);
}

// ─── transformProps ──────────────────────────────────────────────────────────

function getMetricLabel(
  metric: WordCloudFormData['metric'],
): string | undefined {
  if (typeof metric === 'string' || typeof metric === 'undefined') {
    return metric;
  }
  if (Array.isArray(metric)) {
    return metric.length > 0 ? getMetricLabel(metric[0]) : undefined;
  }
  return metric.label;
}

function transformProps(chartProps: ChartProps): WordCloudProps {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    metric,
    rotation,
    series,
    sizeFrom = 0,
    sizeTo,
    sliceId,
  } = formData as WordCloudFormData;

  const metricLabel = getMetricLabel(metric);
  const seriesLabel = getColumnLabel(series);

  const encoding: Partial<WordCloudEncoding> = {
    color: {
      field: seriesLabel,
      scale: { scheme: colorScheme },
      type: 'nominal',
    },
    fontSize:
      typeof metricLabel === 'undefined'
        ? undefined
        : {
            field: metricLabel,
            scale: { range: [sizeFrom, sizeTo], zero: true },
            type: 'quantitative',
          },
    text: { field: seriesLabel },
  };

  return {
    data: queriesData[0].data,
    encoding,
    height,
    rotation,
    width,
    sliceId,
    colorScheme,
  };
}

// ─── Plugin definition ───────────────────────────────────────────────────────

const WordCloudChartPlugin = defineChart<Record<string, never>, WordCloudProps>(
  {
    metadata: {
      name: t('Word Cloud'),
      description: t(
        'Visualizes the words in a column that appear the most often. Bigger font corresponds to higher frequency.',
      ),
      category: t('Ranking'),
      credits: ['https://github.com/jasondavies/d3-cloud'],
      tags: [
        t('Categorical'),
        t('Comparison'),
        t('Density'),
        t('Single Metric'),
      ],
      thumbnail,
      thumbnailDark,
      exampleGallery: [
        { url: example1, urlDark: example1Dark },
        { url: example2, urlDark: example2Dark },
      ],
    },
    arguments: {},
    suppressQuerySection: true,
    prependSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series'],
          ['metric'],
          ['adhoc_filters'],
          ['row_limit'],
          ['sort_by_metric'],
          [
            {
              name: 'sort_by_series',
              config: {
                type: 'CheckboxControl',
                label: t('Sort by series'),
                default: true,
                description: t(
                  'Sort results by series name in ascending order. ' +
                    'When combined with "Sort by metric", this acts as a tiebreaker ' +
                    'for equal metric values. Adding this sort may reduce query ' +
                    'performance on some databases.',
                ),
              },
            },
          ],
        ],
      },
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          [
            {
              name: 'size_from',
              config: {
                type: 'TextControl',
                isInt: true,
                label: t('Minimum Font Size'),
                renderTrigger: true,
                default: 10,
                description: t('Font size for the smallest value in the list'),
              },
            },
            {
              name: 'size_to',
              config: {
                type: 'TextControl',
                isInt: true,
                label: t('Maximum Font Size'),
                renderTrigger: true,
                default: 70,
                description: t('Font size for the biggest value in the list'),
              },
            },
          ],
          [<RotationControl name="rotation" key="rotation" renderTrigger />],
          [
            <ColorSchemeControl
              name="color_scheme"
              key="color_scheme"
              renderTrigger
            />,
          ],
        ],
      },
    ],
    additionalControlOverrides: {
      series: {
        validators: [validateNonEmpty],
        clearable: false,
      },
      row_limit: {
        default: 100,
      },
    },
    formDataOverrides: formData => ({
      ...formData,
      series: getStandardizedControls().shiftColumn(),
      metric: getStandardizedControls().shiftMetric(),
    }),
    transform: chartProps => transformProps(chartProps as ChartProps),
    buildQuery: (formData: WordCloudFormData) => buildQuery(formData),
    render: props => <WordCloud {...(props as WordCloudProps)} />,
  },
);

export { WordCloudChartPlugin };
export default WordCloudChartPlugin;
