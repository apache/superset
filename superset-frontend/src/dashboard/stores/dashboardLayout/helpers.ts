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

import type { DashboardLayout } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import updateComponentParentsList from 'src/dashboard/util/updateComponentParentsList';
import { useDashboardStateStore } from '../dashboardState';

/** Recomputes each component's `parents` list from the root before persisting. */
export function withParentsUpdate(layout: DashboardLayout): DashboardLayout {
  if (layout[DASHBOARD_ROOT_ID]) {
    updateComponentParentsList({
      currentComponent: layout[DASHBOARD_ROOT_ID],
      layout,
    });
  }
  return layout;
}

/** Removes a component and its descendants, detaching it from its parent. */
export function recursivelyDeleteChildren(
  componentId: string,
  componentParentId: string,
  nextComponents: DashboardLayout,
): void {
  const component = nextComponents?.[componentId];
  if (!component) return;
  delete nextComponents[componentId];

  const { children = [] } = component;
  children?.forEach?.((childId: string) => {
    recursivelyDeleteChildren(childId, componentId, nextComponents);
  });

  const parent = nextComponents?.[componentParentId];
  if (Array.isArray(parent?.children)) {
    const componentIndex = parent.children.indexOf(componentId);
    if (componentIndex > -1) {
      const nextChildren = [...parent.children];
      nextChildren.splice(componentIndex, 1);
      nextComponents[componentParentId] = {
        ...parent,
        children: nextChildren,
      };
    }
  }
}

/** Flags the dashboard dirty after a layout mutation (cross-store side effect). */
export function flagUnsavedChanges(): void {
  useDashboardStateStore.getState().setHasUnsavedChanges(true);
}
