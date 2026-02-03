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
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { t } from '@apache-superset/core/ui';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { addWarningToast } from 'src/components/MessageToasts/actions';
import { TABS_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
  DASHBOARD_HEADER_ID,
} from 'src/dashboard/util/constants';
import dropOverflowsParent from 'src/dashboard/util/dropOverflowsParent';
import findParentId from 'src/dashboard/util/findParentId';
import isInDifferentFilterScopes from 'src/dashboard/util/isInDifferentFilterScopes';
import { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import { LayoutItem, RootState } from '../types';
import { updateLayoutComponents } from './dashboardFilters';
import { setUnsavedChanges } from './dashboardState';

type GetState = () => RootState;
type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

// Component CRUD -------------------------------------------------------------
export const UPDATE_COMPONENTS = 'UPDATE_COMPONENTS';

interface UpdateComponentsAction {
  type: typeof UPDATE_COMPONENTS;
  payload: {
    nextComponents: Record<string, Partial<LayoutItem>>;
  };
}

interface DeleteComponentAction {
  type: typeof DELETE_COMPONENT;
  payload: {
    id: string;
    parentId: string | null;
  };
}

interface CreateComponentAction {
  type: typeof CREATE_COMPONENT;
  payload: {
    dropResult: DropResult;
  };
}

interface CreateTopLevelTabsAction {
  type: typeof CREATE_TOP_LEVEL_TABS;
  payload: {
    dropResult: DropResult;
  };
}

interface DeleteTopLevelTabsAction {
  type: typeof DELETE_TOP_LEVEL_TABS;
  payload: Record<string, never>;
}

interface MoveComponentAction {
  type: typeof MOVE_COMPONENT;
  payload: {
    dropResult: DropResult;
  };
}

interface DashboardTitleChangedAction {
  type: typeof DASHBOARD_TITLE_CHANGED;
  text: string;
}

type DashboardLayoutAction =
  | UpdateComponentsAction
  | DeleteComponentAction
  | CreateComponentAction
  | CreateTopLevelTabsAction
  | DeleteTopLevelTabsAction
  | MoveComponentAction
  | DashboardTitleChangedAction;

// this is a helper that takes an action as input and dispatches
// an additional setUnsavedChanges(true) action after the dispatch in the case
// that dashboardState.hasUnsavedChanges is false.
function setUnsavedChangesAfterAction<
  T extends (...args: Parameters<T>) => DashboardLayoutAction,
>(
  action: T,
): (
  ...args: Parameters<T>
) => (dispatch: AppDispatch, getState: GetState) => void {
  return (...args: Parameters<T>) =>
    (dispatch: AppDispatch, getState: GetState) => {
      const result = action(...args);
      dispatch(result);

      const { dashboardLayout, dashboardState } = getState();

      const isComponentLevelEvent =
        result.type === UPDATE_COMPONENTS &&
        (result as UpdateComponentsAction).payload?.nextComponents;
      // trigger dashboardFilters state update if dashboard layout is changed.
      if (!isComponentLevelEvent) {
        const components = dashboardLayout.present;
        dispatch(updateLayoutComponents(components));
      }

      if (!dashboardState.hasUnsavedChanges) {
        dispatch(setUnsavedChanges(true));
      }
    };
}

export const updateComponents = setUnsavedChangesAfterAction(
  (
    nextComponents: Record<string, Partial<LayoutItem>>,
  ): UpdateComponentsAction => ({
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents,
    },
  }),
);

export function updateDashboardTitle(
  text: string,
): (dispatch: AppDispatch, getState: GetState) => void {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout } = getState();
    dispatch(
      updateComponents({
        [DASHBOARD_HEADER_ID]: {
          ...dashboardLayout.present[DASHBOARD_HEADER_ID],
          meta: {
            ...dashboardLayout.present[DASHBOARD_HEADER_ID]?.meta,
            text,
          },
        },
      }),
    );
  };
}

export const DASHBOARD_TITLE_CHANGED = 'DASHBOARD_TITLE_CHANGED';

// call this one when it's not an undo-able action
export function dashboardTitleChanged(
  text: string,
): DashboardTitleChangedAction {
  return {
    type: DASHBOARD_TITLE_CHANGED,
    text,
  };
}

export const DELETE_COMPONENT = 'DELETE_COMPONENT';
export const deleteComponent = setUnsavedChangesAfterAction(
  (id: string, parentId: string | null): DeleteComponentAction => ({
    type: DELETE_COMPONENT,
    payload: {
      id,
      parentId,
    },
  }),
);

export const CREATE_COMPONENT = 'CREATE_COMPONENT';
export const createComponent = setUnsavedChangesAfterAction(
  (dropResult: DropResult): CreateComponentAction => ({
    type: CREATE_COMPONENT,
    payload: {
      dropResult,
    },
  }),
);

// Tabs -----------------------------------------------------------------------
export const CREATE_TOP_LEVEL_TABS = 'CREATE_TOP_LEVEL_TABS';
export const createTopLevelTabs = setUnsavedChangesAfterAction(
  (dropResult: DropResult): CreateTopLevelTabsAction => ({
    type: CREATE_TOP_LEVEL_TABS,
    payload: {
      dropResult,
    },
  }),
);

export const DELETE_TOP_LEVEL_TABS = 'DELETE_TOP_LEVEL_TABS';
export const deleteTopLevelTabs = setUnsavedChangesAfterAction(
  (): DeleteTopLevelTabsAction => ({
    type: DELETE_TOP_LEVEL_TABS,
    payload: {},
  }),
);

