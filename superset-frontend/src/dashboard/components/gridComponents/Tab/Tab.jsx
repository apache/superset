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
import { Fragment, useCallback, memo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { t, styled } from '@apache-superset/core/ui';

import {
  Button,
  EditableTitle,
  EmptyState,
} from '@superset-ui/core/components';
import { setEditMode, onRefresh } from 'src/dashboard/actions/dashboardState';
import getChartIdsFromComponent from 'src/dashboard/util/getChartIdsFromComponent';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import { Typography } from '@superset-ui/core/components/Typography';
import {
  useIsAutoRefreshing,
  useIsRefreshInFlight,
} from 'src/dashboard/contexts/AutoRefreshContext';
import {
  DragDroppable,
  Droppable,
} from 'src/dashboard/components/dnd/DragDroppable';
import { componentShape } from 'src/dashboard/util/propShapes';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import { Link } from 'react-router-dom';

export const RENDER_TAB = 'RENDER_TAB';
export const RENDER_TAB_CONTENT = 'RENDER_TAB_CONTENT';

// Delay before refreshing charts to ensure they are fully mounted
const CHART_MOUNT_DELAY = 100;

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  renderType: PropTypes.oneOf([RENDER_TAB, RENDER_TAB_CONTENT]).isRequired,
  onDropOnTab: PropTypes.func,
  onDropPositionChange: PropTypes.func,
  onDragTab: PropTypes.func,
  onHoverTab: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  embeddedMode: PropTypes.bool,
  onTabTitleEditingChange: PropTypes.func,

  // grid related
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
  isComponentVisible: PropTypes.bool,
};

const defaultProps = {
  availableColumnCount: 0,
  columnWidth: 0,
  onDropOnTab() {},
  onDropPositionChange() {},
  onDragTab() {},
  onHoverTab() {},
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
  onTabTitleEditingChange() {},
};

