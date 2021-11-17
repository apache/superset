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
  yAxisLabel,
  bottomMargin,
  xTicksLayout,
  xAxisFormat,
  yLogScale,
  yAxisBounds,
  xAxisShowMinmax,
  yAxisShowMinmax,
  richTooltip,
  showBarValue,
  barStacked,
  reduceXTicks,
  leftMargin,
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
        ['color_scheme'],
        [showBrush],
        [showLegend],
        [showBarValue],
        [richTooltip],
        [barStacked],
        [lineInterpolation],
        [showControls],
        [bottomMargin],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [xAxisLabel],
        [bottomMargin],
        [xTicksLayout],
        [xAxisFormat],
        [xAxisShowMinmax],
        [reduceXTicks],
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
    timeSeriesSection[1],
    sections.annotations,
  ],
};

export default config;
