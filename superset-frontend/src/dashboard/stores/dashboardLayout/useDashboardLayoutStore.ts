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
import { temporal } from 'zundo';
import type { DashboardLayout, LayoutItem } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import { withParentsUpdate, flagUnsavedChanges } from './helpers';
import {
  deleteComponentFromLayout,
  createComponentInLayout,
  moveComponentInLayout,
  createTopLevelTabsInLayout,
  deleteTopLevelTabsFromLayout,
  resizeComponentInLayout,
} from './operations';

interface DashboardLayoutState {
  layout: DashboardLayout;
}

interface DashboardLayoutActions {
  setLayout: (layout: DashboardLayout) => void;
  updateComponents: (nextComponents: DashboardLayout) => void;
  deleteComponent: (id: string, parentId: string | null) => void;
  createComponent: (dropResult: DropResult) => void;
  moveComponent: (dropResult: DropResult) => void;
  createTopLevelTabs: (dropResult: DropResult) => void;
  deleteTopLevelTabs: () => void;
  resizeComponent: (params: {
    id: string;
    width?: number;
    height?: number;
  }) => void;
  updateDashboardTitle: (text: string) => void;
}

type DashboardLayoutStore = DashboardLayoutState & DashboardLayoutActions;

export const useDashboardLayoutStore = create<DashboardLayoutStore>()(
  devtools(
    subscribeWithSelector(
      temporal(
        (set, get) => {
          // Each action delegates the tree transform to a pure function in
          // ./operations, then applies parent-list recompute + the unsaved flag.
          // A null result means "no change" — skip the set().
          const applyLayout = (
            next: DashboardLayout | null,
            actionName: string,
          ) => {
            if (!next) return;
            set(
              { layout: withParentsUpdate(next) },
              false,
              `dashboardLayout/${actionName}`,
            );
            flagUnsavedChanges();
          };

          return {
            layout: {},

            // setLayout seeds the layout (hydration); it does not flag unsaved changes.
            setLayout: (layout: DashboardLayout) =>
              set(
                { layout: withParentsUpdate({ ...layout }) },
                false,
                'dashboardLayout/setLayout',
              ),

            updateComponents: (nextComponents: DashboardLayout) =>
              applyLayout(
                { ...get().layout, ...nextComponents },
                'updateComponents',
              ),

            deleteComponent: (id: string, parentId: string | null) =>
              applyLayout(
                deleteComponentFromLayout(get().layout, id, parentId),
                'deleteComponent',
              ),

            createComponent: (dropResult: DropResult) =>
              applyLayout(
                createComponentInLayout(get().layout, dropResult),
                'createComponent',
              ),

            moveComponent: (dropResult: DropResult) =>
              applyLayout(
                moveComponentInLayout(get().layout, dropResult),
                'moveComponent',
              ),

            createTopLevelTabs: (dropResult: DropResult) =>
              applyLayout(
                createTopLevelTabsInLayout(get().layout, dropResult),
                'createTopLevelTabs',
              ),

            deleteTopLevelTabs: () =>
              applyLayout(
                deleteTopLevelTabsFromLayout(get().layout),
                'deleteTopLevelTabs',
              ),

            resizeComponent: (params: {
              id: string;
              width?: number;
              height?: number;
            }) =>
              applyLayout(
                resizeComponentInLayout(get().layout, params),
                'resizeComponent',
              ),

            updateDashboardTitle: (text: string) => {
              const state = get().layout;
              const header = state[DASHBOARD_HEADER_ID];
              applyLayout(
                {
                  ...state,
                  [DASHBOARD_HEADER_ID]: {
                    ...header,
                    meta: { ...header?.meta, text },
                  } as LayoutItem,
                },
                'updateDashboardTitle',
              );
            },
          };
        },
        {
          limit: 52, // UNDO_LIMIT (50) + 2 to match redux-undo behavior
          equality: (pastState, currentState) =>
            pastState.layout === currentState.layout,
        },
      ),
    ),
    {
      name: 'DashboardLayoutStore',
      enabled: process.env.WEBPACK_MODE === 'development',
    },
  ),
);
