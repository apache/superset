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
import { ChartLabel } from '@superset-ui/core';
import {
  formatSelectOptions,
  D3_FORMAT_OPTIONS,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import {
  showLegend,
  xAxisLabel,
  yAxisLabel,
  bottomMargin,
  xTicksLayout,
  xAxisFormat,
  yLogScale,
  xAxisShowMinmax,
  yAxisShowMinmax,
  leftMargin,
  yAxisBounds,
} from '../NVD3Controls';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const transformPropsJs = require('../transformProps').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactNVD3 = require('../ReactNVD3').default;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NVD3Extra = Record<string, any>;

/**
 * @deprecated in version 4.0.
 */
export default defineChart<Record<string, never>, NVD3Extra>({
  metadata: {
    name: t('Bubble Chart (legacy)'),
    description: t(
      'Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.',
    ),
    category: t('Correlation'),
    credits: ['http://nvd3.org'],
    label: ChartLabel.Deprecated,
    tags: [
      t('Multi-Dimensions'),
      t('Comparison'),
      t('Legacy'),
      t('Scatter'),
      t('Time'),
      t('Trend'),
      t('nvd3'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
    useLegacyApi: true,
  },
  arguments: {},
  suppressQuerySection: true,
  prependSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['entity'],
        ['x'],
        ['y'],
        ['adhoc_filters'],
        ['size'],
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
        ['limit', null],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [['color_scheme'], [showLegend, null]],
    },
    {
      label: t('X Axis'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [xAxisLabel, leftMargin],
        [
          {
            name: xAxisFormat.name,
            config: {
              ...xAxisFormat.config,
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
            },
          },
          xTicksLayout,
        ],
        [
          {
            name: 'x_log_scale',
            config: {
              type: 'CheckboxControl',
              label: t('X Log Scale'),
              default: false,
              renderTrigger: true,
              description: t('Use a log scale for the X-axis'),
            },
          },
          xAxisShowMinmax,
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [yAxisLabel, bottomMargin],
        ['y_axis_format', null],
        [yLogScale, yAxisShowMinmax],
        [yAxisBounds],
      ],
    },
  ],
  additionalControlOverrides: {
    color_scheme: {
      renderTrigger: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    series: getStandardizedControls().shiftColumn(),
    entity: getStandardizedControls().shiftColumn(),
    x: getStandardizedControls().shiftMetric(),
    y: getStandardizedControls().shiftMetric(),
    size: getStandardizedControls().shiftMetric(),
  }),
  transform: chartProps => transformPropsJs(chartProps),
  render: props => <ReactNVD3 {...props} />,
});
