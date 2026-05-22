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
import { t } from '@apache-superset/core/translation';
import { ControlPanelSectionConfig } from '../types';

/**
 * Generic, reusable control panel section that lets the chart author define
 * an ordered drill-down hierarchy. When the user clicks a data point on a
 * dashboard chart, the host advances to the next level of this hierarchy by
 * swapping the dimension on the chart and adding a filter for the clicked
 * value. A breadcrumb above the chart lets the user step back up.
 *
 * The list is stored in form_data as `drilldown_hierarchy`: string[] where
 * each entry is a column name. The order matters — entry [0] is the first
 * level shown by the chart, [1] the level you reach after one click, etc.
 */
export const drilldownHierarchySection: ControlPanelSectionConfig = {
  label: t('Drill-down hierarchy'),
  expanded: false,
  controlSetRows: [
    [
      {
        name: 'drilldown_hierarchy',
        config: {
          type: 'SelectControl',
          label: t('Drill-down levels'),
          description: t(
            'Ordered list of columns to drill into when a user clicks ' +
              'a data point. The chart displays the first level initially. ' +
              'Each click drills to the next level, scoped to the clicked ' +
              'value. The order of selection defines the hierarchy.',
          ),
          multi: true,
          freeForm: false,
          default: [],
          // SelectControl with mapStateToProps providing choices from dataset columns
          mapStateToProps: (state: Record<string, any>) => ({
            choices:
              state.datasource && 'columns' in state.datasource
                ? (state.datasource.columns || []).map(
                    (c: Record<string, any>) => [
                      c.column_name,
                      c.verbose_name || c.column_name,
                    ],
                  )
                : [],
          }),
          // This control does not affect the base query; it only configures
          // what happens on click in the dashboard.
          renderTrigger: false,
        },
      },
    ],
  ],
};
