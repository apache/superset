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
  DASHBOARD_INFO_UPDATED,
  SET_FILTER_BAR_ORIENTATION,
  SET_CROSS_FILTERS_ENABLED,
} from '../actions/dashboardInfo';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export default function dashboardStateReducer(state = {}, action) {
  switch (action.type) {
    case DASHBOARD_INFO_UPDATED:
      return {
        ...state,
        ...action.newInfo,
        // server-side compare last_modified_time in second level
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    case HYDRATE_DASHBOARD:
      return {
        ...state,
        ...action.data.dashboardInfo,
        // set async api call data
      };
    case SET_FILTER_BAR_ORIENTATION:
      return {
        ...state,
        filterBarOrientation: action.filterBarOrientation,
      };
    case SET_CROSS_FILTERS_ENABLED:
      return {
        ...state,
        crossFiltersEnabled: action.crossFiltersEnabled,
      };
    default:
      return state;
  }
}
