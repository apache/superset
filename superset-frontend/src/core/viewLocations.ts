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

/**
 * Every location at which extensions can contribute views.
 *
 * The nested shape mirrors the `contributions.views` block of an extension's
 * manifest, so a location in the manifest and the string the host renders with
 * are read off the same structure.
 *
 * @example
 * // In extension.json:
 * {
 *   "contributions": {
 *     "views": {
 *       "dashboard": {
 *         "sidebar": [{ "id": "my-ext.review", "name": "Review" }]
 *       }
 *     }
 *   }
 * }
 *
 * // In component code:
 * <ViewListExtension viewId={ViewLocations.dashboard.sidebar} />
 */
/**
 * The DOM id of the grid column a contributed panel docks in.
 *
 * A panel has to sit beside the asset, not above it, or its height pushes the
 * whole column down the page. Explore lays out an empty slot in its right-hand
 * column and the panel portals into it; the dashboard's extension sidebar
 * column carries the same id, so one lookup finds the right column on either
 * surface.
 */
export const DOCKED_PANEL_SLOT = 'superset-docked-panel-slot';

export const ViewLocations = {
  sqllab: {
    leftSidebar: 'sqllab.leftSidebar',
    rightSidebar: 'sqllab.rightSidebar',
    panels: 'sqllab.panels',
    editor: 'sqllab.editor',
    statusBar: 'sqllab.statusBar',
    results: 'sqllab.results',
    queryHistory: 'sqllab.queryHistory',
  },
  dashboard: {
    header: 'dashboard.header',
    headerActions: 'dashboard.headerActions',
    editActions: 'dashboard.editActions',
    panel: 'dashboard.panel',
    sidebar: 'dashboard.sidebar',
    chartActions: 'dashboard.chartActions',
    chartNameCell: 'dashboard.chartNameCell',
  },
  explore: {
    header: 'explore.header',
    panel: 'explore.panel',
  },
  listView: {
    chart: {
      nameCell: 'listView.chart.nameCell',
      actions: 'listView.chart.actions',
      deleteConfirmation: 'listView.chart.deleteConfirmation',
    },
    dashboard: {
      nameCell: 'listView.dashboard.nameCell',
      statusCell: 'listView.dashboard.statusCell',
      actions: 'listView.dashboard.actions',
      deleteConfirmation: 'listView.dashboard.deleteConfirmation',
    },
    dataset: {
      nameCell: 'listView.dataset.nameCell',
      actions: 'listView.dataset.actions',
      deleteConfirmation: 'listView.dataset.deleteConfirmation',
    },
  },
  navbar: {
    right: 'navbar.right',
  },
  home: {
    sectionPrimary: 'home.sectionPrimary',
    section: 'home.section',
  },
} as const;