// Resize ---------------------------------------------------------------------
export const RESIZE_COMPONENT = 'RESIZE_COMPONENT';

interface ResizeComponentParams {
  id: string;
  width?: number;
  height?: number;
}

export function resizeComponent({
  id,
  width,
  height,
}: ResizeComponentParams): (dispatch: AppDispatch, getState: GetState) => void {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout: undoableLayout } = getState();
    const { present: dashboard } = undoableLayout;
    const component = dashboard[id];
    const widthChanged = width && component.meta.width !== width;
    const heightChanged = height && component.meta.height !== height;
    if (component && (widthChanged || heightChanged)) {
      // update the size of this component
      const updatedComponents: Record<string, Partial<LayoutItem>> = {
        [id]: {
          ...component,
          meta: {
            ...component.meta,
            width: width || component.meta.width,
            height: height || component.meta.height,
          },
        },
      };

      dispatch(updateComponents(updatedComponents));
    }
  };
}

// Drag and Drop --------------------------------------------------------------
export const MOVE_COMPONENT = 'MOVE_COMPONENT';
const moveComponent = setUnsavedChangesAfterAction(
  (dropResult: DropResult): MoveComponentAction => ({
    type: MOVE_COMPONENT,
    payload: {
      dropResult,
    },
  }),
);

export const HANDLE_COMPONENT_DROP = 'HANDLE_COMPONENT_DROP';
export function handleComponentDrop(dropResult: DropResult) {
  return (
    dispatch: AppDispatch,
    getState: GetState,
  ): null | AnyAction | void => {
    const overflowsParent = dropOverflowsParent(
      dropResult,
      getState().dashboardLayout.present,
    );

    if (overflowsParent) {
      return dispatch(
        addWarningToast(
          t(
            `There is not enough space for this component. Try decreasing its width, or increasing the destination width.`,
          ),
        ),
      );
    }

    const { source, destination } = dropResult;
    const droppedOnRoot = destination && destination.id === DASHBOARD_ROOT_ID;
    const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
    const dashboardRoot = getState().dashboardLayout.present[DASHBOARD_ROOT_ID];
    const rootChildId = dashboardRoot?.children
      ? dashboardRoot.children[0]
      : '';

    if (droppedOnRoot) {
      dispatch(createTopLevelTabs(dropResult));
    } else if (destination && isNewComponent) {
      dispatch(createComponent(dropResult));
    } else if (
      // Add additional allow-to-drop logic for tag/tags source.
      // We only allow
      // - top-level tab => top-level tab: rearrange top-level tab order
      // - nested tab => top-level tab: allow row tab become top-level tab
      // Dashboard does not allow top-level tab become nested tab, to avoid
      // nested tab inside nested tab.
      source.type === TABS_TYPE &&
      destination &&
      destination.type === TABS_TYPE &&
      source.id === rootChildId &&
      destination.id !== rootChildId
    ) {
      return dispatch(
        addWarningToast(t('Can not move top level tab into nested tabs')),
      );
    } else if (
      destination &&
      source &&
      !(
        // ensure it has moved
        (destination.id === source.id && destination.index === source.index)
      )
    ) {
      dispatch(moveComponent(dropResult));
    }

    // call getState() again down here in case redux state is stale after
    // previous dispatch(es)
    const { dashboardFilters, dashboardLayout: undoableLayout } = getState();

    // if we moved a child from a Tab or Row parent and it was the only child, delete the parent.
    if (!isNewComponent) {
      const { present: layout } = undoableLayout;
      const sourceComponent: Partial<LayoutItem> = layout[source.id] || {};
      const destinationComponent: Partial<LayoutItem> =
        (destination && layout[destination.id]) || {};
      if (
        (sourceComponent.type === TABS_TYPE ||
          sourceComponent.type === ROW_TYPE) &&
        sourceComponent.children &&
        sourceComponent.children.length === 0
      ) {
        const parentId = findParentId({
          childId: source.id,
          layout,
        });
        dispatch(deleteComponent(source.id, parentId));
      }

      // show warning if item has been moved between different scope
      if (
        destination &&
        isInDifferentFilterScopes({
          dashboardFilters,
          source: (sourceComponent.parents || []).concat(source.id),
          destination: (destinationComponent.parents || []).concat(
            destination.id,
          ),
        })
      ) {
        dispatch(
          addWarningToast(
            t('This chart has been moved to a different filter scope.'),
          ),
        );
      }
    }

    return null;
  };
}

export const clearDashboardHistory = (): AnyAction =>
  UndoActionCreators.clearHistory();

// Undo redo ------------------------------------------------------------------
export function undoLayoutAction(): (
  dispatch: AppDispatch,
  getState: GetState,
) => void {
  return (dispatch: AppDispatch, getState: GetState) => {
    dispatch(UndoActionCreators.undo());

    const { dashboardLayout, dashboardState } = getState();

    if (
      dashboardLayout.past.length === 0 &&
      !dashboardState.maxUndoHistoryExceeded &&
      !dashboardState.updatedColorScheme
    ) {
      dispatch(setUnsavedChanges(false));
    }
  };
}

export const redoLayoutAction = setUnsavedChangesAfterAction(
  UndoActionCreators.redo as () => DashboardLayoutAction,
);

// Update component parents list ----------------------------------------------
export const UPDATE_COMPONENTS_PARENTS_LIST = 'UPDATE_COMPONENTS_PARENTS_LIST';
