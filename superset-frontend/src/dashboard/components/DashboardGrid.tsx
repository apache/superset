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
import { Fragment, useCallback, useRef, useState } from 'react';
import classNames from 'classnames';
import { addAlpha } from '@superset-ui/core';
import { css, styled, t, useTheme } from '@apache-superset/core/ui';
import { EmptyState } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { navigateTo } from 'src/utils/navigationUtils';
import type { LayoutItem } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import DashboardComponent from '../containers/DashboardComponent';
import { Droppable } from './dnd/DragDroppable';
import { GRID_GUTTER_SIZE, GRID_COLUMN_COUNT } from '../util/constants';
import { TAB_TYPE } from '../util/componentTypes';

interface DashboardGridProps {
  depth: number;
  editMode?: boolean;
  canEdit?: boolean;
  gridComponent?: LayoutItem;
  handleComponentDrop: (dropResult: DropResult) => void;
  isComponentVisible: boolean;
  resizeComponent: (params: {
    id: string;
    width: number;
    height: number;
  }) => void;
  setDirectPathToChild: (path: string[]) => void;
  setEditMode?: (editMode: boolean) => void;
  width: number;
  dashboardId?: number;
}

interface DropProps {
  dropIndicatorProps?: Record<string, unknown>;
}

const renderDraggableContent = (dropProps: DropProps) =>
  dropProps.dropIndicatorProps && <div {...dropProps.dropIndicatorProps} />;

const DashboardEmptyStateContainer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const GridContent = styled.div<{ editMode?: boolean }>`
  ${({ theme, editMode }) => css`
    display: flex;
    flex-direction: column;
    /* gutters between rows */
    & > div:not(:last-child):not(.empty-droptarget) {
      ${!editMode && `margin-bottom: ${theme.sizeUnit * 4}px`};
    }

    .empty-droptarget {
      width: 100%;
      height: ${theme.sizeUnit * 4}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: ${theme.borderRadius}px;
      overflow: hidden;

      &:before {
        content: '';
        display: block;
        width: calc(100% - ${theme.sizeUnit * 2}px);
        height: calc(100% - ${theme.sizeUnit * 2}px);
        border: 1px dashed transparent;
        border-radius: ${theme.borderRadius}px;
        opacity: 0.5;
      }
    }

    & > .empty-droptarget:first-child {
      height: ${theme.sizeUnit * 4}px;
      margin-top: ${theme.sizeUnit * -4}px;
    }

    & > .empty-droptarget:last-child {
      height: ${theme.sizeUnit * 24}px;
    }

    & > .empty-droptarget.empty-droptarget--full:only-child {
      height: 80vh;
    }
  `}
`;

const GridColumnGuide = styled.div`
  ${({ theme }) => css`
    // /* Editing guides */
    &.grid-column-guide {
      position: absolute;
      top: 0;
      min-height: 100%;
      background-color: ${addAlpha(theme.colorPrimary, 0.1)};
      pointer-events: none;
      box-shadow: inset 0 0 0 1px ${addAlpha(theme.colorPrimary, 0.6)};
    }
  `};
`;

