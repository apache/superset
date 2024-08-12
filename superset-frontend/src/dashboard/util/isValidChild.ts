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
  },

  [TABS_TYPE]: {
    [TAB_TYPE]: depthThree,
  },

  [TAB_TYPE]: {
    [CHART_TYPE]: depthFive,
    [DYNAMIC_TYPE]: depthFive,
    [MARKDOWN_TYPE]: depthFive,
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

  const maxParentDepth: number | undefined =
    parentMaxDepthLookup[parentType]?.[childType];

  return typeof maxParentDepth === 'number' && parentDepth <= maxParentDepth;
}
