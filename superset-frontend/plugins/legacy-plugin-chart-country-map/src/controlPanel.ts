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
import { t } from '@apache-superset/core';
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { countryOptions } from './countries';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'select_country',
            config: {
              type: 'SelectControl',
              label: t('Country'),
              default: null,
              choices: countryOptions,
              description: t('Which country to plot the map for?'),
              validators: [validateNonEmpty],
            },
          },
        ],
        ['entity'],
        ['metric'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Number format'),
              renderTrigger: true,
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
              description: D3_FORMAT_DOCS,
            },
          },
        ],
        ['linear_color_scheme'],
        [
          {
            name: 'customColorScale',
            config: {
              type: 'TextAreaControl',
              label: t('Custom Color Scale (by %)'),
              description: t(
                'Custom JSON configuration that overrides the linear color scheme color codes and thresholds.<br />Thresholds are defined in percentage, and color codes accept any valid CSS value.<br />Config must be a valid JSON excerpt.<br />Copy-paste and adapt following sample configuration to define your own thresholds and colors :<br />\n' +
                  '[<br />\n' +
                  '  { "percent": 0, "color": "white" },<br />\n' +
                  '  { "percent": 0.01, "color": "#A00000" },<br />\n' +
                  '  { "percent": 20, "color": "#E52B50" },<br />\n' +
                  '  { "percent": 35, "color": "#FFA500" },<br />\n' +
                  '  { "percent": 50, "color": "#FFFF99" },<br />\n' +
                  '  { "percent": 65, "color": "#9ACD32" },<br />\n' +
                  '  { "percent": 80, "color": "#3CB371" },<br />\n' +
                  '  { "percent": 99.99, "color": "#228B22" },<br />\n' +
                  '  { "percent": 100, "color": "black" }<br />\n' +
                  ']',
              ),
              default: ``,
              language: 'json',
              rows: 12,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'pickColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Color selector'),
              renderTrigger: false,
              dontRefreshOnChange: false,
              default: '#000000',
              description: t(
                'Pick a custom color and get its HEX code for use into the Custom Color Scale configuration.',
              ),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('ISO 3166-2 Codes'),
      description: t(
        'Column containing ISO 3166-2 codes of region/province/department in your table.',
      ),
    },
    metric: {
      label: t('Metric'),
      description: t('Metric to display bottom title'),
    },
    linear_color_scheme: {
      renderTrigger: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
