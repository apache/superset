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

export default defineChart<Record<string, never>, NVD3Extra>({
  metadata: {
    name: t('Bullet Chart'),
    description: t(
      'Showcases the progress of a single metric against a given target. The higher the fill, the closer the metric is to the target.',
    ),
    category: t('KPI'),
    credits: ['http://nvd3.org'],
    tags: [t('Business'), t('Legacy'), t('Report'), t('nvd3')],
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
      controlSetRows: [['metric'], ['adhoc_filters']],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'ranges',
            config: {
              type: 'TextControl',
              label: t('Ranges'),
              default: '',
              description: t('Ranges to highlight with shading'),
            },
          },
          {
            name: 'range_labels',
            config: {
              type: 'TextControl',
              label: t('Range labels'),
              default: '',
              description: t('Labels for the ranges'),
            },
          },
        ],
        [
          {
            name: 'markers',
            config: {
              type: 'TextControl',
              label: t('Markers'),
              default: '',
              description: t('List of values to mark with triangles'),
            },
          },
          {
            name: 'marker_labels',
            config: {
              type: 'TextControl',
              label: t('Marker labels'),
              default: '',
              description: t('Labels for the markers'),
            },
          },
        ],
        [
          {
            name: 'marker_lines',
            config: {
              type: 'TextControl',
              label: t('Marker lines'),
              default: '',
              description: t('List of values to mark with lines'),
            },
          },
          {
            name: 'marker_line_labels',
            config: {
              type: 'TextControl',
              label: t('Marker line labels'),
              default: '',
              description: t('Labels for the marker lines'),
            },
          },
        ],
      ],
    },
  ],
  transform: chartProps => transformPropsJs(chartProps),
  render: props => <ReactNVD3 {...props} />,
});
