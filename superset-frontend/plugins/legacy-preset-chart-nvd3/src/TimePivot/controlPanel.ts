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
import {
  ControlPanelConfig,
  D3_FORMAT_OPTIONS,
  getStandardizedControls,
  sections,
} from '@superset-ui/chart-controls';
import {
  lineInterpolation,
  showLegend,
  xAxisLabel,
  bottomMargin,
  xAxisFormat,
  yLogScale,
  yAxisBounds,
  xAxisShowMinmax,
  yAxisShowMinmax,
  yAxisLabel,
  leftMargin,
} from '../NVD3Controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
        [
          {
            name: 'freq',
            config: {
              type: 'SelectControl',
              label: t('Frequency'),
              default: 'W-MON',
              freeForm: true,
              clearable: false,
              choices: [
                ['AS', 'Year (freq=AS)'],
                ['52W-MON', '52 weeks starting Monday (freq=52W-MON)'],
                ['W-SUN', '1 week starting Sunday (freq=W-SUN)'],
                ['W-MON', '1 week starting Monday (freq=W-MON)'],
                ['D', 'Day (freq=D)'],
                ['4W-MON', '4 weeks (freq=4W-MON)'],
              ],
              description: t(
                `The periodicity over which to pivot time. Users can provide
            "Pandas" offset alias.
            Click on the info bubble for more details on accepted "freq" expressions.`,
              ),
              tooltipOnClick: () => {
                window.open(
                  'https://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases',
                );
              },
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [showLegend],
        [lineInterpolation],
        ['color_picker', null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [xAxisLabel],
        [bottomMargin],
        [xAxisShowMinmax],
        [
          {
            name: xAxisFormat.name,
            config: {
              ...xAxisFormat.config,
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
            },
          },
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        [yAxisLabel],
        [leftMargin],
        [yAxisShowMinmax],
        [yLogScale],
        ['y_axis_format'],
        [yAxisBounds],
      ],
    },
  ],
  controlOverrides: {
    metric: {
      clearable: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric,
  }),
};

export default config;
