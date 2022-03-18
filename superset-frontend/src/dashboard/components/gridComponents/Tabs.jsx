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
import React from 'react';
import PropTypes from 'prop-types';
import { styled, t } from '@superset-ui/core';
import { connect } from 'react-redux';
import { LineEditableTabs } from 'src/components/Tabs';
import { LOG_ACTIONS_SELECT_DASHBOARD_TAB } from 'src/logger/LogUtils';
import { AntdModal } from 'src/components';
import { FILTER_BOX_MIGRATION_STATES } from 'src/explore/constants';
import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import DashboardComponent from '../../containers/DashboardComponent';
import DeleteComponentButton from '../DeleteComponentButton';
import HoverMenu from '../menu/HoverMenu';
import findTabIndexByComponentId from '../../util/findTabIndexByComponentId';
import getDirectPathToTabIndex from '../../util/getDirectPathToTabIndex';
import getLeafComponentIdFromPath from '../../util/getLeafComponentIdFromPath';
import { componentShape } from '../../util/propShapes';
import { NEW_TAB_ID, DASHBOARD_ROOT_ID } from '../../util/constants';
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
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES,

  // actions (from DashboardComponent.jsx)
  logEvent: PropTypes.func.isRequired,
  setActiveTabs: PropTypes.func,

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
  directPathToChild: [],
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES.NOOP,
  setActiveTabs() {},
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

export class Tabs extends React.PureComponent {
  constructor(props) {
    super(props);
    const tabIndex = Math.max(
      0,
      findTabIndexByComponentId({
        currentComponent: props.component,
        directPathToChild: props.directPathToChild,
      }),
    );
    const { children: tabIds } = props.component;
    const activeKey = tabIds[tabIndex];

    this.state = {
      tabIndex,
      activeKey,
    };
    this.handleClickTab = this.handleClickTab.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDeleteTab = this.handleDeleteTab.bind(this);
    this.handleDropOnTab = this.handleDropOnTab.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
  }

  componentDidMount() {
    this.props.setActiveTabs(this.state.activeKey);
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.activeKey !== this.state.activeKey ||
      prevProps.filterboxMigrationState !== this.props.filterboxMigrationState
    ) {
      this.props.setActiveTabs(this.state.activeKey, prevState.activeKey);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const maxIndex = Math.max(0, nextProps.component.children.length - 1);
    const currTabsIds = this.props.component.children;
    const nextTabsIds = nextProps.component.children;

    if (this.state.tabIndex > maxIndex) {
      this.setState(() => ({ tabIndex: maxIndex }));
    }

    if (nextTabsIds.length) {
      const lastTabId = nextTabsIds[nextTabsIds.length - 1];
      // if a new tab is added focus on it immediately
      if (nextTabsIds.length > currTabsIds.length) {
        // a new tab's path may be empty, here also need to set tabIndex
        this.setState(() => ({
          activeKey: lastTabId,
          tabIndex: maxIndex,
        }));
      }
      // if a tab is removed focus on the first
      if (nextTabsIds.length < currTabsIds.length) {
        this.setState(() => ({ activeKey: nextTabsIds[0] }));
      }
    }

    if (nextProps.isComponentVisible) {
      const nextFocusComponent = getLeafComponentIdFromPath(
        nextProps.directPathToChild,
      );
      const currentFocusComponent = getLeafComponentIdFromPath(
        this.props.directPathToChild,
      );

      if (nextFocusComponent !== currentFocusComponent) {
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

  showDeleteConfirmModal = key => {
    const { component, deleteComponent } = this.props;
    AntdModal.confirm({
      title: t('Delete dashboard tab?'),
      content: (
        <span>
          Deleting a tab will remove all content within it. You may still
          reverse this action with the <b>undo</b> button (cmd + z) until you
          save your changes.
        </span>
      ),
      onOk: () => {
        deleteComponent(key, component.id);
        const tabIndex = component.children.indexOf(key);
        this.handleDeleteTab(tabIndex);
      },
      okType: 'danger',
      okText: 'DELETE',
      cancelText: 'CANCEL',
      icon: null,
    });
  };

  handleEdit = (key, action) => {
    const { component, createComponent } = this.props;
    if (action === 'add') {
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
      this.showDeleteConfirmModal(key);
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
    this.handleClickTab(Math.max(0, tabIndex - 1));
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
    const { tabIndex: selectedTabIndex, activeKey } = this.state;

    let tabsToHighlight;
    if (nativeFilters?.focusedFilterId) {
      tabsToHighlight =
        nativeFilters.filters[nativeFilters.focusedFilterId].tabsInScope;
    }
    return (
      <DragDroppable
        component={tabsComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={this.handleDrop}
        editMode={editMode}
      >
        {({
          dropIndicatorProps: tabsDropIndicatorProps,
          dragSourceRef: tabsDragSourceRef,
        }) => (
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
                    <DashboardComponent
                      id={tabId}
                      parentId={tabsComponent.id}
                      depth={depth}
                      index={tabIndex}
                      renderType={RENDER_TAB}
                      availableColumnCount={availableColumnCount}
                      columnWidth={columnWidth}
                      onDropOnTab={this.handleDropOnTab}
                      isFocused={activeKey === tabId}
                      isHighlighted={
                        activeKey !== tabId && tabsToHighlight?.includes(tabId)
                      }
                    />
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

            {/* don't indicate that a drop on root is allowed when tabs already exist */}
            {tabsDropIndicatorProps &&
              parentComponent.id !== DASHBOARD_ROOT_ID && (
                <div {...tabsDropIndicatorProps} />
              )}
          </StyledTabsContainer>
        )}
      </DragDroppable>
    );
  }
}

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    nativeFilters: state.nativeFilters,
    directPathToChild: state.dashboardState.directPathToChild,
    filterboxMigrationState: state.dashboardState.filterboxMigrationState,
  };
}
export default connect(mapStateToProps)(Tabs);
