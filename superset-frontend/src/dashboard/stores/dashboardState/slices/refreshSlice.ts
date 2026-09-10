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
import type { DashboardStateStore } from '../types';

export interface RefreshSlice {
  isRefreshing: boolean;
  isFiltersRefreshing: boolean;
  setIsRefreshing: (isRefreshing: boolean) => void;
  setIsFiltersRefreshing: (isFiltersRefreshing: boolean) => void;
}

export const refreshInitialState = {
  isRefreshing: false,
  isFiltersRefreshing: false,
};

export const createRefreshSlice: StateCreator<
  DashboardStateStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  RefreshSlice
> = set => ({
  ...refreshInitialState,

  setIsRefreshing: (isRefreshing: boolean) =>
    set({ isRefreshing }, false, 'dashboardState/setIsRefreshing'),

  setIsFiltersRefreshing: (isFiltersRefreshing: boolean) =>
    set(
      { isFiltersRefreshing },
      false,
      'dashboardState/setIsFiltersRefreshing',
    ),
});
