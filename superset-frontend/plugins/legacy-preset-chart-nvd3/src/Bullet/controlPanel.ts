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
import { t } from '@superset-ui/core';
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
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
};

export default config;
