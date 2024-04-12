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
export const LOG_ACTIONS_FORCE_REFRESH_CHART = 'force_refresh_chart';
export const LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS = 'change_explore_controls';
export const LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD = 'toggle_edit_dashboard';
export const LOG_ACTIONS_FORCE_REFRESH_DASHBOARD = 'force_refresh_dashboard';
export const LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD =
  'periodic_render_dashboard';
export const LOG_ACTIONS_EXPLORE_DASHBOARD_CHART = 'explore_dashboard_chart';
export const LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART =
  'export_csv_dashboard_chart';
export const LOG_ACTIONS_EXPORT_XLSX_DASHBOARD_CHART =
  'export_xlsx_dashboard_chart';
export const LOG_ACTIONS_CHANGE_DASHBOARD_FILTER = 'change_dashboard_filter';
export const LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION =
  'dataset_creation_empty_cancellation';
export const LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION =
  'dataset_creation_database_cancellation';
export const LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION =
  'dataset_creation_schema_cancellation';
export const LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION =
  'dataset_creation_table_cancellation';
export const LOG_ACTIONS_DATASET_CREATION_SUCCESS = 'dataset_creation_success';
export const LOG_ACTIONS_SPA_NAVIGATION = 'spa_navigation';
export const LOG_ACTIONS_CONFIRM_OVERWRITE_DASHBOARD_METADATA =
  'confirm_overwrite_dashboard_metadata';
export const LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE =
  'dashboard_download_as_image';
export const LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF =
  'dashboard_download_as_pdf';
export const LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE = 'chart_download_as_image';
export const LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV = 'chart_download_as_csv';
export const LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV_PIVOTED =
  'chart_download_as_csv_pivoted';
export const LOG_ACTIONS_CHART_DOWNLOAD_AS_XLS = 'chart_download_as_xls';
export const LOG_ACTIONS_CHART_DOWNLOAD_AS_JSON = 'chart_download_as_json';
export const LOG_ACTIONS_SQLLAB_WARN_LOCAL_STORAGE_USAGE =
  'sqllab_warn_local_storage_usage';
export const LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY =
  'sqllab_fetch_failed_query';
export const LOG_ACTIONS_DRILL_BY_MODAL_OPENED = 'drill_by_modal_opened';
export const LOG_ACTIONS_FURTHER_DRILL_BY = 'further_drill_by';
export const LOG_ACTIONS_DRILL_BY_EDIT_CHART = 'drill_by_edit_chart';
export const LOG_ACTIONS_DRILL_BY_BREADCRUMB_CLICKED =
  'drill_by_breadcrumb_clicked';
export const LOG_ACTIONS_SQLLAB_MONITOR_LOCAL_STORAGE_USAGE =
  'sqllab_monitor_local_storage_usage';

// Log event types --------------------------------------------------------------
export const LOG_EVENT_TYPE_TIMING = new Set([
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_RENDER_CHART,
  LOG_ACTIONS_HIDE_BROWSER_TAB,
  LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY,
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
  LOG_ACTIONS_MOUNT_EXPLORER,
  LOG_ACTIONS_CONFIRM_OVERWRITE_DASHBOARD_METADATA,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
  LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE,
]);

export const LOG_EVENT_DATASET_TYPE_DATASET_CREATION = [
  LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SUCCESS,
];

export const Logger = {
  timeOriginOffset: 0,

  markTimeOrigin() {
    this.timeOriginOffset = window.performance.now();
  },

  // note that this returns ms since last navigation, NOT ms since epoch
  getTimestamp() {
    return Math.round(window.performance.now() - this.timeOriginOffset);
  },
};
