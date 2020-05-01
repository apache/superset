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

import { getChartControlPanelRegistry } from '@superset-ui/chart';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { t } from '@superset-ui/translation';

const fakePluginControls = {
  controlPanelSections: [
    {
      label: 'Fake Control Panel Sections',
      expanded: true,
      controlSetRows: [
        ['label_colors'],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: 'Value bounds',
              default: [null, null],
              description: 'Value bounds for the y axis',
            },
          },
        ],
        [
          {
            name: 'adhoc_filters',
            config: {
              type: 'AdhocFilterControl',
              label: 'Fake Filters',
              default: null,
            },
          },
        ],
      ],
    },
    {
      label: 'Fake Control Panel Sections 2',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'column_collection',
            config: {
              type: 'CollectionControl',
              label: 'Fake Collection Control',
            },
          },
        ],
      ],
    },
  ],
};

describe('getControlsForVizType', () => {
  beforeEach(() => {
    getChartControlPanelRegistry().registerValue(
      'chart_controls_inventory_fake',
      fakePluginControls,
    );
  });

  it('returns a map of the controls', () => {
    expect(
      JSON.stringify(getControlsForVizType('chart_controls_inventory_fake')),
    ).toEqual(
      JSON.stringify({
        label_colors: {
          type: 'ColorMapControl',
          label: t('Color Map'),
          default: {},
          renderTrigger: true,
          mapStateToProps: state => ({
            colorNamespace: state.form_data.color_namespace,
            colorScheme: state.form_data.color_scheme,
          }),
        },
        y_axis_bounds: {
          type: 'BoundsControl',
          label: 'Value bounds',
          default: [null, null],
          description: 'Value bounds for the y axis',
        },
        adhoc_filters: {
          type: 'AdhocFilterControl',
          label: 'Fake Filters',
          default: null,
        },
        column_collection: {
          type: 'CollectionControl',
          label: 'Fake Collection Control',
        },
      }),
    );
  });
});
