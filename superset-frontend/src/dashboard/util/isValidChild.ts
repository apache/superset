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
/* eslint max-len: 0 */
/**
 * When determining if a component is a valid child of another component we must consider both
 *   - parent + child component types
 *   - component depth, or depth of nesting of container components
 *
 * We consider types because some components aren't containers (e.g. a heading) and we consider
 * depth to prevent infinite nesting of container components.
 *
 * The following example container nestings should be valid, which means that some containers
 * don't increase the (depth) of their children, namely tabs and tab:
 *   (a) root (0) > grid (1) >                         row (2) > column (3) > row (4) > non-container (5)
 *   (b) root (0) > grid (1) >    tabs (2) > tab (2) > row (2) > column (3) > row (4) > non-container (5)
 *   (c) root (0) > top-tab (1) >                      row (2) > column (3) > row (4) > non-container (5)
 *   (d) root (0) > top-tab (1) > tabs (2) > tab (2) > row (2) > column (3) > row (4) > non-container (5)
 */
import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
  DYNAMIC_TYPE,
  IKI_DYNAMIC_MARKDOWN_TYPE,
  IKI_TABLE_TYPE,
  IKI_PROCESS_BUILDER_TYPE,
  IKI_RUN_PIPELINE_TYPE,
  IKI_DEEPCAST_TYPE,
  IKI_EITL_ROW_TYPE,
  IKI_EITL_COLUMN_TYPE,
  IKI_MODEL_METRICS_TYPE,
  IKI_FORECAST_TYPE,
  IKI_EXTERNAL_DATASETS_TYPE,
  IKI_EXPLAINABILITY_TYPE,
  IKI_FORECAST_MODULE_TYPE,
  IKI_DATASET_DOWNLOAD_TYPE,
} from './componentTypes';

import { DASHBOARD_ROOT_DEPTH as rootDepth } from './constants';

const depthOne = rootDepth + 1;
// const depthTwo = rootDepth + 2; // Meantime no need
const depthThree = rootDepth + 3;
const depthFour = rootDepth + 4;
const depthFive = rootDepth + 5;

