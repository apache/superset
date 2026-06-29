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

import type { StateCreator } from 'zustand';
import { FilterBarOrientation } from 'src/dashboard/types';
import type { DashboardInfoStore } from '../types';

export interface FilterSettingsSlice {
  setFilterBarOrientation: (orientation: FilterBarOrientation) => void;
  setCrossFiltersEnabled: (crossFiltersEnabled: boolean) => void;
}

// Write only `metadata` (the source the save PUT body spreads from); a
// denormalized copy would drift and silently revert these settings on save.
export const createFilterSettingsSlice: StateCreator<
  DashboardInfoStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  FilterSettingsSlice
> = set => ({
  setFilterBarOrientation: orientation =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          metadata: {
            ...state.dashboardInfo.metadata,
            filter_bar_orientation: orientation,
          },
        },
      }),
      false,
      'dashboardInfo/setFilterBarOrientation',
    ),

  setCrossFiltersEnabled: crossFiltersEnabled =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          metadata: {
            ...state.dashboardInfo.metadata,
            cross_filters_enabled: crossFiltersEnabled,
          },
        },
      }),
      false,
      'dashboardInfo/setCrossFiltersEnabled',
    ),
});
