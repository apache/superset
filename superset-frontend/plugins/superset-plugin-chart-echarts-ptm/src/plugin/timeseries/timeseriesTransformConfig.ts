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
import { ControlSetRow } from '@superset-ui/chart-controls';
import type { TransformConfig } from '../../shared/transformHelpers';

export const TIMESERIES_TRANSFORM_CONFIG: TransformConfig = {
  defaults: true,
  seriesType: true,
  dataZoom: true,
  colorPalette: true,
  pillFormat: false,
  userOverrides: true,
};

export const seriesTypeChoices: [string, string][] = [
  ['auto', t('Keep original')],
  ['line', t('Line')],
  ['bar', t('Bar')],
  ['smooth', t('Smooth line')],
  ['step', t('Step')],
];

export const timeseriesSeriesTypeControl: ControlSetRow = [
  {
    name: 'ptm_series_type',
    config: {
      type: 'SelectControl',
      label: t('PTM Series Type'),
      description: t(
        'Override the chart series type. "Keep original" uses the standard behavior.',
      ),
      default: 'auto',
      clearable: false,
      choices: seriesTypeChoices,
      renderTrigger: true,
    },
  },
];

export const zoomAxisChoices: [string, string][] = [
  ['x', t('X axis (horizontal)')],
  ['y', t('Y axis (vertical)')],
  ['both', t('Both')],
];

export const zoomSizeChoices: [string, string][] = [
  ['xs', t('Extra small')],
  ['sm', t('Small')],
];

export const timeseriesZoomControl: ControlSetRow = [
  {
    name: 'ptm_zoom_enabled',
    config: {
      type: 'CheckboxControl',
      label: t('Enable zoom'),
      default: true,
      renderTrigger: true,
    },
  },
  {
    name: 'ptm_zoom_axis',
    config: {
      type: 'SelectControl',
      label: t('Zoom axis'),
      default: 'x',
      clearable: false,
      choices: zoomAxisChoices,
      renderTrigger: true,
    },
  },
  {
    name: 'ptm_zoom_size',
    config: {
      type: 'SelectControl',
      label: t('Zoom size'),
      default: 'xs',
      clearable: false,
      choices: zoomSizeChoices,
      renderTrigger: true,
    },
  },
  {
    name: 'ptm_zoom_inset',
    config: {
      type: 'TextControl',
      label: t('Zoom inset (px)'),
      default: '24',
      isInt: true,
      renderTrigger: true,
      description: t('Adds padding inside the grid so the zoom bar does not span full width.'),
    },
  },
];

