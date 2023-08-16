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
import {
  ControlPanelConfig,
  getStandardizedControls,
  sections,
} from '@superset-ui/chart-controls';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import timeGrainSqlaAnimationOverrides from '../../utilities/controls';
import { formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  legendFormat,
  legendPosition,
  lineColumn,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  pointRadiusFixed,
  multiplier,
  lineWidth,
  lineType,
  reverseLongLat,
  mapboxStyle,
} from '../../utilities/Shared_DeckGL';
import { dndLineColumn } from '../../utilities/sharedDndControls';

const lines = isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
  ? dndLineColumn
  : lineColumn;

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            ...lines,
            config: {
              ...lines.config,
              label: t('Polygon Column'),
            },
          },
        ],
        [
          {
            ...lineType,
            config: {
              ...lineType.config,
              label: t('Polygon Encoding'),
            },
          },
        ],
        ['adhoc_filters'],
        ['metric'],
        [
          {
            ...pointRadiusFixed,
            config: {
              ...pointRadiusFixed.config,
              label: t('Elevation'),
            },
          },
        ],
        ['row_limit'],
        [reverseLongLat],
        [filterNulls],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [[mapboxStyle], [viewport], [autozoom]],
    },
    {
      label: t('Polygon Settings'),
      expanded: true,
      controlSetRows: [
        [fillColorPicker, strokeColorPicker],
        [filled, stroked],
        [extruded],
        [multiplier],
        [lineWidth],
        [
          {
            name: 'line_width_unit',
            config: {
              type: 'SelectControl',
              label: t('Line width unit'),
              default: 'pixels',
              choices: [
                ['meters', t('meters')],
                ['pixels', t('pixels')],
              ],
              renderTrigger: true,
            },
          },
        ],
        ['linear_color_scheme'],
        [
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              label: t('Opacity'),
              default: 80,
              step: 1,
              min: 0,
              max: 100,
              renderTrigger: true,
              description: t('Opacity, expects values between 0 and 100'),
            },
          },
        ],
        [
          {
            name: 'num_buckets',
            config: {
              type: 'SelectControl',
              multi: false,
              freeForm: true,
              label: t('Number of buckets to group data'),
              default: 5,
              choices: formatSelectOptions([2, 3, 5, 10]),
              description: t('How many buckets should the data be grouped in.'),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'break_points',
            config: {
              type: 'SelectControl',
              multi: true,
              freeForm: true,
              label: t('Bucket break points'),
              choices: formatSelectOptions([]),
              description: t(
                'List of n+1 values for bucketing metric into n buckets.',
              ),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'table_filter',
            config: {
              type: 'CheckboxControl',
              label: t('Emit Filter Events'),
              renderTrigger: true,
              default: false,
              description: t('Whether to apply filter when items are clicked'),
            },
          },
        ],
        [
          {
            name: 'toggle_polygons',
            config: {
              type: 'CheckboxControl',
              label: t('Multiple filtering'),
              renderTrigger: true,
              default: true,
              description: t(
                'Allow sending multiple polygons as a filter event',
              ),
            },
          },
        ],
        [legendPosition],
        [legendFormat],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
  controlOverrides: {
    metric: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