const TabTitleContainer = styled.div`
  ${({ isHighlighted, theme: { sizeUnit, colorPrimaryBg } }) => `
    display: inline-flex;
    position: relative;
    align-items: center;
    margin: 0 ${sizeUnit * 2}px;
    transition: box-shadow 0.2s ease-in-out;
    ${isHighlighted ? `box-shadow: 0 0 ${sizeUnit}px ${colorPrimaryBg};` : ''}

    .anchor-link-container {
      position: absolute;
      left: 100%;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    &:hover .anchor-link-container {
      opacity: 1;
    }
  `}
`;

const TitleDropIndicator = styled.div`
  &.drop-indicator {
    position: absolute;
    top: 0;
    border-radius: 4px;
  }
`;

const renderDraggableContent = dropProps =>
  dropProps.dropIndicatorProps && <div {...dropProps.dropIndicatorProps} />;

const Tab = props => {
  const dispatch = useDispatch();
  const {
    id,
    renderType,
    isComponentVisible,
    component,
    parentComponent,
    index,
    depth,
    availableColumnCount,
    columnWidth,
    onResizeStart,
    onResize,
    onResizeStop,
    editMode,
    dashboardId,
    handleComponentDrop,
    updateComponents,
    setDirectPathToChild,
    onDropOnTab,
    onHoverTab,
    onTabTitleEditingChange,
    embeddedMode,
    onDropPositionChange,
    onDragTab,
    isFocused,
    isHighlighted,
  } = props;
  const canEdit = useSelector(state => state.dashboardInfo.dash_edit_perm);
  const dashboardLayout = useSelector(state => state.dashboardLayout.present);
  const lastRefreshTime = useSelector(
    state => state.dashboardState.lastRefreshTime,
  );
  const tabActivationTime = useSelector(
    state => state.dashboardState.tabActivationTimes?.[id] || 0,
  );
  const dashboardInfo = useSelector(state => state.dashboardInfo);
  const isAutoRefreshing = useIsAutoRefreshing();
  const isRefreshInFlight = useIsRefreshInFlight();

  // Track which refresh we've already handled to prevent duplicates
  const handledRefreshRef = useRef(null);

  useEffect(() => {
    if (renderType === RENDER_TAB_CONTENT && isComponentVisible) {
      if (
        lastRefreshTime &&
        tabActivationTime &&
        lastRefreshTime > tabActivationTime
      ) {
        const chartIds = getChartIdsFromComponent(id, dashboardLayout);
        if (chartIds.length > 0) {
          // Skip if auto-refresh is in progress to avoid duplicate refreshes
          if (isAutoRefreshing || isRefreshInFlight) {
            return;
          }
          requestAnimationFrame(() => {
            setTimeout(() => {
              dispatch(
                onRefresh(chartIds, true, 0, dashboardInfo.id, false, true),
              );
            }, CHART_MOUNT_DELAY);
          });
        }
      }
    }
  }, [
    isComponentVisible,
    renderType,
    id,
    lastRefreshTime,
    tabActivationTime,
    dashboardLayout,
    dashboardInfo.id,
    dispatch,
    isAutoRefreshing,
    isRefreshInFlight,
  ]);

  const handleChangeTab = useCallback(
    ({ pathToTabIndex }) => {
      setDirectPathToChild(pathToTabIndex);
    },
    [setDirectPathToChild],
  );

  const handleChangeText = useCallback(
    nextTabText => {
      if (nextTabText && nextTabText !== component.meta.text) {
        updateComponents({
          [component.id]: {
            ...component,
            meta: {
              ...component.meta,
              text: nextTabText,
            },
          },
        });
      }
    },
    [updateComponents, component],
  );

  const handleDrop = useCallback(
    dropResult => {
      handleComponentDrop(dropResult);
      onDropOnTab(dropResult);
    },
    [handleComponentDrop, onDropOnTab],
  );

  const handleHoverTab = useCallback(() => {
    onHoverTab?.();
  }, [onHoverTab]);

  const handleTopDropTargetDrop = useCallback(
    dropResult => {
      if (dropResult) {
        handleComponentDrop({
          ...dropResult,
          destination: {
            ...dropResult.destination,
            // force appending as the first child if top drop target
            index: 0,
          },
        });
      }
    },
    [handleComponentDrop],
  );

  const shouldDropToChild = useCallback(item => item.type !== TAB_TYPE, []);

  const renderTabContent = useCallback(() => {
    const shouldDisplayEmptyState = component.children.length === 0;
    return (
      <div className="dashboard-component-tabs-content">
        {/* Make top of tab droppable */}
        {editMode && (
          <Droppable
            component={component}
            orientation="column"
            index={0}
            depth={depth}
            onDrop={
              component.children.length === 0
                ? handleTopDropTargetDrop
                : handleDrop
            }
            editMode
            className={classNames({
              'empty-droptarget': true,
              'empty-droptarget--full': component.children.length === 0,
            })}
            dropToChild={component.children.length === 0}
          >
            {renderDraggableContent}
          </Droppable>
        )}
        {shouldDisplayEmptyState && (
          <Droppable
            component={component}
            orientation="column"
            index={editMode ? 1 : 0}
            depth={depth}
            onDrop={handleTopDropTargetDrop}
            editMode={editMode}
            dropToChild
          >
            {() => (
              <div data-test="emptystate-drop-indicator">
                <EmptyState
                  title={
                    editMode
                      ? t('Drag and drop components to this tab')
                      : t('There are no components added to this tab')
                  }
                  description={
                    canEdit &&
                    (editMode ? (
                      <span>
                        {t('You can')}{' '}
                        <Typography.Link
                          href={`/chart/add?dashboard_id=${dashboardId}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {t('create a new chart')}
                        </Typography.Link>{' '}
                        {t('or use existing ones from the panel on the right')}
                      </span>
                    ) : (
                      <span>
                        {t('You can add the components in the')}{' '}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => dispatch(setEditMode(true))}
                        >
                          {t('edit mode')}
                        </span>
                      </span>
                    ))
                  }
                  image="chart.svg"
                />
              </div>
            )}
          </Droppable>
        )}
        {component.children.map((componentId, componentIndex) => (
          <Fragment key={componentId}>
            <DashboardComponent
              id={componentId}
              parentId={component.id}
              depth={depth} // see isValidChild.js for why tabs don't increment child depth
              index={componentIndex}
              onDrop={handleDrop}
              onHover={handleHoverTab}
              availableColumnCount={availableColumnCount}
              columnWidth={columnWidth}
              onResizeStart={onResizeStart}
              onResize={onResize}
              onResizeStop={onResizeStop}
              isComponentVisible={isComponentVisible}
              onChangeTab={handleChangeTab}
            />
            {/* Make bottom of tab droppable */}
            {editMode && (
              <Droppable
                component={component}
                orientation="column"
                index={componentIndex + 1}
                depth={depth}
                onDrop={handleDrop}
                editMode
                className="empty-droptarget"
              >
                {renderDraggableContent}
              </Droppable>
            )}
          </Fragment>
        ))}
      </div>
    );
  }, [
    dispatch,
    component,
    depth,
    availableColumnCount,
    columnWidth,
    onResizeStart,
    onResize,
    onResizeStop,
    editMode,
    isComponentVisible,
    dashboardId,
    handleHoverTab,
    canEdit,
    handleChangeTab,
    handleDrop,
    handleTopDropTargetDrop,
  ]);

  const renderTabChild = useCallback(
    ({ dropIndicatorProps, dragSourceRef, draggingTabOnTab }) => (
      <TabTitleContainer
        isHighlighted={isHighlighted}
        className="dragdroppable-tab"
        ref={dragSourceRef}
      >
        <EditableTitle
          title={component.meta.text}
          defaultTitle={component.meta.defaultText}
          placeholder={component.meta.placeholder}
          canEdit={editMode && isFocused}
          onSaveTitle={handleChangeText}
          showTooltip={false}
          editing={editMode && isFocused}
          onEditingChange={onTabTitleEditingChange}
        />
        {!editMode && !embeddedMode && (
          <AnchorLink
            id={component.id}
            dashboardId={dashboardId}
            placement={index >= 5 ? 'left' : 'right'}
          />
        )}

        {dropIndicatorProps && !draggingTabOnTab && (
          <TitleDropIndicator
            className={dropIndicatorProps.className}
            data-test="title-drop-indicator"
          />
        )}
      </TabTitleContainer>
    ),
    [
      component,
      index,
      editMode,
      isFocused,
      isHighlighted,
      dashboardId,
      embeddedMode,
      onTabTitleEditingChange,
      handleChangeText,
    ],
  );

  const renderTab = useCallback(
    () => (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="column"
        index={index}
        depth={depth}
        onDrop={handleDrop}
        onHover={handleHoverTab}
        onDropIndicatorChange={onDropPositionChange}
        onDragTab={onDragTab}
        editMode={editMode}
        dropToChild={shouldDropToChild}
      >
        {renderTabChild}
      </DragDroppable>
    ),
    [
      component,
      parentComponent,
      index,
      depth,
      editMode,
      onDropPositionChange,
      onDragTab,
      handleDrop,
      handleHoverTab,
      shouldDropToChild,
      renderTabChild,
    ],
  );

  return renderType === RENDER_TAB ? renderTab() : renderTabContent();
};

Tab.propTypes = propTypes;
Tab.defaultProps = defaultProps;

export default memo(Tab);
