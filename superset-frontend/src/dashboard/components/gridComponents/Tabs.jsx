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
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import PropTypes from 'prop-types';
import { styled, t, usePrevious } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { LineEditableTabs } from 'src/components/Tabs';
import Icons from 'src/components/Icons';
import { LOG_ACTIONS_SELECT_DASHBOARD_TAB } from 'src/logger/LogUtils';
import Modal from 'src/components/Modal';
import { DROP_LEFT, DROP_RIGHT } from 'src/dashboard/util/getDropPosition';
import { Draggable } from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import DashboardComponent from '../../containers/DashboardComponent';
import DeleteComponentButton from '../DeleteComponentButton';
import HoverMenu from '../menu/HoverMenu';
import findTabIndexByComponentId from '../../util/findTabIndexByComponentId';
import getDirectPathToTabIndex from '../../util/getDirectPathToTabIndex';
import getLeafComponentIdFromPath from '../../util/getLeafComponentIdFromPath';
import { componentShape } from '../../util/propShapes';
import { NEW_TAB_ID } from '../../util/constants';
import { RENDER_TAB, RENDER_TAB_CONTENT } from './Tab';
import { TABS_TYPE, TAB_TYPE } from '../../util/componentTypes';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  renderTabContent: PropTypes.bool, // whether to render tabs + content or just tabs
  editMode: PropTypes.bool.isRequired,
  renderHoverMenu: PropTypes.bool,
  activeTabs: PropTypes.arrayOf(PropTypes.string),

  // actions (from DashboardComponent.jsx)
  logEvent: PropTypes.func.isRequired,
  setActiveTab: PropTypes.func,

  // grid related
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,

  // dnd
  createComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  onChangeTab: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {
  setActiveTab() {},
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
};

const StyledTabsContainer = styled.div`
  width: 100%;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};

  .dashboard-component-tabs-content {
    min-height: ${({ theme }) => theme.gridUnit * 12}px;
    margin-top: ${({ theme }) => theme.gridUnit / 4}px;
    position: relative;
  }

  .ant-tabs {
    overflow: visible;

    .ant-tabs-nav-wrap {
      min-height: ${({ theme }) => theme.gridUnit * 12.5}px;
    }

    .ant-tabs-content-holder {
      overflow: visible;
    }
  }

  div .ant-tabs-tab-btn {
    text-transform: none;
  }
`;

const StyledCancelXIcon = styled(Icons.CancelX)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const DropIndicator = styled.div`
  border: 2px solid ${({ theme }) => theme.colors.primary.base};
  width: 5px;
  height: 100%;
  position: absolute;
  top: 0;
  ${({ pos }) => (pos === 'left' ? 'left: -4px' : 'right: -4px')};
  border-radius: 2px;
`;

const CloseIconWithDropIndicator = props => (
  <>
    <StyledCancelXIcon />
    {props.showDropIndicators.right && (
      <DropIndicator className="drop-indicator-right" pos="right" />
    )}
  </>
);

