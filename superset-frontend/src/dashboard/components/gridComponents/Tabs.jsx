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
import { Tabs as BootstrapTabs, Tab as BootstrapTab } from 'react-bootstrap';

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
import { TAB_TYPE } from '../../util/componentTypes';
import { LOG_ACTIONS_SELECT_DASHBOARD_TAB } from '../../../logger/LogUtils';

const NEW_TAB_INDEX = -1;
const MAX_TAB_COUNT = 10;

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

  // actions (from DashboardComponent.jsx)
  logEvent: PropTypes.func.isRequired,
  setMountedTab: PropTypes.func.isRequired,

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
  children: null,
  renderTabContent: true,
  renderHoverMenu: true,
  availableColumnCount: 0,
  columnWidth: 0,
  directPathToChild: [],
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
};

class Tabs extends React.PureComponent {
  constructor(props) {
    super(props);
    const tabIndex = Math.max(
      0,
      findTabIndexByComponentId({
        currentComponent: props.component,
        directPathToChild: props.directPathToChild,
      }),
    );

    this.state = {
      tabIndex,
    };
    this.handleClickTab = this.handleClickTab.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDeleteTab = this.handleDeleteTab.bind(this);
    this.handleDropOnTab = this.handleDropOnTab.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const maxIndex = Math.max(0, nextProps.component.children.length - 1);
    if (this.state.tabIndex > maxIndex) {
      this.setState(() => ({ tabIndex: maxIndex }));
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
          this.setState(() => ({ tabIndex: nextTabIndex }));
        }
      }
    }
  }

  handleClickTab(tabIndex, ev) {
    if (ev) {
      const { target } = ev;
      // special handler for clicking on anchor link icon (or whitespace nearby):
      // will show short link popover but do not change tab
      if (target && target.classList.contains('short-link-trigger')) {
        return;
      }
    }

    const { component, createComponent } = this.props;

    if (tabIndex === NEW_TAB_INDEX) {
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
    } else if (tabIndex !== this.state.tabIndex) {
      const pathToTabIndex = getDirectPathToTabIndex(component, tabIndex);
      const targetTabId = pathToTabIndex[pathToTabIndex.length - 1];
      this.props.logEvent(LOG_ACTIONS_SELECT_DASHBOARD_TAB, {
        target_id: targetTabId,
        index: tabIndex,
      });

      this.props.onChangeTab({ pathToTabIndex });
    }
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
      handleComponentDrop,
      renderTabContent,
      renderHoverMenu,
      isComponentVisible: isCurrentTabVisible,
      editMode,
    } = this.props;

    const { tabIndex: selectedTabIndex } = this.state;
    const { children: tabIds } = tabsComponent;

    return (
      <DragDroppable
        component={tabsComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({
          dropIndicatorProps: tabsDropIndicatorProps,
          dragSourceRef: tabsDragSourceRef,
        }) => (
          <div className="dashboard-component dashboard-component-tabs">
            {editMode && renderHoverMenu && (
              <HoverMenu innerRef={tabsDragSourceRef} position="left">
                <DragHandle position="left" />
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
              </HoverMenu>
            )}

            <BootstrapTabs
              id={tabsComponent.id}
              activeKey={selectedTabIndex}
              onSelect={this.handleClickTab}
              animation
              mountOnEnter
              unmountOnExit={false}
            >
              {tabIds.map((tabId, tabIndex) => (
                // react-bootstrap doesn't render a Tab if we move this to its own Tab.jsx so we
                // use `renderType` to indicate what the DashboardComponent should render. This
                // prevents us from passing the entire dashboard component lookup to render Tabs.jsx
                <BootstrapTab
                  key={tabId}
                  eventKey={tabIndex}
                  title={
                    <DashboardComponent
                      id={tabId}
                      parentId={tabsComponent.id}
                      depth={depth}
                      index={tabIndex}
                      renderType={RENDER_TAB}
                      availableColumnCount={availableColumnCount}
                      columnWidth={columnWidth}
                      onDropOnTab={this.handleDropOnTab}
                      onDeleteTab={this.handleDeleteTab}
                    />
                  }
                  onEntering={() => {
                    // Entering current tab, DOM is visible and has dimension
                    if (renderTabContent) {
                      this.props.setMountedTab(tabId);
                    }
                  }}
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
                </BootstrapTab>
              ))}

              {editMode && tabIds.length < MAX_TAB_COUNT && (
                <BootstrapTab
                  eventKey={NEW_TAB_INDEX}
                  title={<div className="fa fa-plus" />}
                />
              )}
            </BootstrapTabs>

            {/* don't indicate that a drop on root is allowed when tabs already exist */}
            {tabsDropIndicatorProps &&
              parentComponent.id !== DASHBOARD_ROOT_ID && (
                <div {...tabsDropIndicatorProps} />
              )}
          </div>
        )}
      </DragDroppable>
    );
  }
}

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;

export default Tabs;
