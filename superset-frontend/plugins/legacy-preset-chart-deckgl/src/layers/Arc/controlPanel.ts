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
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';
import { t, validateNonEmpty, legacyValidateInteger } from '@superset-ui/core';
import timeGrainSqlaAnimationOverrides, {
  columnChoices,
  PRIMARY_COLOR,
} from '../../utilities/controls';
import { formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  autozoom,
  dimension,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  legendFormat,
  legendPosition,
  viewport,
  mapboxStyle,
} from '../../utilities/Shared_DeckGL';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'start_spatial',
            config: {
              type: 'SpatialControl',
              label: t('Start Longitude & Latitude'),
              validators: [validateNonEmpty],
              description: t('Point to your spatial columns'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
          {
            name: 'end_spatial',
            config: {
              type: 'SpatialControl',
              label: t('End Longitude & Latitude'),
              validators: [validateNonEmpty],
              description: t('Point to your spatial columns'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
        ],
        ['row_limit', filterNulls],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        [mapboxStyle, viewport],
        [autozoom, null],
      ],
    },
    {
      label: t('Arc'),
      controlSetRows: [
        [
          'color_picker',
          {
            name: 'target_color_picker',
            config: {
              label: t('Target Color'),
              description: t('Color of the target location'),
              type: 'ColorPickerControl',
              default: PRIMARY_COLOR,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: dimension.name,
            config: {
              ...dimension.config,
              label: t('Categorical Color'),
              description: t(
                'Pick a dimension from which categorical colors are defined',
              ),
            },
          },
          'color_scheme',
        ],
        [
          {
            name: 'stroke_width',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Stroke Width'),
              validators: [legacyValidateInteger],
              default: null,
              renderTrigger: true,
              choices: formatSelectOptions([1, 2, 3, 4, 5]),
            },
          },
          legendPosition,
        ],
        [legendFormat, null],
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
    size: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};

export default config;
