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
  xAxisFormat,
  yAxis2Format,
  showLegend,
  yAxisBounds,
  yAxisShowMinmax,
  yAxis2Bounds,
  yAxis2ShowMinmax,
} from '../NVD3Controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [['color_scheme'], [showLegend], [xAxisFormat]],
    },
    {
      label: t('Y Axis 1'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['y_axis_format'],
        [yAxisShowMinmax],
        [yAxisBounds],
      ],
    },
    {
      label: t('Y Axis 2'),
      expanded: true,
      controlSetRows: [
        ['metric_2'],
        [yAxis2Format],
        [yAxis2ShowMinmax],
        [yAxis2Bounds],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
    sections.annotations,
  ],
  controlOverrides: {
    metric: {
      label: t('Left Axis Metric'),
      description: t('Choose a metric for left axis'),
    },
    y_axis_format: {
      label: t('Left Axis Format'),
    },
  },
};

export default config;