const Tabs = props => {
  const nativeFilters = useSelector(state => state.nativeFilters);
  const activeTabs = useSelector(state => state.dashboardState.activeTabs);
  const directPathToChild = useSelector(
    state => state.dashboardState.directPathToChild,
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

  const [activeKey, setActiveKey] = useState(initActiveKey);
  const [selectedTabIndex, setSelectedTabIndex] = useState(initTabIndex);
  const [dropPosition, setDropPosition] = useState(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState(null);
  const [draggingTabId, setDraggingTabId] = useState(null);
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
    tabIndex => {
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
      }
      setActiveKey(tabIds[tabIndex]);
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
    dropResult => {
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
    dropResult => {
      if (dropResult.dragging.type !== TABS_TYPE) {
        props.handleComponentDrop(dropResult);
      }
    },
    [props.handleComponentDrop],
  );

  const handleDeleteTab = useCallback(
    tabIndex => {
      // If we're removing the currently selected tab,
      // select the previous one (if any)
      if (selectedTabIndex === tabIndex) {
        handleClickTab(Math.max(0, tabIndex - 1));
      }
    },
    [selectedTabIndex, handleClickTab],
  );

  const showDeleteConfirmModal = useCallback(
    key => {
      const { component, deleteComponent } = props;
      Modal.confirm({
        title: t('Delete dashboard tab?'),
        content: (
          <span>
            {t(
              'Deleting a tab will remove all content within it and will deactivate any related alerts or reports. You may still ' +
                'reverse this action with the',
            )}{' '}
            <b>{t('undo')}</b>{' '}
            {t('button (cmd + z) until you save your changes.')}
          </span>
        ),
        onOk: () => {
          deleteComponent(key, component.id);
          const tabIndex = component.children.indexOf(key);
          handleDeleteTab(tabIndex);
        },
        okType: 'danger',
        okText: t('DELETE'),
        cancelText: t('CANCEL'),
        icon: null,
      });
    },
    [props.component, props.deleteComponent, handleDeleteTab],
  );

  const handleEdit = useCallback(
    (event, action) => {
      const { component, createComponent } = props;
      if (action === 'add') {
        // Prevent the tab container to be selected
        event?.stopPropagation?.();

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
        });
      } else if (action === 'remove') {
        showDeleteConfirmModal(event);
      }
    },
    [props.component, props.createComponent, showDeleteConfirmModal],
  );

  const handleDeleteComponent = useCallback(() => {
    const { deleteComponent, id, parentId } = props;
    deleteComponent(id, parentId);
  }, [props.deleteComponent, props.id, props.parentId]);

  const handleGetDropPosition = useCallback(dragObject => {
    const { dropIndicator, isDraggingOver, index } = dragObject;

    if (isDraggingOver) {
      setDropPosition(dropIndicator);
      setDragOverTabIndex(index);
    } else {
      setDropPosition(null);
    }
  }, []);

  const handleDragggingTab = useCallback(tabId => {
    if (tabId) {
      setDraggingTabId(tabId);
    } else {
      setDraggingTabId(null);
    }
  }, []);

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

  const showDropIndicators = useCallback(
    currentDropTabIndex =>
      currentDropTabIndex === dragOverTabIndex && {
        left: editMode && dropPosition === DROP_LEFT,
        right: editMode && dropPosition === DROP_RIGHT,
      },
    [dragOverTabIndex, dropPosition, editMode],
  );

  const removeDraggedTab = useCallback(
    tabID => draggingTabId === tabID,
    [draggingTabId],
  );

  let tabsToHighlight;
  const highlightedFilterId =
    nativeFilters?.focusedFilterId || nativeFilters?.hoveredFilterId;
  if (highlightedFilterId) {
    tabsToHighlight = nativeFilters.filters[highlightedFilterId]?.tabsInScope;
  }

  const renderChild = useCallback(
    ({ dragSourceRef: tabsDragSourceRef }) => (
      <StyledTabsContainer
        className="dashboard-component dashboard-component-tabs"
        data-test="dashboard-component-tabs"
      >
        {editMode && renderHoverMenu && (
          <HoverMenu innerRef={tabsDragSourceRef} position="left">
            <DragHandle position="left" />
            <DeleteComponentButton onDelete={handleDeleteComponent} />
          </HoverMenu>
        )}

        <LineEditableTabs
          id={tabsComponent.id}
          activeKey={activeKey}
          onChange={key => {
            handleClickTab(tabIds.indexOf(key));
          }}
          onEdit={handleEdit}
          data-test="nav-list"
          type={editMode ? 'editable-card' : 'card'}
        >
          {tabIds.map((tabId, tabIndex) => (
            <LineEditableTabs.TabPane
              key={tabId}
              tab={
                removeDraggedTab(tabId) ? (
                  <></>
                ) : (
                  <>
                    {showDropIndicators(tabIndex).left && (
                      <DropIndicator
                        className="drop-indicator-left"
                        pos="left"
                      />
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
                      onDragTab={handleDragggingTab}
                      onHoverTab={() => handleClickTab(tabIndex)}
                      isFocused={activeKey === tabId}
                      isHighlighted={
                        activeKey !== tabId && tabsToHighlight?.includes(tabId)
                      }
                    />
                  </>
                )
              }
              closeIcon={
                removeDraggedTab(tabId) ? (
                  <></>
                ) : (
                  <CloseIconWithDropIndicator
                    role="button"
                    tabIndex={tabIndex}
                    showDropIndicators={showDropIndicators(tabIndex)}
                  />
                )
              }
            >
              {renderTabContent && (
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
              )}
            </LineEditableTabs.TabPane>
          ))}
        </LineEditableTabs>
      </StyledTabsContainer>
    ),
    [
      editMode,
      renderHoverMenu,
      handleDeleteComponent,
      tabsComponent.id,
      activeKey,
      handleEdit,
      tabIds,
      handleClickTab,
      removeDraggedTab,
      showDropIndicators,
      depth,
      availableColumnCount,
      columnWidth,
      handleDropOnTab,
      handleGetDropPosition,
      handleDragggingTab,
      tabsToHighlight,
      renderTabContent,
      onResizeStart,
      onResize,
      onResizeStop,
      selectedTabIndex,
      isCurrentTabVisible,
    ],
  );

  return (
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
  );
};

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;

export default memo(Tabs);
