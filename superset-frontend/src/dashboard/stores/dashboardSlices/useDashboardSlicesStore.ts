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
import type { Slice } from 'src/dashboard/types';

export interface DashboardSlicesStore {
  /** Slice metadata for charts on the dashboard, keyed by slice id. */
  slices: Record<number, Slice>;
  setSlices: (slices: Record<number, Slice>) => void;
  addSlice: (slice: Slice) => void;
}

export const useDashboardSlicesStore = create<DashboardSlicesStore>()(
  devtools(
    subscribeWithSelector(set => ({
      slices: {},
      setSlices: slices => set({ slices }, false, 'dashboardSlices/setSlices'),
      addSlice: slice =>
        set(
          state => ({
            slices: { ...state.slices, [slice.slice_id]: slice },
          }),
          false,
          'dashboardSlices/addSlice',
        ),
    })),
    {
      name: 'DashboardSlicesStore',
      enabled: process.env.WEBPACK_MODE === 'development',
    },
  ),
);
