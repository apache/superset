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
import { DASHBOARD_ROOT_TYPE, DASHBOARD_GRID_TYPE } from './componentTypes';

import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_VERSION_KEY,
} from './constants';

export default function getEmptyLayout() {
  return {
    [DASHBOARD_VERSION_KEY]: 'v2',
    [DASHBOARD_ROOT_ID]: {
      type: DASHBOARD_ROOT_TYPE,
      id: DASHBOARD_ROOT_ID,
      children: [DASHBOARD_GRID_ID],
    },
    [DASHBOARD_GRID_ID]: {
      type: DASHBOARD_GRID_TYPE,
      id: DASHBOARD_GRID_ID,
      children: [],
      parents: [DASHBOARD_ROOT_ID],
    },
  };
}
