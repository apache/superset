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
  Fragment,
  useCallback,
  memo,
  useEffect,
  useRef,
  type ReactElement,
  type Ref,
} from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { t, styled } from '@apache-superset/core/ui';

import { EditableTitle, EmptyState } from '@superset-ui/core/components';
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
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import type {
  DropResult,
  DragItem,
} from 'src/dashboard/components/dnd/dragDroppableConfig';

export const RENDER_TAB = 'RENDER_TAB';
export const RENDER_TAB_CONTENT = 'RENDER_TAB_CONTENT';

// Delay before refreshing charts to ensure they are fully mounted
const CHART_MOUNT_DELAY = 100;

interface TabProps {
  dashboardId: number;
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  renderType: typeof RENDER_TAB | typeof RENDER_TAB_CONTENT;
  onDropOnTab: (dropResult: DropResult) => void;
  onDropPositionChange: (dragObject: {
    dropIndicator: string | null;
    isDraggingOver: boolean;
    index: number;
  }) => void;
  onDragTab: (dragComponentId: string | undefined) => void;
  onHoverTab: () => void;
  editMode: boolean;
  embeddedMode?: boolean;
  onTabTitleEditingChange: (isEditing: boolean) => void;
  isFocused?: boolean;
  isHighlighted?: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: () => void;
  onResize: () => void;
  onResizeStop: () => void;

  // redux
  handleComponentDrop: (dropResult: DropResult) => void;
  updateComponents: (components: Record<string, LayoutItem>) => void;
  setDirectPathToChild: (pathToTabIndex: string[]) => void;
  isComponentVisible?: boolean;
}

interface TabTitleContainerProps {
  isHighlighted?: boolean;
}