function DashboardGrid({
  depth,
  editMode,
  canEdit,
  gridComponent,
  handleComponentDrop,
  isComponentVisible,
  resizeComponent,
  setDirectPathToChild,
  setEditMode,
  width,
  dashboardId,
}: DashboardGridProps) {
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const setGridRef = useCallback((ref: HTMLDivElement | null): void => {
    gridRef.current = ref;
  }, []);

  const handleResizeStart = useCallback((): void => {
    setIsResizing(true);
  }, []);

  const handleResize = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _direction: string,
      _elementRef: HTMLElement,
      _delta: { width: number; height: number },
    ): void => {
      // no-op: resize position tracking not implemented
    },
    [],
  );

  const handleResizeStop = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _direction: string,
      _elementRef: HTMLElement,
      delta: { width: number; height: number },
      id: string,
    ): void => {
      resizeComponent({
        id,
        width: delta.width,
        height: delta.height,
      });

      setIsResizing(false);
    },
    [resizeComponent],
  );

  const handleTopDropTargetDrop = useCallback(
    (dropResult: DropResult): void => {
      if (dropResult?.destination) {
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

  const handleChangeTab = useCallback(
    ({ pathToTabIndex }: { pathToTabIndex: string[] }): void => {
      setDirectPathToChild(pathToTabIndex);
    },
    [setDirectPathToChild],
  );

  const columnPlusGutterWidth = (width + GRID_GUTTER_SIZE) / GRID_COLUMN_COUNT;

  const columnWidth = columnPlusGutterWidth - GRID_GUTTER_SIZE;

  const shouldDisplayEmptyState = gridComponent?.children?.length === 0;
  const shouldDisplayTopLevelTabEmptyState =
    shouldDisplayEmptyState && gridComponent?.type === TAB_TYPE;

  const dashboardEmptyState = editMode && (
    <EmptyState
      title={t('Drag and drop components and charts to the dashboard')}
      description={t(
        'You can create a new chart or use existing ones from the panel on the right',
      )}
      size="large"
      buttonText={
        <>
          <Icons.PlusOutlined iconSize="m" color={theme.colorPrimary} />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        navigateTo(`/chart/add?dashboard_id=${dashboardId}`, {
          newWindow: true,
        });
      }}
      image="chart.svg"
    />
  );

  const topLevelTabEmptyState = editMode ? (
    <EmptyState
      title={t('Drag and drop components to this tab')}
      size="large"
      description={t(
        `You can create a new chart or use existing ones from the panel on the right`,
      )}
      buttonText={
        <>
          <Icons.PlusOutlined iconSize="m" color={theme.colorPrimary} />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        navigateTo(`/chart/add?dashboard_id=${dashboardId}`, {
          newWindow: true,
        });
      }}
      image="chart.svg"
    />
  ) : (
    <EmptyState
      title={t('There are no components added to this tab')}
      size="large"
      description={canEdit && t('You can add the components in the edit mode.')}
      buttonText={canEdit ? t('Edit the dashboard') : undefined}
      buttonAction={
        canEdit
          ? () => {
              setEditMode?.(true);
            }
          : undefined
      }
      image="chart.svg"
    />
  );

  return width < 100 ? null : (
    <>
      {shouldDisplayEmptyState && (
        <DashboardEmptyStateContainer>
          {shouldDisplayTopLevelTabEmptyState
            ? topLevelTabEmptyState
            : dashboardEmptyState}
        </DashboardEmptyStateContainer>
      )}
      <div className="dashboard-grid" ref={setGridRef}>
        <GridContent
          className="grid-content"
          data-test="grid-content"
          editMode={editMode}
        >
          {/* make the area above components droppable */}
          {editMode && (
            <Droppable
              component={gridComponent}
              depth={depth}
              parentComponent={null}
              index={0}
              orientation="column"
              onDrop={handleTopDropTargetDrop}
              className={classNames({
                'empty-droptarget': true,
                'empty-droptarget--full': gridComponent?.children?.length === 0,
              })}
              editMode
              dropToChild={gridComponent?.children?.length === 0}
            >
              {renderDraggableContent}
            </Droppable>
          )}
          {gridComponent?.children?.map((id, index) => (
            <Fragment key={id}>
              <DashboardComponent
                id={id}
                parentId={gridComponent.id}
                depth={depth + 1}
                index={index}
                availableColumnCount={GRID_COLUMN_COUNT}
                columnWidth={columnWidth}
                isComponentVisible={isComponentVisible}
                onResizeStart={handleResizeStart}
                onResize={handleResize}
                onResizeStop={handleResizeStop}
                onChangeTab={handleChangeTab}
              />
              {/* make the area below components droppable */}
              {editMode && (
                <Droppable
                  component={gridComponent}
                  depth={depth}
                  parentComponent={null}
                  index={index + 1}
                  orientation="column"
                  onDrop={handleComponentDrop}
                  className="empty-droptarget"
                  editMode
                >
                  {renderDraggableContent}
                </Droppable>
              )}
            </Fragment>
          ))}
          {isResizing &&
            Array(GRID_COLUMN_COUNT)
              .fill(null)
              .map((_, i) => (
                <GridColumnGuide
                  key={`grid-column-${i}`}
                  className="grid-column-guide"
                  style={{
                    left: i * GRID_GUTTER_SIZE + i * columnWidth,
                    width: columnWidth,
                  }}
                />
              ))}
        </GridContent>
      </div>
    </>
  );
}

export default DashboardGrid;
