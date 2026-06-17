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
import { getStandardizedControls, sections } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import {
  xAxisLabel,
  yAxisLabel,
  bottomMargin,
  xTicksLayout,
  xAxisFormat,
  yLogScale,
  yAxisBounds,
  xAxisShowMinmax,
  yAxisShowMinmax,
  leftMargin,
  timeSeriesSection,
} from '../NVD3Controls';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const transformPropsJs = require('../transformProps').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactNVD3 = require('../ReactNVD3').default;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NVD3Extra = Record<string, any>;

export default defineChart<Record<string, never>, NVD3Extra>({
  metadata: {
    name: t('Time-series Percent Change'),
    description: t(
      'Visualizes many different time-series objects in a single chart. This chart is being deprecated and we recommend using the Time-series Chart instead.',
    ),
    category: t('Evolution'),
    credits: ['http://nvd3.org'],
    label: ChartLabel.Deprecated,
    tags: [
      t('Legacy'),
      t('Time'),
      t('nvd3'),
      t('Advanced-Analytics'),
      t('Comparison'),
      t('Line'),
      t('Percentages'),
      t('Predictive'),
      t('Trend'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
    useLegacyApi: true,
  },
  arguments: {},
  suppressQuerySection: true,
  prependSections: [
    sections.legacyTimeseriesTime,
    timeSeriesSection[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [['color_scheme']],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [xAxisLabel, bottomMargin],
        [xTicksLayout, xAxisFormat],
        [xAxisShowMinmax, null],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        [yAxisLabel, leftMargin],
        [yAxisShowMinmax, yLogScale],
        ['y_axis_format', yAxisBounds],
      ],
    },
    timeSeriesSection[1],
    sections.annotations,
  ],
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metrics: getStandardizedControls().popAllMetrics(),
  }),
  transform: chartProps => transformPropsJs(chartProps),
  render: props => <ReactNVD3 {...props} />,
});
