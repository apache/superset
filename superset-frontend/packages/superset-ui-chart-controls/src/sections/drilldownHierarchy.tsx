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
import { dndGroupByControl } from '../shared-controls/dndControls';

/**
 * Generic, reusable control panel section that lets the chart author define
 * an ordered drill-down hierarchy. When the user clicks a data point on a
 * dashboard chart, the host advances to the next level of this hierarchy by
 * swapping the chart's dimension and adding a filter for the clicked value.
 * A breadcrumb above the chart lets the user step back up.
 *
 * The list is stored in form_data as `drilldown_hierarchy`: string[] where
 * each entry is a column name. Order matters — the chart's own x-axis (or
 * groupby) is the top level shown initially, and each entry is a level the
 * user reaches by clicking, in order. The x-axis column is prepended
 * automatically if it is not already listed.
 *
 * This control does NOT affect the base (undrilled) query — it only
 * configures what happens on click, so `x_axis` stays a single scalar column
 * for every existing chart.
 */
export const drilldownHierarchySection: ControlPanelSectionConfig = {
  label: t('Drill-down hierarchy'),
  expanded: false,
  controlSetRows: [
    [
      {
        name: 'drilldown_hierarchy',
        config: {
          // Reuse the drag-and-drop column selector used for "Dimensions"
          // so authors can reorder levels by dragging.
          ...dndGroupByControl,
          label: t('Drill-down levels'),
          description: t(
            'Ordered list of columns to drill into when a user clicks ' +
              "a data point. The chart's primary dimension is shown " +
              'initially. Each click drills to the next level, scoped to the ' +
              'clicked value. Drag rows to reorder levels.',
          ),
          default: [],
          // The drill levels must be plain column references (the drill logic
          // matches them by name), so disallow ad-hoc/custom SQL columns.
          freeForm: false,
          // Configures click behavior only and does not affect the base query,
          // so editing it re-renders without marking the chart stale.
          renderTrigger: true,
        },
      },
    ],
  ],
};
