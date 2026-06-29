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

/**
 * Pure layout-tree transforms for the dashboard layout store. Each is a
 * `(layout, ...args) => nextLayout` function with no store/`set` access, so the
 * complex drag-and-drop reducer logic is testable in isolation. Returning `null`
 * means "no change" — the store action skips the `set()` in that case.
 * `withParentsUpdate` and the unsaved-changes flag are applied by the store
 * action, not here.
 */
import type { DashboardLayout } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import {
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';
import componentIsResizable from 'src/dashboard/util/componentIsResizable';
import findParentId from 'src/dashboard/util/findParentId';
import getComponentWidthFromDrop from 'src/dashboard/util/getComponentWidthFromDrop';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import newEntitiesFromDrop from 'src/dashboard/util/newEntitiesFromDrop';
import reorderItem from 'src/dashboard/util/dnd-reorder';
import shouldWrapChildInRow from 'src/dashboard/util/shouldWrapChildInRow';
import { recursivelyDeleteChildren } from './helpers';

/** Removes a component (and any emptied Row parent), or null if it can't apply. */
export function deleteComponentFromLayout(
  layout: DashboardLayout,
  id: string,
  parentId: string | null,
): DashboardLayout | null {
  if (!parentId || !id || !layout[id] || !layout[parentId]) return null;

  const nextComponents: DashboardLayout = { ...layout };
  recursivelyDeleteChildren(id, parentId, nextComponents);
  const nextParent = nextComponents[parentId];
  if (nextParent?.type === ROW_TYPE && nextParent?.children?.length === 0) {
    const grandparentId = findParentId({
      childId: parentId,
      layout: nextComponents,
    });
    if (grandparentId) {
      recursivelyDeleteChildren(parentId, grandparentId, nextComponents);
    }
  }
  return nextComponents;
}

/** Inserts newly created entities produced by a drop. */
export function createComponentInLayout(
  layout: DashboardLayout,
  dropResult: DropResult,
): DashboardLayout {
  const newEntities = newEntitiesFromDrop({
    dropResult,
    layout,
  }) as DashboardLayout;
  return { ...layout, ...newEntities };
}

/** Reorders/moves a component, wrapping it in a Row when required; null if a no-op. */
export function moveComponentInLayout(
  layout: DashboardLayout,
  dropResult: DropResult,
): DashboardLayout | null {
  const { source, destination, dragging, position } = dropResult;
  if (!source || !destination || !dragging) return null;

  const nextEntities = reorderItem({
    entitiesMap: layout,
    source,
    destination,
    position,
  }) as DashboardLayout;

  if (componentIsResizable(nextEntities[dragging.id])) {
    const nextWidth =
      getComponentWidthFromDrop({ dropResult, layout }) || undefined;
    const currentMeta = (nextEntities[dragging.id].meta || {}) as Record<
      string,
      unknown
    >;
    if (currentMeta.width !== nextWidth) {
      nextEntities[dragging.id] = {
        ...nextEntities[dragging.id],
        meta: {
          ...nextEntities[dragging.id].meta,
          width: nextWidth as number,
        },
      };
    }
  }

  const wrapInRow = shouldWrapChildInRow({
    parentType: destination.type,
    childType: dragging.type,
  });
  if (wrapInRow) {
    const destinationEntity = nextEntities[destination.id];
    const destinationChildren = destinationEntity.children;
    const newRow = newComponentFactory(ROW_TYPE);
    newRow.children = [destinationChildren[destination.index]];
    newRow.parents = (destinationEntity.parents || []).concat(destination.id);
    destinationChildren[destination.index] = newRow.id;
    nextEntities[newRow.id] = newRow as unknown as DashboardLayout[string];
  }

  return { ...layout, ...nextEntities };
}

/** Promotes the grid into top-level tabs (or folds an existing tabs drag in). */
export function createTopLevelTabsInLayout(
  layout: DashboardLayout,
  dropResult: DropResult,
): DashboardLayout {
  const { source, dragging } = dropResult;

  const rootComponent = layout[DASHBOARD_ROOT_ID];
  const topLevelId = rootComponent.children[0];
  const topLevelComponent = layout[topLevelId];

  if (source.id !== NEW_COMPONENTS_SOURCE_ID) {
    // component already exists
    const draggingTabs = layout[dragging.id];
    const draggingTabId = draggingTabs.children[0];
    const draggingTab = layout[draggingTabId];
    const childrenToMove = [...topLevelComponent.children].filter(
      id => id !== dragging.id,
    );
    return {
      ...layout,
      [DASHBOARD_ROOT_ID]: {
        ...rootComponent,
        children: [dragging.id],
      },
      [topLevelId]: { ...topLevelComponent, children: [] },
      [draggingTabId]: {
        ...draggingTab,
        children: [...draggingTab.children, ...childrenToMove],
      },
    };
  }

  const newEntities = newEntitiesFromDrop({
    dropResult,
    layout,
  }) as DashboardLayout;
  const newEntitiesArray = Object.values(newEntities);
  const tabComponent = newEntitiesArray.find(
    component => component.type === TAB_TYPE,
  );
  const tabsComponent = newEntitiesArray.find(
    component => component.type === TABS_TYPE,
  );
  if (tabComponent && tabsComponent) {
    tabComponent.children = [...topLevelComponent.children];
    newEntities[topLevelId] = {
      ...topLevelComponent,
      children: [],
    };
    newEntities[DASHBOARD_ROOT_ID] = {
      ...rootComponent,
      children: [tabsComponent.id],
    };
  }
  return { ...layout, ...newEntities };
}

/** Collapses top-level tabs back into the grid; null if there are none. */
export function deleteTopLevelTabsFromLayout(
  layout: DashboardLayout,
): DashboardLayout | null {
  const rootComponent = layout[DASHBOARD_ROOT_ID];
  const topLevelId = rootComponent.children[0];
  const topLevelTabs = layout[topLevelId];
  if (topLevelTabs.type !== TABS_TYPE) return null;

  let childrenToMove: string[] = [];
  const nextEntities: DashboardLayout = { ...layout };
  topLevelTabs.children.forEach((tabId: string) => {
    const tabComponent = layout[tabId];
    childrenToMove = [...childrenToMove, ...tabComponent.children];
    delete nextEntities[tabId];
  });
  delete nextEntities[topLevelId];
  nextEntities[DASHBOARD_ROOT_ID] = {
    ...rootComponent,
    children: [DASHBOARD_GRID_ID],
  };
  nextEntities[DASHBOARD_GRID_ID] = {
    ...layout[DASHBOARD_GRID_ID],
    children: childrenToMove,
  };
  return nextEntities;
}

/** Applies a width/height resize; null if the component is missing or unchanged. */
export function resizeComponentInLayout(
  layout: DashboardLayout,
  { id, width, height }: { id: string; width?: number; height?: number },
): DashboardLayout | null {
  const component = layout[id];
  if (!component) return null;
  const widthChanged = width && component.meta.width !== width;
  const heightChanged = height && component.meta.height !== height;
  if (!widthChanged && !heightChanged) return null;

  return {
    ...layout,
    [id]: {
      ...component,
      meta: {
        ...component.meta,
        width: width || component.meta.width,
        height: height || component.meta.height,
      },
    },
  };
}
