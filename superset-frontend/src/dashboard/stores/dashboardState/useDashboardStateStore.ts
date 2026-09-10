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
import type { DashboardStateStore } from './types';
import { createCoreSlice, coreInitialState } from './slices/coreSlice';
import {
  createNavigationSlice,
  navigationInitialState,
} from './slices/navigationSlice';
import { createRefreshSlice, refreshInitialState } from './slices/refreshSlice';
import {
  createMetadataSlice,
  metadataInitialState,
} from './slices/metadataSlice';
import {
  createAutoRefreshSlice,
  autoRefreshInitialState,
} from './slices/autoRefreshSlice';

export type { DashboardStateStore } from './types';

export const initialState = {
  ...coreInitialState,
  ...navigationInitialState,
  ...refreshInitialState,
  ...metadataInitialState,
  ...autoRefreshInitialState,
};

export const useDashboardStateStore = create<DashboardStateStore>()(
  devtools(
    subscribeWithSelector((...a) => ({
      ...createCoreSlice(...a),
      ...createNavigationSlice(...a),
      ...createRefreshSlice(...a),
      ...createMetadataSlice(...a),
      ...createAutoRefreshSlice(...a),
    })),
    {
      name: 'DashboardStateStore',
      enabled: process.env.WEBPACK_MODE === 'development',
    },
  ),
);