const TabTitleContainer = styled.div<TabTitleContainerProps>`
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

interface DropIndicatorChildProps {
  dropIndicatorProps?: {
    className: string;
  } | null;
}

const renderDraggableContent = (
  dropProps: DropIndicatorChildProps,
): ReactElement | null =>
  dropProps.dropIndicatorProps ? (
    <div {...dropProps.dropIndicatorProps} />
  ) : null;

interface DragDropChildProps {
  dropIndicatorProps?: {
    className: string;
  } | null;
  dragSourceRef?: Ref<HTMLDivElement>;
  draggingTabOnTab?: boolean;
}

const Tab = (props: TabProps): ReactElement => {
  const dispatch = useDispatch();
  const canEdit = useSelector(
    (state: RootState) => state.dashboardInfo.dash_edit_perm,
  );
  const dashboardLayout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const lastRefreshTime = useSelector(
    (state: RootState) => state.dashboardState.lastRefreshTime,
  );
  const tabActivationTime = useSelector(
    (state: RootState) => state.dashboardState.tabActivationTimes?.[props.id],
  );
  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);
  const isAutoRefreshing = useIsAutoRefreshing();
  const isRefreshInFlight = useIsRefreshInFlight();

  // Track which refresh we've already handled to prevent duplicates
  const handledRefreshRef = useRef<string | null>(null);

  useEffect(() => {
    if (props.renderType === RENDER_TAB_CONTENT && props.isComponentVisible) {
      if (
        lastRefreshTime &&
        tabActivationTime !== undefined &&
        lastRefreshTime > tabActivationTime
      ) {
        // Create a unique key for this specific refresh
        const refreshKey = `${props.id}-${lastRefreshTime}`;

        // Only proceed if we haven't already handled this refresh
        if (handledRefreshRef.current !== refreshKey) {
          handledRefreshRef.current = refreshKey;

          const chartIds = getChartIdsFromComponent(props.id, dashboardLayout);
          if (chartIds.length > 0) {
            if (isAutoRefreshing || isRefreshInFlight) {
              return;
            }
            // Use lazy load flags to avoid updating global refresh time and filters
            setTimeout(() => {
              dispatch(
                onRefresh(chartIds, true, 0, dashboardInfo.id, false, true),
              );
            }, CHART_MOUNT_DELAY);
          }
        }
      }
    }
  }, [
    props.isComponentVisible,
    props.renderType,
    props.id,
    lastRefreshTime,
    tabActivationTime,
    dashboardLayout,
    dashboardInfo.id,
    isAutoRefreshing,
    isRefreshInFlight,
    dispatch,
  ]);

  const handleChangeTab = useCallback(
    ({ pathToTabIndex }: { pathToTabIndex: string[] }) => {
      props.setDirectPathToChild(pathToTabIndex);
    },
    [props.setDirectPathToChild],
  );

  const handleChangeText = useCallback(
    (nextTabText: string) => {
      const { updateComponents, component } = props;
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
    [props.updateComponents, props.component],
  );

  const handleDrop = useCallback(
    (dropResult: DropResult) => {
      props.handleComponentDrop(dropResult);
      props.onDropOnTab(dropResult);
    },
    [props.handleComponentDrop, props.onDropOnTab],
  );

  const handleHoverTab = useCallback(() => {
    props.onHoverTab?.();
  }, [props.onHoverTab]);

  const handleTopDropTargetDrop = useCallback(
    (dropResult: DropResult) => {
      if (dropResult) {
        props.handleComponentDrop({
          ...dropResult,
          destination: {
            ...dropResult.destination!,
            // force appending as the first child if top drop target
            index: 0,
          },
        });
      }
    },
    [props.handleComponentDrop],
  );

  const shouldDropToChild = useCallback(
    (item: DragItem) => item.type !== TAB_TYPE,
    [],
  );

  const renderTabContent = useCallback(() => {
    const {
      component: tabComponent,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      editMode,
      isComponentVisible,
      dashboardId,
    } = props;

    const shouldDisplayEmptyState = tabComponent.children.length === 0;
    return (
      <div className="dashboard-component-tabs-content">
        {/* Make top of tab droppable */}
        {editMode && (
          <Droppable
            component={tabComponent}
            orientation="column"
            index={0}
            depth={depth}
            onDrop={
              tabComponent.children.length === 0
                ? handleTopDropTargetDrop
                : handleDrop
            }
            editMode
            className={classNames({
              'empty-droptarget': true,
              'empty-droptarget--full': tabComponent.children.length === 0,
            })}
            dropToChild={tabComponent.children.length === 0}
          >
            {renderDraggableContent}
          </Droppable>
        )}
        {shouldDisplayEmptyState && (
          <Droppable
            component={tabComponent}
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
        {tabComponent.children.map((componentId, componentIndex) => (
          <Fragment key={componentId}>
            <DashboardComponent
              id={componentId}
              parentId={tabComponent.id}
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
                component={tabComponent}
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
    props.component,
    props.depth,
    props.availableColumnCount,
    props.columnWidth,
    props.onResizeStart,
    props.onResize,
    props.onResizeStop,
    props.editMode,
    props.isComponentVisible,
    props.dashboardId,
    props.handleComponentDrop,
    props.onDropOnTab,
    props.setDirectPathToChild,
    props.updateComponents,
    handleHoverTab,
    canEdit,
    handleChangeTab,
    handleChangeText,
    handleDrop,
    handleTopDropTargetDrop,
    shouldDropToChild,
  ]);

  const renderTabChild = useCallback(
    ({
      dropIndicatorProps,
      dragSourceRef,
      draggingTabOnTab,
    }: DragDropChildProps) => {
      const {
        component,
        index,
        editMode,
        isFocused,
        isHighlighted,
        dashboardId,
        embeddedMode,
        onTabTitleEditingChange,
      } = props;
      return (
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
      );
    },
    [
      props.component,
      props.index,
      props.editMode,
      props.isFocused,
      props.isHighlighted,
      props.dashboardId,
      props.onTabTitleEditingChange,
      handleChangeText,
    ],
  );

  const renderTab = useCallback(() => {
    const {
      component,
      parentComponent,
      index,
      depth,
      editMode,
      onDropPositionChange,
      onDragTab,
    } = props;

    return (
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
    );
  }, [
    props.component,
    props.parentComponent,
    props.index,
    props.depth,
    props.editMode,
    handleDrop,
    handleHoverTab,
    shouldDropToChild,
    renderTabChild,
  ]);

  return props.renderType === RENDER_TAB ? renderTab() : renderTabContent();
};

export default memo(Tab);
