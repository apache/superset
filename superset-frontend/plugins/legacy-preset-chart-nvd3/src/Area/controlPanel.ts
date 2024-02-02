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
import {
  lineInterpolation,
  showBrush,
  showLegend,
  showControls,
  xAxisLabel,
  bottomMargin,
  xTicksLayout,
  xAxisFormat,
  yLogScale,
  yAxisBounds,
  xAxisShowMinmax,
  richTooltip,
  timeSeriesSection,
} from '../NVD3Controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    timeSeriesSection[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [showBrush, showLegend],
        [
          lineInterpolation,
          {
            name: 'stacked_style',
            config: {
              type: 'SelectControl',
              label: t('Stacked Style'),
              renderTrigger: true,
              choices: [
                ['stack', t('stack')],
                ['stream', t('stream')],
                ['expand', t('expand')],
              ],
              default: 'stack',
              description: '',
            },
          },
        ],
        ['color_scheme'],
        [richTooltip, showControls],
      ],
    },
    {
      label: t('X Axis'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        [xAxisLabel, bottomMargin],
        [xTicksLayout, xAxisFormat],
        [xAxisShowMinmax, null],
      ],
    },
    {
      label: t('Y Axis'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        ['y_axis_format', yAxisBounds],
        [yLogScale, null],
      ],
    },
    timeSeriesSection[1],
    sections.annotations,
  ],
};

export default config;
