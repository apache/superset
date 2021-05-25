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
import { sections } from '@superset-ui/chart-controls';
import { t, legacyValidateInteger, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  mapboxStyle,
  geojsonColumn,
} from '../../utilities/Shared_DeckGL';
import { dndGeojsonColumn } from '../../utilities/sharedDndControls';

const geojson = isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
  ? dndGeojsonColumn
  : geojsonColumn;

export default {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [[geojson], ['row_limit'], [filterNulls], ['adhoc_filters']],
    },
    {
      label: t('Map'),
      controlSetRows: [
        [mapboxStyle, viewport],
        // TODO [autozoom, null], // import { autozoom } from './Shared_DeckGL'
      ],
    },
    {
      label: t('GeoJson Settings'),
      controlSetRows: [
        [fillColorPicker, strokeColorPicker],
        [filled, stroked],
        [extruded, null],
        [
          {
            name: 'point_radius_scale',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Point Radius Scale'),
              validators: [legacyValidateInteger],
              default: null,
              choices: formatSelectOptions([0, 100, 200, 300, 500]),
            },
          },
          null,
        ],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [[jsColumns], [jsDataMutator], [jsTooltip], [jsOnclickHref]],
    },
  ],
};
