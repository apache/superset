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
import { ControlPanelConfig } from '@superset-ui/chart-controls';

// Control names match the legacy nvd3 bullet chart so saved charts keep
// working without a form-data migration.
const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metric'], ['groupby'], ['adhoc_filters']],
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
              renderTrigger: true,
              description: t(
                'Comma-separated numeric thresholds to shade as background ranges, e.g. 100,200,300',
              ),
            },
          },
          {
            name: 'range_labels',
            config: {
              type: 'TextControl',
              label: t('Range labels'),
              default: '',
              renderTrigger: true,
              description: t(
                'Comma-separated text labels, one per range value',
              ),
              visibility: ({ controls }) => Boolean(controls?.ranges?.value),
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
              renderTrigger: true,
              description: t(
                'Comma-separated numeric values to mark with triangles, e.g. 150,250',
              ),
            },
          },
          {
            name: 'marker_labels',
            config: {
              type: 'TextControl',
              label: t('Marker labels'),
              default: '',
              renderTrigger: true,
              description: t(
                'Comma-separated text labels, one per marker value',
              ),
              visibility: ({ controls }) => Boolean(controls?.markers?.value),
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
              renderTrigger: true,
              description: t(
                'Comma-separated numeric values to mark with vertical lines, e.g. 250',
              ),
            },
          },
          {
            name: 'marker_line_labels',
            config: {
              type: 'TextControl',
              label: t('Marker line labels'),
              default: '',
              renderTrigger: true,
              description: t(
                'Comma-separated text labels, one per marker line value',
              ),
              visibility: ({ controls }) =>
                Boolean(controls?.marker_lines?.value),
            },
          },
        ],
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show labels'),
              renderTrigger: true,
              default: false,
              description: t(
                'Print range and marker labels on the chart instead of showing tooltips on hover',
              ),
            },
          },
        ],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Show legend'),
              renderTrigger: true,
              default: false,
              description: t(
                'List every range, marker and marker line in a legend; clicking an entry toggles it on the chart',
              ),
            },
          },
        ],
        ['y_axis_format'],
      ],
    },
  ],
};

export default config;
