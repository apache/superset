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
// Ids
export const DASHBOARD_GRID_ID = 'GRID_ID';
export const DASHBOARD_HEADER_ID = 'HEADER_ID';
export const DASHBOARD_ROOT_ID = 'ROOT_ID';
export const DASHBOARD_VERSION_KEY = 'DASHBOARD_VERSION_KEY';

export const NEW_COMPONENTS_SOURCE_ID = 'NEW_COMPONENTS_SOURCE_ID';
export const NEW_CHART_ID = 'NEW_CHART_ID';
export const NEW_COLUMN_ID = 'NEW_COLUMN_ID';
export const NEW_DIVIDER_ID = 'NEW_DIVIDER_ID';
export const NEW_HEADER_ID = 'NEW_HEADER_ID';
export const NEW_MARKDOWN_ID = 'NEW_MARKDOWN_ID';
export const NEW_ROW_ID = 'NEW_ROW_ID';
export const NEW_TAB_ID = 'NEW_TAB_ID';
export const NEW_TABS_ID = 'NEW_TABS_ID';

// grid constants
export const DASHBOARD_ROOT_DEPTH = 0;
export const GRID_BASE_UNIT = 8;
export const GRID_GUTTER_SIZE = 2 * GRID_BASE_UNIT;
export const GRID_COLUMN_COUNT = 12;
export const GRID_MIN_COLUMN_COUNT = 1;
export const GRID_MIN_ROW_UNITS = 5;
export const GRID_MAX_ROW_UNITS = 100;
export const GRID_MIN_ROW_HEIGHT = GRID_GUTTER_SIZE;
export const GRID_DEFAULT_CHART_WIDTH = 4;

// Header types
export const SMALL_HEADER = 'SMALL_HEADER';
export const MEDIUM_HEADER = 'MEDIUM_HEADER';
export const LARGE_HEADER = 'LARGE_HEADER';

// Style types
export const BACKGROUND_WHITE = 'BACKGROUND_WHITE';
export const BACKGROUND_TRANSPARENT = 'BACKGROUND_TRANSPARENT';

// undo-redo
export const UNDO_LIMIT = 50;

// save dash options
export const SAVE_TYPE_OVERWRITE = 'overwrite';
export const SAVE_TYPE_NEWDASHBOARD = 'newDashboard';

// default dashboard layout data size limit
// could be overwritten by server-side config
export const DASHBOARD_POSITION_DATA_LIMIT = 65535;

// in-component element types: can be added into
// directPathToChild, used for in dashboard navigation and focus
export const IN_COMPONENT_ELEMENT_TYPES = ['LABEL'];

// filter scope selector filter fields pane root id
export const ALL_FILTERS_ROOT = 'ALL_FILTERS_ROOT';

export enum DashboardStandaloneMode {
  NONE = 0,
  HIDE_NAV = 1,
  HIDE_NAV_AND_TITLE = 2,
  REPORT = 3,
}
