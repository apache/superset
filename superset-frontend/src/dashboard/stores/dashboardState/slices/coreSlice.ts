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

export interface CoreSlice {
  editMode: boolean;
  fullSizeChartId: number | null;
  isPublished: boolean | null;
  hasUnsavedChanges: boolean;
  sliceIds: number[];
  setEditMode: (editMode: boolean) => void;
  setFullSizeChartId: (chartId: number | null) => void;
  setIsPublished: (isPublished: boolean | null) => void;
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
  setSliceIds: (sliceIds: number[]) => void;
  addSliceId: (sliceId: number) => void;
  removeSliceId: (sliceId: number) => void;
}

export const coreInitialState = {
  editMode: false,
  fullSizeChartId: null,
  isPublished: null,
  hasUnsavedChanges: false,
  sliceIds: [] as number[],
};

export const createCoreSlice: StateCreator<
  DashboardStateStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  CoreSlice
> = set => ({
  ...coreInitialState,

  setEditMode: (editMode: boolean) =>
    set({ editMode }, false, 'dashboardState/setEditMode'),

  setFullSizeChartId: (fullSizeChartId: number | null) =>
    set({ fullSizeChartId }, false, 'dashboardState/setFullSizeChartId'),

  setIsPublished: (isPublished: boolean | null) =>
    set({ isPublished }, false, 'dashboardState/setIsPublished'),

  setHasUnsavedChanges: (hasUnsavedChanges: boolean) =>
    set({ hasUnsavedChanges }, false, 'dashboardState/setHasUnsavedChanges'),

  setSliceIds: (sliceIds: number[]) =>
    set({ sliceIds }, false, 'dashboardState/setSliceIds'),

  addSliceId: (sliceId: number) =>
    set(
      // Dedup like upstream's Set-based ADD_SLICE: re-adding is a no-op.
      state =>
        state.sliceIds.includes(sliceId)
          ? state
          : { sliceIds: [...state.sliceIds, sliceId] },
      false,
      'dashboardState/addSliceId',
    ),

  removeSliceId: (sliceId: number) =>
    set(
      state => ({ sliceIds: state.sliceIds.filter(id => id !== sliceId) }),
      false,
      'dashboardState/removeSliceId',
    ),
});
