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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { styled, t } from '@superset-ui/core';
import { connect } from 'react-redux';
import { LineEditableTabs } from 'src/components/Tabs';
import Icons from 'src/components/Icons';
import { LOG_ACTIONS_SELECT_DASHBOARD_TAB } from 'src/logger/LogUtils';
import { AntdModal } from 'src/components';
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
  directPathToChild: PropTypes.arrayOf(PropTypes.string),
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
  renderTabContent: true,
  renderHoverMenu: true,
  availableColumnCount: 0,
  columnWidth: 0,
  activeTabs: [],
  directPathToChild: [],
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

export class Tabs extends PureComponent {
  constructor(props) {
    super(props);
    const { tabIndex, activeKey } = this.getTabInfo(props);

    this.state = {
      tabIndex,
      activeKey,
    };
    this.handleClickTab = this.handleClickTab.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDeleteTab = this.handleDeleteTab.bind(this);
    this.handleDropOnTab = this.handleDropOnTab.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    this.handleGetDropPosition = this.handleGetDropPosition.bind(this);
    this.handleDragggingTab = this.handleDragggingTab.bind(this);
  }

  componentDidMount() {
    this.props.setActiveTab(this.state.activeKey);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.activeKey !== this.state.activeKey) {
      this.props.setActiveTab(this.state.activeKey, prevState.activeKey);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const maxIndex = Math.max(0, nextProps.component.children.length - 1);
    const currTabsIds = this.props.component.children;
    const nextTabsIds = nextProps.component.children;

    if (this.state.tabIndex > maxIndex) {
      this.setState(() => ({ tabIndex: maxIndex }));
    }

    // reset tab index if dashboard was changed
    if (nextProps.dashboardId !== this.props.dashboardId) {
      const { tabIndex, activeKey } = this.getTabInfo(nextProps);
      this.setState(() => ({
        tabIndex,
        activeKey,
      }));
    }

    if (nextProps.isComponentVisible) {
      const nextFocusComponent = getLeafComponentIdFromPath(
        nextProps.directPathToChild,
      );
      const currentFocusComponent = getLeafComponentIdFromPath(
        this.props.directPathToChild,
      );

      // If the currently selected component is different than the new one,
      // or the tab length/order changed, calculate the new tab index and
      // replace it if it's different than the current one
      if (
        nextFocusComponent !== currentFocusComponent ||
        (nextFocusComponent === currentFocusComponent &&
          currTabsIds !== nextTabsIds)
      ) {
        const nextTabIndex = findTabIndexByComponentId({
          currentComponent: nextProps.component,
          directPathToChild: nextProps.directPathToChild,
        });

        // make sure nextFocusComponent is under this tabs component
        if (nextTabIndex > -1 && nextTabIndex !== this.state.tabIndex) {
          this.setState(() => ({
            tabIndex: nextTabIndex,
            activeKey: nextTabsIds[nextTabIndex],
          }));
        }
      }
    }
  }

