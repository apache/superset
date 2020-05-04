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
// Log event names ------------------------------------------------------------
export const LOG_ACTIONS_LOAD_CHART = 'load_chart';
export const LOG_ACTIONS_RENDER_CHART = 'render_chart';
export const LOG_ACTIONS_HIDE_BROWSER_TAB = 'hide_browser_tab';

export const LOG_ACTIONS_MOUNT_DASHBOARD = 'mount_dashboard';
export const LOG_ACTIONS_MOUNT_EXPLORER = 'mount_explorer';

export const LOG_ACTIONS_SELECT_DASHBOARD_TAB = 'select_dashboard_tab';
export const LOG_ACTIONS_RENDER_CHART_CONTAINER = 'render_chart_container';
export const LOG_ACTIONS_FORCE_REFRESH_CHART = 'force_refresh_chart';
export const LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS = 'change_explore_controls';
export const LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD = 'toggle_edit_dashboard';
export const LOG_ACTIONS_FORCE_REFRESH_DASHBOARD = 'force_refresh_dashboard';
export const LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD =
  'periodic_render_dashboard';
export const LOG_ACTIONS_EXPLORE_DASHBOARD_CHART = 'explore_dashboard_chart';
export const LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART =
  'export_csv_dashboard_chart';
export const LOG_ACTIONS_CHANGE_DASHBOARD_FILTER = 'change_dashboard_filter';
export const LOG_ACTIONS_OMNIBAR_TRIGGERED = 'omnibar_triggered';

// Log event types --------------------------------------------------------------
export const LOG_EVENT_TYPE_TIMING = new Set([
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_RENDER_CHART,
  LOG_ACTIONS_HIDE_BROWSER_TAB,
]);
export const LOG_EVENT_TYPE_USER = new Set([
  LOG_ACTIONS_MOUNT_DASHBOARD,
  LOG_ACTIONS_SELECT_DASHBOARD_TAB,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS,
  LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD,
  LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
  LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
  LOG_ACTIONS_OMNIBAR_TRIGGERED,
  LOG_ACTIONS_MOUNT_EXPLORER,
  LOG_ACTIONS_RENDER_CHART_CONTAINER,
]);

export const Logger = {
  // note that this returns ms since page load, NOT ms since epoc
  getTimestamp() {
    return Math.round(window.performance.now());
  },
};
