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

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { FilterBarOrientation } from 'src/dashboard/types';
import { isCrossFiltersEnabled } from 'src/dashboard/util/crossFilters';
import type { DashboardInfoStore } from './types';
import { createCoreSlice } from './slices/coreSlice';
import { createFilterSettingsSlice } from './slices/filterSettingsSlice';
import { createChartCustomizationSlice } from './slices/chartCustomizationSlice';

export type { DashboardInfoStore, DashboardInfoData } from './types';

export const useDashboardInfoStore = create<DashboardInfoStore>()(
  devtools(
    subscribeWithSelector((...a) => ({
      ...createCoreSlice(...a),
      ...createFilterSettingsSlice(...a),
      ...createChartCustomizationSlice(...a),
    })),
    {
      name: 'DashboardInfoStore',
      enabled: process.env.WEBPACK_MODE === 'development',
    },
  ),
);

/**
 * Derives the filter-bar orientation from metadata (the single source of
 * truth), defaulting to vertical when unset.
 */
export const selectFilterBarOrientation = (
  state: DashboardInfoStore,
): FilterBarOrientation =>
  state.dashboardInfo.metadata?.filter_bar_orientation ||
  FilterBarOrientation.Vertical;

/**
 * Derives whether cross-filtering is enabled from metadata (the single source
 * of truth), defaulting to enabled when unset.
 */
export const selectCrossFiltersEnabled = (state: DashboardInfoStore): boolean =>
  isCrossFiltersEnabled(state.dashboardInfo.metadata?.cross_filters_enabled);