  getTabInfo = props => {
    let tabIndex = Math.max(
      0,
      findTabIndexByComponentId({
        currentComponent: props.component,
        directPathToChild: props.directPathToChild,
      }),
    );
    if (tabIndex === 0 && props.activeTabs?.length) {
      props.component.children.forEach((tabId, index) => {
        if (tabIndex === 0 && props.activeTabs.includes(tabId)) {
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
  };

  showDeleteConfirmModal = key => {
    const { component, deleteComponent } = this.props;
    AntdModal.confirm({
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
        this.handleDeleteTab(tabIndex);
      },
      okType: 'danger',
      okText: t('DELETE'),
      cancelText: t('CANCEL'),
      icon: null,
    });
  };

  handleEdit = (event, action) => {
    const { component, createComponent } = this.props;
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
      this.showDeleteConfirmModal(event);
    }
  };

  handleClickTab(tabIndex) {
    const { component } = this.props;
    const { children: tabIds } = component;

    if (tabIndex !== this.state.tabIndex) {
      const pathToTabIndex = getDirectPathToTabIndex(component, tabIndex);
      const targetTabId = pathToTabIndex[pathToTabIndex.length - 1];
      this.props.logEvent(LOG_ACTIONS_SELECT_DASHBOARD_TAB, {
        target_id: targetTabId,
        index: tabIndex,
      });

      this.props.onChangeTab({ pathToTabIndex });
    }
    this.setState(() => ({ activeKey: tabIds[tabIndex] }));
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleDeleteTab(tabIndex) {
    // If we're removing the currently selected tab,
    // select the previous one (if any)
    if (this.state.tabIndex === tabIndex) {
      this.handleClickTab(Math.max(0, tabIndex - 1));
    }
  }

  handleGetDropPosition(dragObject) {
    const { dropIndicator, isDraggingOver, index } = dragObject;

    if (isDraggingOver) {
      this.setState(() => ({
        dropPosition: dropIndicator,
        dragOverTabIndex: index,
      }));
    } else {
      this.setState(() => ({ dropPosition: null }));
    }
  }

  handleDropOnTab(dropResult) {
    const { component } = this.props;

    // Ensure dropped tab is visible
    const { destination } = dropResult;
    if (destination) {
      const dropTabIndex =
        destination.id === component.id
          ? destination.index // dropped ON tabs
          : component.children.indexOf(destination.id); // dropped IN tab

      if (dropTabIndex > -1) {
        setTimeout(() => {
          this.handleClickTab(dropTabIndex);
        }, 30);
      }
    }
  }

  handleDrop(dropResult) {
    if (dropResult.dragging.type !== TABS_TYPE) {
      this.props.handleComponentDrop(dropResult);
    }
  }

  handleDragggingTab(tabId) {
    if (tabId) {
      this.setState(() => ({ draggingTabId: tabId }));
    } else {
      this.setState(() => ({ draggingTabId: null }));
    }
  }

  render() {
    const {
      depth,
      component: tabsComponent,
      parentComponent,
      index,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      renderTabContent,
      renderHoverMenu,
      isComponentVisible: isCurrentTabVisible,
      editMode,
      nativeFilters,
    } = this.props;

    const { children: tabIds } = tabsComponent;
    const {
      tabIndex: selectedTabIndex,
      activeKey,
      dropPosition,
      dragOverTabIndex,
    } = this.state;

    const showDropIndicators = currentDropTabIndex =>
      currentDropTabIndex === dragOverTabIndex && {
        left: editMode && dropPosition === DROP_LEFT,
        right: editMode && dropPosition === DROP_RIGHT,
      };

    const removeDraggedTab = tabID => this.state.draggingTabId === tabID;

    let tabsToHighlight;
    const highlightedFilterId =
      nativeFilters?.focusedFilterId || nativeFilters?.hoveredFilterId;
    if (highlightedFilterId) {
      tabsToHighlight = nativeFilters.filters[highlightedFilterId]?.tabsInScope;
    }
    return (
      <Draggable
        component={tabsComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={this.handleDrop}
        editMode={editMode}
      >
        {({ dragSourceRef: tabsDragSourceRef }) => (
          <StyledTabsContainer
            className="dashboard-component dashboard-component-tabs"
            data-test="dashboard-component-tabs"
          >
            {editMode && renderHoverMenu && (
              <HoverMenu innerRef={tabsDragSourceRef} position="left">
                <DragHandle position="left" />
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
              </HoverMenu>
            )}

            <LineEditableTabs
              id={tabsComponent.id}
              activeKey={activeKey}
              onChange={key => {
                this.handleClickTab(tabIds.indexOf(key));
              }}
              onEdit={this.handleEdit}
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
                          onDropOnTab={this.handleDropOnTab}
                          onDropPositionChange={this.handleGetDropPosition}
                          onDragTab={this.handleDragggingTab}
                          onHoverTab={() => this.handleClickTab(tabIndex)}
                          isFocused={activeKey === tabId}
                          isHighlighted={
                            activeKey !== tabId &&
                            tabsToHighlight?.includes(tabId)
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
                      onDropOnTab={this.handleDropOnTab}
                      isComponentVisible={
                        selectedTabIndex === tabIndex && isCurrentTabVisible
                      }
                    />
                  )}
                </LineEditableTabs.TabPane>
              ))}
            </LineEditableTabs>
          </StyledTabsContainer>
        )}
      </Draggable>
    );
  }
}

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    nativeFilters: state.nativeFilters,
    activeTabs: state.dashboardState.activeTabs,
    directPathToChild: state.dashboardState.directPathToChild,
  };
}

export default connect(mapStateToProps)(Tabs);
