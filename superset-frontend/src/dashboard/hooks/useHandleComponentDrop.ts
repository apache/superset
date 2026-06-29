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
import { useCallback } from 'react';
import { useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { TABS_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import dropOverflowsParent from 'src/dashboard/util/dropOverflowsParent';
import findParentId from 'src/dashboard/util/findParentId';
import isInDifferentFilterScopes from 'src/dashboard/util/isInDifferentFilterScopes';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { useDashboardLayoutStore } from 'src/dashboard/stores';

// Routes a drag-drop to the right layout-store mutation and emits warnings.
// Replaces the Redux handleComponentDrop thunk.
export function useHandleComponentDrop() {
  const { addWarningToast } = useToasts();
  // Still react-redux: dashboardFilters (legacy filter-box state) is intentionally
  // not migrated off Redux, so it's read from the context-provided store here.
  const reduxStore = useStore<RootState>();

  return useCallback(
    (dropResult: DropResult): void => {
      const {
        createTopLevelTabs,
        createComponent,
        moveComponent,
        deleteComponent,
      } = useDashboardLayoutStore.getState();
      const layout = () => useDashboardLayoutStore.getState().layout;

      if (dropOverflowsParent(dropResult, layout())) {
        addWarningToast(
          t(
            `There is not enough space for this component. Try decreasing its width, or increasing the destination width.`,
          ),
        );
        return;
      }

      const { source, destination } = dropResult;
      const droppedOnRoot = destination && destination.id === DASHBOARD_ROOT_ID;
      const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
      const dashboardRoot = layout()[DASHBOARD_ROOT_ID];
      const rootChildId = dashboardRoot?.children
        ? dashboardRoot.children[0]
        : '';

      if (droppedOnRoot) {
        createTopLevelTabs(dropResult);
      } else if (destination && isNewComponent) {
        createComponent(dropResult);
      } else if (
        source.type === TABS_TYPE &&
        destination &&
        destination.type === TABS_TYPE &&
        source.id === rootChildId &&
        destination.id !== rootChildId
      ) {
        addWarningToast(t('Can not move top level tab into nested tabs'));
        return;
      } else if (
        destination &&
        source &&
        !(destination.id === source.id && destination.index === source.index)
      ) {
        moveComponent(dropResult);
      }

      // Re-read the layout after the mutation — Zustand getState is always
      // current, so this reflects the just-applied change.
      if (!isNewComponent) {
        const nextLayout = layout();
        const sourceComponent: Partial<LayoutItem> =
          nextLayout[source.id] || {};
        const destinationComponent: Partial<LayoutItem> =
          (destination && nextLayout[destination.id]) || {};

        // If a Tab/Row parent was emptied by the move, delete it.
        if (
          (sourceComponent.type === TABS_TYPE ||
            sourceComponent.type === ROW_TYPE) &&
          sourceComponent.children &&
          sourceComponent.children.length === 0
        ) {
          const parentId = findParentId({
            childId: source.id,
            layout: nextLayout,
          });
          deleteComponent(source.id, parentId);
        }

        if (
          destination &&
          isInDifferentFilterScopes({
            dashboardFilters: reduxStore.getState().dashboardFilters,
            source: (sourceComponent.parents || []).concat(source.id),
            destination: (destinationComponent.parents || []).concat(
              destination.id,
            ),
          })
        ) {
          addWarningToast(
            t('This chart has been moved to a different filter scope.'),
          );
        }
      }
    },
    [addWarningToast, reduxStore],
  );
}
