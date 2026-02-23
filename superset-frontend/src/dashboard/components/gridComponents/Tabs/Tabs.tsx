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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  memo,
  ReactElement,
} from 'react';
import { usePrevious } from '@superset-ui/core';
import { t, useTheme, styled } from '@apache-superset/core/ui';
import { useSelector } from 'react-redux';
import { Icons } from '@superset-ui/core/components/Icons';
import { LOG_ACTIONS_SELECT_DASHBOARD_TAB } from 'src/logger/LogUtils';
import { Modal } from '@superset-ui/core/components';
import { DROP_LEFT, DROP_RIGHT } from 'src/dashboard/util/getDropPosition';
import { Draggable } from '../../dnd/DragDroppable';
import DashboardComponent from '../../../containers/DashboardComponent';
import findTabIndexByComponentId from '../../../util/findTabIndexByComponentId';
import getDirectPathToTabIndex from '../../../util/getDirectPathToTabIndex';
import getLeafComponentIdFromPath from '../../../util/getLeafComponentIdFromPath';
import { NEW_TAB_ID } from '../../../util/constants';
import { RENDER_TAB, RENDER_TAB_CONTENT } from '../Tab';
import { TABS_TYPE, TAB_TYPE } from '../../../util/componentTypes';
import TabsRenderer from '../TabsRenderer';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';

interface TabsProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  renderTabContent?: boolean;
  editMode: boolean;
  renderHoverMenu?: boolean;
  activeTabs?: string[];
  dashboardId?: number;
  isComponentVisible?: boolean;

  // actions (from DashboardComponent.jsx)
  logEvent: (eventName: string, payload: Record<string, unknown>) => void;
  setActiveTab: (activeKey: string, prevActiveKey?: string) => void;

  // grid related
  availableColumnCount?: number;
  columnWidth?: number;
  onResizeStart?: () => void;
  onResize?: () => void;
  onResizeStop?: () => void;

  // dnd
  createComponent: (dropResult: DropResult) => void;
  handleComponentDrop: (dropResult: DropResult) => void;
  onChangeTab: (params: { pathToTabIndex: string[] }) => void;
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: (components: Record<string, LayoutItem>) => void;
}

interface DropIndicatorProps {
  pos: 'left' | 'right';
}

const DropIndicator = styled.div<DropIndicatorProps>`
  border: 2px solid ${({ theme }) => theme.colorPrimary};
  width: 5px;
  height: 100%;
  position: absolute;
  top: 0;
  ${({ pos }) => (pos === 'left' ? 'left: -4px' : 'right: -4px')};
  border-radius: 2px;
`;

interface ShowDropIndicatorsResult {
  left: boolean;
  right: boolean;
}

interface CloseIconWithDropIndicatorProps {
  showDropIndicators: ShowDropIndicatorsResult;
  role?: string;
  tabIndex?: number;
}

const CloseIconWithDropIndicator = (
  props: CloseIconWithDropIndicatorProps,
): ReactElement => (
  <>
    <Icons.CloseOutlined iconSize="s" />
    {props.showDropIndicators.right && (
      <DropIndicator className="drop-indicator-right" pos="right" />
    )}
  </>
);

interface DraggableChildProps {
  dragSourceRef: React.RefObject<HTMLDivElement>;
}

