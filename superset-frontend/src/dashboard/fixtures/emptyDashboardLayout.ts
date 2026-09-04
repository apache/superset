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
import {
  DASHBOARD_GRID_TYPE,
  HEADER_TYPE,
  DASHBOARD_ROOT_TYPE,
} from '../util/componentTypes';

import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_GRID_ID,
} from '../util/constants';

import type { DashboardLayout, LayoutItemMeta } from '../types';

// Create minimal meta objects that satisfy the LayoutItemMeta type requirements
const rootMeta: LayoutItemMeta = {
  chartId: 0,
  height: 0,
  uuid: '',
  width: 0,
};

const gridMeta: LayoutItemMeta = {
  chartId: 0,
  height: 0,
  uuid: '',
  width: 0,
};

const headerMeta: LayoutItemMeta = {
  chartId: 0,
  height: 0,
  uuid: '',
  width: 0,
  text: 'New dashboard',
};

const emptyDashboardLayout: DashboardLayout = {
  [DASHBOARD_ROOT_ID]: {
    type: DASHBOARD_ROOT_TYPE,
    id: DASHBOARD_ROOT_ID,
    children: [DASHBOARD_GRID_ID],
    parents: [],
    meta: rootMeta,
  },

  [DASHBOARD_GRID_ID]: {
    type: DASHBOARD_GRID_TYPE,
    id: DASHBOARD_GRID_ID,
    children: [],
    parents: [DASHBOARD_ROOT_ID],
    meta: gridMeta,
  },

  [DASHBOARD_HEADER_ID]: {
    type: HEADER_TYPE,
    id: DASHBOARD_HEADER_ID,
    children: [],
    parents: [],
    meta: headerMeta,
  },
};

export default emptyDashboardLayout;