// when moving components around the depth of child is irrelevant, note these are parent depths
const parentMaxDepthLookup = {
  [DASHBOARD_ROOT_TYPE]: {
    [TABS_TYPE]: rootDepth,
    [DASHBOARD_GRID_TYPE]: rootDepth,
  },

  [DASHBOARD_GRID_TYPE]: {
    [CHART_TYPE]: depthOne,
    [DYNAMIC_TYPE]: depthOne,
    [MARKDOWN_TYPE]: depthOne,
    [IKI_DYNAMIC_MARKDOWN_TYPE]: depthOne,
    [IKI_TABLE_TYPE]: depthOne,
    [IKI_PROCESS_BUILDER_TYPE]: depthOne,
    [IKI_RUN_PIPELINE_TYPE]: depthOne,
    [IKI_DEEPCAST_TYPE]: depthOne,
    [IKI_EITL_ROW_TYPE]: depthOne,
    [IKI_EITL_COLUMN_TYPE]: depthOne,
    [IKI_MODEL_METRICS_TYPE]: depthOne,
    [IKI_FORECAST_TYPE]: depthOne,
    [IKI_FORECAST_MODULE_TYPE]: depthOne,
    [IKI_DATASET_DOWNLOAD_TYPE]: depthOne,
    [IKI_EXTERNAL_DATASETS_TYPE]: depthOne,
    [IKI_EXPLAINABILITY_TYPE]: depthOne,
    [COLUMN_TYPE]: depthOne,
    [DIVIDER_TYPE]: depthOne,
    [HEADER_TYPE]: depthOne,
    [ROW_TYPE]: depthOne,
    [TABS_TYPE]: depthOne,
  },

  [ROW_TYPE]: {
    [CHART_TYPE]: depthFour,
    [DYNAMIC_TYPE]: depthFour,
    [MARKDOWN_TYPE]: depthFour,
    [COLUMN_TYPE]: depthFour,
    [IKI_DEEPCAST_TYPE]: depthFour,
    [IKI_DYNAMIC_MARKDOWN_TYPE]: depthFour,
    [IKI_FORECAST_MODULE_TYPE]: depthFour,
    [IKI_DATASET_DOWNLOAD_TYPE]: depthFour,
    [IKI_EITL_ROW_TYPE]: depthFour,
    [IKI_EXPLAINABILITY_TYPE]: depthFour,
    [IKI_RUN_PIPELINE_TYPE]: depthFour,
    [IKI_FORECAST_TYPE]: depthFour,
    [IKI_EXTERNAL_DATASETS_TYPE]: depthFour,
  },

  [TABS_TYPE]: {
    [TAB_TYPE]: depthThree,
  },

  [TAB_TYPE]: {
    [CHART_TYPE]: depthFive,
    [DYNAMIC_TYPE]: depthFive,
    [MARKDOWN_TYPE]: depthFive,
    [IKI_DYNAMIC_MARKDOWN_TYPE]: depthFive,
    [IKI_TABLE_TYPE]: depthFive,
    [IKI_PROCESS_BUILDER_TYPE]: depthFive,
    [IKI_RUN_PIPELINE_TYPE]: depthFive,
    [IKI_DEEPCAST_TYPE]: depthFive,
    [IKI_EITL_ROW_TYPE]: depthFive,
    [IKI_EITL_COLUMN_TYPE]: depthFive,
    [IKI_MODEL_METRICS_TYPE]: depthFive,
    [IKI_DATASET_DOWNLOAD_TYPE]: depthFive,
    [IKI_FORECAST_TYPE]: depthFive,
    [IKI_FORECAST_MODULE_TYPE]: depthFive,
    [IKI_EXTERNAL_DATASETS_TYPE]: depthFive,
    [IKI_EXPLAINABILITY_TYPE]: depthFive,
    [COLUMN_TYPE]: depthThree,
    [DIVIDER_TYPE]: depthFive,
    [HEADER_TYPE]: depthFive,
    [ROW_TYPE]: depthThree,
    [TABS_TYPE]: depthThree,
  },

  [COLUMN_TYPE]: {
    [CHART_TYPE]: depthFive,
    [HEADER_TYPE]: depthFive,
    [MARKDOWN_TYPE]: depthFive,
    [IKI_DYNAMIC_MARKDOWN_TYPE]: depthFive,
    [IKI_TABLE_TYPE]: depthFive,
    [IKI_PROCESS_BUILDER_TYPE]: depthFive,
    [IKI_RUN_PIPELINE_TYPE]: depthFive,
    [IKI_DEEPCAST_TYPE]: depthFive,
    [IKI_EITL_ROW_TYPE]: depthFive,
    [IKI_EITL_COLUMN_TYPE]: depthFive,
    [IKI_MODEL_METRICS_TYPE]: depthFive,
    [IKI_DATASET_DOWNLOAD_TYPE]: depthFive,
    [IKI_FORECAST_TYPE]: depthFive,
    [IKI_FORECAST_MODULE_TYPE]: depthFive,
    [IKI_EXTERNAL_DATASETS_TYPE]: depthFive,
    [IKI_EXPLAINABILITY_TYPE]: depthFive,
    [ROW_TYPE]: depthThree,
    [DIVIDER_TYPE]: depthThree,
    [TABS_TYPE]: depthThree,
  },

  // these have no valid children
  [CHART_TYPE]: {},
  [DYNAMIC_TYPE]: {},
  [DIVIDER_TYPE]: {},
  [HEADER_TYPE]: {},
  [MARKDOWN_TYPE]: {},
  [IKI_DYNAMIC_MARKDOWN_TYPE]: {},
  [IKI_TABLE_TYPE]: {},
  [IKI_PROCESS_BUILDER_TYPE]: {},
  [IKI_RUN_PIPELINE_TYPE]: {},
  [IKI_DEEPCAST_TYPE]: {},
  [IKI_EITL_ROW_TYPE]: {},
  [IKI_EITL_COLUMN_TYPE]: {},
  [IKI_MODEL_METRICS_TYPE]: {},
  [IKI_DATASET_DOWNLOAD_TYPE]: {},
  [IKI_EXPLAINABILITY_TYPE]: {},
  [IKI_FORECAST_TYPE]: {},
  [IKI_FORECAST_MODULE_TYPE]: {},
  [IKI_EXTERNAL_DATASETS_TYPE]: {},
};

interface IsValidChildProps {
  parentType?: string;
  childType?: string;
  parentDepth?: unknown;
}

export default function isValidChild(child: IsValidChildProps): boolean {
  const { parentType, childType, parentDepth } = child;
  if (!parentType || !childType || typeof parentDepth !== 'number') {
    return false;
  }

  const maxParentDepth: number | undefined = (parentMaxDepthLookup[
    parentType
  ] || {})[childType];

  return typeof maxParentDepth === 'number' && parentDepth <= maxParentDepth;
}