const Tabs = (props: TabsProps): ReactElement => {
  const theme = useTheme();

  const nativeFilters = useSelector((state: RootState) => state.nativeFilters);
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const directPathToChild = useSelector(
    (state: RootState) => state.dashboardState.directPathToChild,
  );
  const nativeFiltersBarOpen = useSelector(
    (state: RootState) => state.dashboardState.nativeFiltersBarOpen ?? false,
  );

  const { tabIndex: initTabIndex, activeKey: initActiveKey } = useMemo(() => {
    let tabIndex = Math.max(
      0,
      findTabIndexByComponentId({
        currentComponent: props.component,
        directPathToChild,
      }),
    );
    if (tabIndex === 0 && activeTabs?.length) {
      props.component.children.forEach((tabId, index) => {
        if (tabIndex === 0 && activeTabs?.includes(tabId)) {
          tabIndex = index;
        }
      });
    }
    const { children: tabIds } = props.component;
    const activeKey = tabIds[tabIndex];

    return {
      tabIndex,
      activeKey,
    };
  }, [activeTabs, props.component, directPathToChild]);

  const [activeKey, setActiveKey] = useState<string>(initActiveKey);
  const [selectedTabIndex, setSelectedTabIndex] =
    useState<number>(initTabIndex);
  const [dropPosition, setDropPosition] = useState<string | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);
  const [tabToDelete, setTabToDelete] = useState<string | null>(null);
  const [isEditingTabTitle, setIsEditingTabTitle] = useState<boolean>(false);
  const prevActiveKey = usePrevious(activeKey);
  const prevDashboardId = usePrevious(props.dashboardId);
  const prevDirectPathToChild = usePrevious(directPathToChild);
  const prevTabIds = usePrevious(props.component.children);

  useEffect(() => {
    if (prevActiveKey) {
      props.setActiveTab(activeKey, prevActiveKey);
    } else {
      props.setActiveTab(activeKey);
    }
  }, [props.setActiveTab, prevActiveKey, activeKey]);

  useEffect(() => {
    if (prevDashboardId && props.dashboardId !== prevDashboardId) {
      setSelectedTabIndex(initTabIndex);
      setActiveKey(initActiveKey);
    }
  }, [props.dashboardId, prevDashboardId, initTabIndex, initActiveKey]);

  useEffect(() => {
    const maxIndex = Math.max(0, props.component.children.length - 1);
    if (selectedTabIndex > maxIndex) {
      setSelectedTabIndex(maxIndex);
    }
  }, [selectedTabIndex, props.component.children.length, setSelectedTabIndex]);

  useEffect(() => {
    const currTabsIds = props.component.children;

    if (props.isComponentVisible) {
      const nextFocusComponent = getLeafComponentIdFromPath(directPathToChild);
      const currentFocusComponent = getLeafComponentIdFromPath(
        prevDirectPathToChild,
      );

      // If the currently selected component is different than the new one,
      // or the tab length/order changed, calculate the new tab index and
      // replace it if it's different than the current one
      if (
        nextFocusComponent !== currentFocusComponent ||
        (nextFocusComponent === currentFocusComponent &&
          currTabsIds !== prevTabIds)
      ) {
        const nextTabIndex = findTabIndexByComponentId({
          currentComponent: props.component,
          directPathToChild,
        });

        // make sure nextFocusComponent is under this tabs component
        if (nextTabIndex > -1 && nextTabIndex !== selectedTabIndex) {
          setSelectedTabIndex(nextTabIndex);
          setActiveKey(currTabsIds[nextTabIndex]);
        }
      }
    }
  }, [
    props.component,
    directPathToChild,
    props.isComponentVisible,
    selectedTabIndex,
    prevDirectPathToChild,
    prevTabIds,
  ]);

  const handleClickTab = useCallback(
    (tabIndex: number) => {
      const { component } = props;
      const { children: tabIds } = component;

      if (tabIndex !== selectedTabIndex) {
        const pathToTabIndex = getDirectPathToTabIndex(component, tabIndex);
        const targetTabId = pathToTabIndex[pathToTabIndex.length - 1];
        props.logEvent(LOG_ACTIONS_SELECT_DASHBOARD_TAB, {
          target_id: targetTabId,
          index: tabIndex,
        });

        props.onChangeTab({ pathToTabIndex });
        setSelectedTabIndex(tabIndex);
      }
      // Always set activeKey to ensure it's synchronized
      if (tabIds[tabIndex]) {
        setActiveKey(tabIds[tabIndex]);
      }
    },
    [
      props.component,
      props.logEvent,
      props.onChangeTab,
      selectedTabIndex,
      setActiveKey,
    ],
  );

  const handleDropOnTab = useCallback(
    (dropResult: DropResult) => {
      const { component } = props;

      // Ensure dropped tab is visible
      const { destination } = dropResult;
      if (destination) {
        const dropTabIndex =
          destination.id === component.id
            ? destination.index // dropped ON tabs
            : component.children.indexOf(destination.id); // dropped IN tab

        if (dropTabIndex > -1) {
          setTimeout(() => {
            handleClickTab(dropTabIndex);
          }, 30);
        }
      }
    },
    [props.component, handleClickTab],
  );

  const handleDrop = useCallback(
    (dropResult: DropResult) => {
      if (dropResult.dragging.type !== TABS_TYPE) {
        props.handleComponentDrop(dropResult);
      }
    },
    [props.handleComponentDrop],
  );

  const handleDeleteTab = useCallback(
    (tabIndex: number) => {
      // If we're removing the currently selected tab,
      // select the previous one (if any)
      if (selectedTabIndex === tabIndex) {
        handleClickTab(Math.max(0, tabIndex - 1));
      }
    },
    [selectedTabIndex, handleClickTab],
  );

  const showDeleteConfirmModal = useCallback((key: string) => {
    setTabToDelete(key);
  }, []);

  const handleConfirmTabDelete = useCallback(() => {
    if (tabToDelete) {
      const { component, deleteComponent } = props;
      deleteComponent(tabToDelete, component.id);
      const tabIndex = component.children.indexOf(tabToDelete);
      handleDeleteTab(tabIndex);
      setTabToDelete(null);
    }
  }, [tabToDelete, props.component, props.deleteComponent, handleDeleteTab]);

  const handleCancelTabDelete = useCallback(() => {
    setTabToDelete(null);
  }, []);

  const handleEdit = useCallback(
    (
      event: string | React.MouseEvent | React.KeyboardEvent,
      action: string,
    ) => {
      const { component, createComponent } = props;
      if (action === 'add') {
        // Prevent the tab container to be selected
        if (typeof event !== 'string' && 'stopPropagation' in event) {
          event.stopPropagation();
        }

        createComponent({
          destination: {
            id: component.id,
            type: component.type,
            index: component.children.length,
          },
          dragging: {
            id: NEW_TAB_ID,
            type: TAB_TYPE,
          },
        } as DropResult);
      } else if (action === 'remove') {
        showDeleteConfirmModal(event as string);
      }
    },
    [props.component, props.createComponent, showDeleteConfirmModal],
  );

  const handleDeleteComponent = useCallback(() => {
    const { deleteComponent, id, parentId } = props;
    deleteComponent(id, parentId);
  }, [props.deleteComponent, props.id, props.parentId]);

  const handleGetDropPosition = useCallback(
    (dragObject: {
      dropIndicator: string | null;
      isDraggingOver: boolean;
      index: number;
    }) => {
      const { isDraggingOver, index } = dragObject;

      if (isDraggingOver) {
        setDropPosition(dragObject.dropIndicator);
        setDragOverTabIndex(index);
      } else {
        setDropPosition(null);
      }
    },
    [],
  );

  const handleTabTitleEditingChange = useCallback((isEditing: boolean) => {
    setIsEditingTabTitle(isEditing);
  }, []);

  const handleTabsReorder = useCallback(
    (oldIndex: number, newIndex: number) => {
      const { component, updateComponents } = props;
      const oldTabIds = component.children;
      const newTabIds = [...oldTabIds];
      const [removed] = newTabIds.splice(oldIndex, 1);
      newTabIds.splice(newIndex, 0, removed);

      const currentActiveTabId = oldTabIds[selectedTabIndex];
      const newActiveIndex = newTabIds.indexOf(currentActiveTabId);

      updateComponents({
        [component.id]: {
          ...component,
          children: newTabIds,
        },
      });

      // Update selected index to match the active tab's new position
      if (newActiveIndex !== -1 && newActiveIndex !== selectedTabIndex) {
        setSelectedTabIndex(newActiveIndex);
      }
      // Always update activeKey to ensure it stays synchronized after reorder
      if (newActiveIndex !== -1) {
        setActiveKey(currentActiveTabId);
      }
    },
    [props.component, props.updateComponents, selectedTabIndex, activeKey],
  );

  const {
    depth,
    component: tabsComponent,
    parentComponent,
    index,
    availableColumnCount = 0,
    columnWidth = 0,
    onResizeStart,
    onResize,
    onResizeStop,
    renderTabContent = true,
    renderHoverMenu = true,
    isComponentVisible: isCurrentTabVisible,
    editMode,
  } = props;

  const { children: tabIds } = tabsComponent;

  const tabBarPaddingLeft =
    renderTabContent === false
      ? nativeFiltersBarOpen
        ? 0
        : theme.sizeUnit * 4
      : 0;

  const showDropIndicators = useCallback(
    (currentDropTabIndex: number): ShowDropIndicatorsResult =>
      currentDropTabIndex === dragOverTabIndex
        ? {
            left: editMode && dropPosition === DROP_LEFT,
            right: editMode && dropPosition === DROP_RIGHT,
          }
        : { left: false, right: false },
    [dragOverTabIndex, dropPosition, editMode],
  );

  // Extract tab highlighting logic into a hook
  const useTabHighlighting = useCallback((): string[] | undefined => {
    const highlightedFilterId =
      nativeFilters?.focusedFilterId || nativeFilters?.hoveredFilterId;
    return highlightedFilterId
      ? nativeFilters.filters[highlightedFilterId]?.tabsInScope
      : undefined;
  }, [nativeFilters]);

  const tabsToHighlight = useTabHighlighting();

  // Extract tab items creation logic into a memoized value (not a hook inside hook)
  const tabItems = useMemo(
    () =>
      tabIds.map((tabId, tabIndex) => ({
        key: tabId,
        label: (
          <>
            {showDropIndicators(tabIndex).left && (
              <DropIndicator className="drop-indicator-left" pos="left" />
            )}
            <DashboardComponent
              id={tabId}
              parentId={tabsComponent.id}
              depth={depth}
              index={tabIndex}
              renderType={RENDER_TAB}
              availableColumnCount={availableColumnCount}
              columnWidth={columnWidth}
              onDropOnTab={handleDropOnTab}
              onDropPositionChange={handleGetDropPosition}
              onHoverTab={() => handleClickTab(tabIndex)}
              isFocused={activeKey === tabId}
              isHighlighted={
                activeKey !== tabId && tabsToHighlight?.includes(tabId)
              }
              onTabTitleEditingChange={handleTabTitleEditingChange}
            />
          </>
        ),
        closeIcon: (
          <CloseIconWithDropIndicator
            role="button"
            tabIndex={tabIndex}
            showDropIndicators={showDropIndicators(tabIndex)}
          />
        ),
        children: renderTabContent ? (
          <DashboardComponent
            id={tabId}
            parentId={tabsComponent.id}
            depth={depth} // see isValidChild.js for why tabs don't increment child depth
            index={tabIndex}
            renderType={RENDER_TAB_CONTENT}
            availableColumnCount={availableColumnCount}
            columnWidth={columnWidth}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
            onDropOnTab={handleDropOnTab}
            isComponentVisible={
              selectedTabIndex === tabIndex && isCurrentTabVisible
            }
          />
        ) : undefined,
      })),
    [
      tabIds,
      showDropIndicators,
      tabsComponent.id,
      depth,
      availableColumnCount,
      columnWidth,
      handleDropOnTab,
      handleGetDropPosition,
      handleClickTab,
      activeKey,
      tabsToHighlight,
      renderTabContent,
      onResizeStart,
      onResize,
      onResizeStop,
      selectedTabIndex,
      isCurrentTabVisible,
      handleTabTitleEditingChange,
    ],
  );

  const renderChild = useCallback(
    ({ dragSourceRef: tabsDragSourceRef }: DraggableChildProps) => (
      <TabsRenderer
        tabItems={tabItems}
        editMode={editMode}
        renderHoverMenu={renderHoverMenu}
        tabsDragSourceRef={tabsDragSourceRef}
        handleDeleteComponent={handleDeleteComponent}
        tabsComponent={tabsComponent}
        activeKey={activeKey}
        tabIds={tabIds}
        handleClickTab={handleClickTab}
        handleEdit={handleEdit}
        tabBarPaddingLeft={tabBarPaddingLeft}
        onTabsReorder={handleTabsReorder}
        isEditingTabTitle={isEditingTabTitle}
      />
    ),
    [
      tabItems,
      editMode,
      renderHoverMenu,
      handleDeleteComponent,
      tabsComponent,
      activeKey,
      tabIds,
      handleClickTab,
      handleEdit,
      tabBarPaddingLeft,
      handleTabsReorder,
      isEditingTabTitle,
    ],
  );

  return (
    <>
      <Draggable
        component={tabsComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleDrop}
        editMode={editMode}
      >
        {renderChild}
      </Draggable>
      {tabToDelete && (
        <Modal
          show={!!tabToDelete}
          onHide={handleCancelTabDelete}
          onHandledPrimaryAction={handleConfirmTabDelete}
          primaryButtonName={t('DELETE')}
          primaryButtonStyle="danger"
          title={t('Delete dashboard tab?')}
          centered
        >
          <span>
            {t(
              'Deleting a tab will remove all content within it and will deactivate any related alerts or reports. You may still ' +
                'reverse this action with the',
            )}{' '}
            <b>{t('undo')}</b>{' '}
            {t('button (cmd + z) until you save your changes.')}
          </span>
        </Modal>
      )}
    </>
  );
};

export default memo(Tabs);
