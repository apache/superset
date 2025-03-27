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
import { useState, useMemo, useCallback, useEffect, memo } from 'react';

import { ResizeCallback, ResizeStartCallback } from 're-resizable';
import cx from 'classnames';
import { useSelector } from 'react-redux';
import { css, useTheme } from '@superset-ui/core';
import { LayoutItem, RootState } from 'src/dashboard/types';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';
import useFilterFocusHighlightStyles from 'src/dashboard/util/useFilterFocusHighlightStyles';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';

export const CHART_MARGIN = 32;

interface ChartHolderProps {
  id: string;
  parentId: string;
  dashboardId: number;
  component: LayoutItem;
  parentComponent: LayoutItem;
  getComponentById?: (id?: string) => LayoutItem | undefined;
  index: number;
  depth: number;
  editMode: boolean;
  directPathLastUpdated?: number;
  fullSizeChartId: number | null;
  isComponentVisible: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: Function;
  handleComponentDrop: (...args: unknown[]) => unknown;
  setFullSizeChartId: (chartId: number | null) => void;
  isInView: boolean;
}

const ChartHolder = ({
  id,
  parentId,
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
  isComponentVisible,
  dashboardId,
  fullSizeChartId,
  getComponentById = () => undefined,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
  setFullSizeChartId,
  isInView,
}: ChartHolderProps) => {
  const theme = useTheme();
  const fullSizeStyle = css`
    && {
      position: fixed;
      z-index: 3000;
      left: 0;
      top: 0;
      padding: ${theme.gridUnit * 2}px;
    }
  `;
  const { chartId } = component.meta;
  const isFullSize = fullSizeChartId === chartId;

  const focusHighlightStyles = useFilterFocusHighlightStyles(chartId);
  const directPathToChild = useSelector(
    (state: RootState) => state.dashboardState.directPathToChild,
  );
  const directPathLastUpdated = useSelector(
    (state: RootState) => state.dashboardState.directPathLastUpdated ?? 0,
  );

  const [extraControls, setExtraControls] = useState<Record<string, unknown>>(
    {},
  );
  const [outlinedComponentId, setOutlinedComponentId] = useState<string>();
  const [outlinedColumnName, setOutlinedColumnName] = useState<string>();
  const [currentDirectPathLastUpdated, setCurrentDirectPathLastUpdated] =
    useState(0);

  const infoFromPath = useMemo(
    () => getChartAndLabelComponentIdFromPath(directPathToChild ?? []) as any,
    [directPathToChild],
  );

  // Calculate if the chart should be outlined
  useEffect(() => {
    const { label: columnName, chart: chartComponentId } = infoFromPath;

    if (
      directPathLastUpdated !== currentDirectPathLastUpdated &&
      component.id === chartComponentId
    ) {
      setCurrentDirectPathLastUpdated(directPathLastUpdated);
      setOutlinedComponentId(component.id);
      setOutlinedColumnName(columnName);
    }
  }, [
    component,
    currentDirectPathLastUpdated,
    directPathLastUpdated,
    infoFromPath,
  ]);

  // Remove the chart outline after a defined time
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (outlinedComponentId) {
      timerId = setTimeout(() => {
        setOutlinedComponentId(undefined);
        setOutlinedColumnName(undefined);
      }, 2000);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [outlinedComponentId]);

  const widthMultiple = useMemo(() => {
    const columnParentWidth = getComponentById(
      parentComponent.parents?.find(parent => parent.startsWith(COLUMN_TYPE)),
    )?.meta?.width;

    let widthMultiple = component.meta.width || GRID_MIN_COLUMN_COUNT;
    if (parentComponent.type === COLUMN_TYPE) {
      widthMultiple = parentComponent.meta.width || GRID_MIN_COLUMN_COUNT;
    } else if (columnParentWidth && widthMultiple > columnParentWidth) {
      widthMultiple = columnParentWidth;
    }

    return widthMultiple;
  }, [
    component,
    getComponentById,
    parentComponent.meta.width,
    parentComponent.parents,
    parentComponent.type,
  ]);

  const { chartWidth, chartHeight } = useMemo(() => {
    let width = 0;
    let height = 0;

    if (isFullSize) {
      width = window.innerWidth - CHART_MARGIN;
      height = window.innerHeight - CHART_MARGIN;
    } else {
      width = Math.floor(
        widthMultiple * columnWidth +
          (widthMultiple - 1) * GRID_GUTTER_SIZE -
          CHART_MARGIN,
      );
      height = Math.floor(
        component.meta.height * GRID_BASE_UNIT - CHART_MARGIN,
      );
    }

    return {
      chartWidth: width,
      chartHeight: height,
    };
  }, [columnWidth, component, isFullSize, widthMultiple]);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleUpdateSliceName = useCallback(
    (nextName: string) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            sliceNameOverride: nextName,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleToggleFullSize = useCallback(() => {
    setFullSizeChartId(isFullSize ? null : chartId);
  }, [chartId, isFullSize, setFullSizeChartId]);

  const handleExtraControl = useCallback((name: string, value: unknown) => {
    setExtraControls(current => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const renderChild = useCallback(
    ({ dragSourceRef }) => (
      <ResizableContainer
        id={component.id}
        adjustableWidth={parentComponent.type === ROW_TYPE}
        adjustableHeight
        widthStep={columnWidth}
        widthMultiple={widthMultiple}
        heightStep={GRID_BASE_UNIT}
        heightMultiple={component.meta.height}
        minWidthMultiple={GRID_MIN_COLUMN_COUNT}
        minHeightMultiple={GRID_MIN_ROW_UNITS}
        maxWidthMultiple={availableColumnCount + widthMultiple}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode}
      >
        <div
          ref={dragSourceRef}
          data-test="dashboard-component-chart-holder"
          style={focusHighlightStyles}
          css={isFullSize ? fullSizeStyle : undefined}
          className={cx(
            'dashboard-component',
            'dashboard-component-chart-holder',
            // The following class is added to support custom dashboard styling via the CSS editor
            `dashboard-chart-id-${chartId}`,
            outlinedComponentId ? 'fade-in' : 'fade-out',
          )}
        >
          {!editMode && (
            <AnchorLink
              id={component.id}
              scrollIntoView={outlinedComponentId === component.id}
            />
          )}
          {!!outlinedComponentId && (
            <style>
              {`label[for=${outlinedColumnName}] + .Select .Select__control {
                    border-color: #00736a;
                    transition: border-color 1s ease-in-out;
                  }`}
            </style>
          )}
          <Chart
            componentId={component.id}
            id={component.meta.chartId}
            dashboardId={dashboardId}
            width={chartWidth}
            height={chartHeight}
            sliceName={
              component.meta.sliceNameOverride || component.meta.sliceName || ''
            }
            updateSliceName={handleUpdateSliceName}
            isComponentVisible={isComponentVisible}
            handleToggleFullSize={handleToggleFullSize}
            isFullSize={isFullSize}
            setControlValue={handleExtraControl}
            extraControls={extraControls}
            isInView={isInView}
          />
          {editMode && (
            <HoverMenu position="top">
              <div data-test="dashboard-delete-component-button">
                <DeleteComponentButton onDelete={handleDeleteComponent} />
              </div>
            </HoverMenu>
          )}
        </div>
      </ResizableContainer>
    ),
    [
      component.id,
      component.meta.height,
      component.meta.chartId,
      component.meta.sliceNameOverride,
      component.meta.sliceName,
      parentComponent.type,
      columnWidth,
      widthMultiple,
      availableColumnCount,
      onResizeStart,
      onResize,
      onResizeStop,
      editMode,
      focusHighlightStyles,
      isFullSize,
      fullSizeStyle,
      chartId,
      outlinedComponentId,
      outlinedColumnName,
      dashboardId,
      chartWidth,
      chartHeight,
      handleUpdateSliceName,
      isComponentVisible,
      handleToggleFullSize,
      handleExtraControl,
      extraControls,
      isInView,
      handleDeleteComponent,
    ],
  );

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      disableDragDrop={false}
      editMode={editMode}
    >
      {renderChild}
    </Draggable>
  );
};

export default memo(ChartHolder);
