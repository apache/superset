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
import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { styled, css, t } from '@superset-ui/core';
// ResizeCallback and ResizeStartCallback types used in props
import { useDispatch } from 'react-redux';
import { DragDroppable } from 'src/dashboard/components/dnd/DragDroppable';
import { componentShape } from 'src/dashboard/util/propShapes';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import { updateEasyChartMeta } from 'src/dashboard/actions/dashboardLayout';
import { fetchSlices } from 'src/dashboard/actions/sliceEntities';
import { addSliceToDashboard } from 'src/dashboard/actions/dashboardState';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import AddChartModal from 'src/dashboard/components/AddChartModal/AddChartModal';
import {
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';

export const CHART_MARGIN = 32;

const ContainerDiv = styled.div`
  /* Container will be sized by ResizableContainer */
`;

const EasyChartStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-EasyChart {
      overflow: hidden;
      color: ${theme.colorTextHeading};
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorderSecondary};

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
        background: ${theme.colorBgLayout};
        border-bottom: 1px solid ${theme.colorBorderSecondary};
        font-weight: ${theme.fontWeightStrong};
        font-size: ${theme.fontSizeLG}px;

        .close-button {
          background: none;
          border: none;
          color: ${theme.colorTextSecondary};
          cursor: pointer;
          font-size: ${theme.fontSizeXL}px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;

          &:hover {
            color: ${theme.colorTextHeading};
          }
        }
      }

      .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${theme.sizeUnit * 8}px;

        .add-chart-button {
          background: ${theme.colorPrimaryBg};
          border: 2px dashed ${theme.colorPrimary};
          border-radius: ${theme.borderRadius}px;
          color: ${theme.colorPrimary};
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 6}px;
          transition: all 0.2s ease;
          min-height: 80px;
          min-width: 120px;

          &:hover {
            background: ${theme.colorPrimaryBgHover};
            border-color: ${theme.colorPrimaryHover};
            color: ${theme.colorPrimaryHover};
          }

          .plus-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${theme.colorPrimary};
            color: ${theme.colorTextInverse};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: ${theme.sizeUnit * 2}px;
          }

          .button-text {
            font-size: ${theme.fontSizeSM}px;
            font-weight: ${theme.fontWeightNormal};
            text-align: center;
          }
        }
      }

      .dashboard--editing & {
        cursor: move;
      }
    }
  `}
`;

export default function EasyChart({
  id,
  editMode,
  component,
  parentComponent,
  index,
  depth,
  // Resizable props
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
  // DragDroppable props
  handleComponentDrop,
}) {
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef(null);

  // Calculate width multiple for resizable container
  const widthMultiple = useMemo(
    () => component.meta.width || GRID_MIN_COLUMN_COUNT,
    [component.meta.width],
  );

  // Calculate chart dimensions based on grid system
  const { chartWidth, chartHeight } = useMemo(() => {
    const width = Math.floor(
      widthMultiple * columnWidth +
        (widthMultiple - 1) * GRID_GUTTER_SIZE -
        CHART_MARGIN,
    );
    const height = Math.floor(
      (component.meta.height || GRID_MIN_ROW_UNITS) * GRID_BASE_UNIT -
        CHART_MARGIN,
    );

    return {
      chartWidth: Math.max(width, 300), // Minimum width
      chartHeight: Math.max(height, 200), // Minimum height
    };
  }, [columnWidth, component.meta.height, widthMultiple]);

  // Component updates are handled by parent via onResizeStop callback

  const handleAddChart = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleUpdateMeta = id => {
    // need action to rename the key from 0 to generated slice id
    dispatch(fetchSlices());
    setTimeout(() => {
      dispatch(addSliceToDashboard(id));
    }, 500);

    setTimeout(() => {
      dispatch(updateEasyChartMeta(component?.id, id));
    }, 3000);
  };

  const handleSaveChart = id => {
    handleUpdateMeta(id);
    setIsModalOpen(false);
  };

  const handleClose = () => {
    // Handle close logic if needed
  };

  const renderContent = ({ dragSourceRef }) => (
    <ResizableContainer
      id={component.id}
      adjustableWidth={parentComponent.type === ROW_TYPE}
      adjustableHeight
      widthStep={columnWidth}
      widthMultiple={widthMultiple}
      heightStep={GRID_BASE_UNIT}
      heightMultiple={component.meta.height || GRID_MIN_ROW_UNITS}
      minWidthMultiple={GRID_MIN_COLUMN_COUNT}
      minHeightMultiple={GRID_MIN_ROW_UNITS}
      maxWidthMultiple={availableColumnCount + widthMultiple}
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeStop={onResizeStop}
      editMode={editMode}
    >
      <EasyChartStyles
        className={cx('dashboard-EasyChart')}
        id={id}
        data-test="dashboard-EasyChart"
        ref={dragSourceRef}
      >
        {component.meta.chartId ? (
          <Chart
            componentId={component.id}
            id={component.meta.chartId}
            width={chartWidth}
            height={chartHeight}
            isComponentVisible
            isFullSize={false}
            extraControls={{}}
            isInView
            handleToggleFullSize={() => {}}
            updateSliceName={() => {}}
            setControlValue={() => {}}
            sliceName="Easy Chart"
          />
        ) : (
          <>
            <div className="header">
              <span>{t('Empty Chart Container')}</span>
              <button
                className="close-button"
                onClick={handleClose}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="content">
              <button
                className="add-chart-button"
                onClick={handleAddChart}
                type="button"
              >
                <div className="plus-icon">+</div>
                <div className="button-text">{t('Add Chart')}</div>
              </button>
            </div>
          </>
        )}
      </EasyChartStyles>
    </ResizableContainer>
  );

  return (
    <ContainerDiv ref={containerRef}>
      <DragDroppable
        onDrop={handleComponentDrop}
        onHover={() => {
          // Handle hover logic
        }}
        index={index}
        depth={depth}
        component={component}
        parentComponent={parentComponent}
        orientation="column"
        useEmptyDragPreview
        style={{}}
        editMode={editMode}
      >
        {({ dragSourceRef = null }) => renderContent({ dragSourceRef })}
      </DragDroppable>

      <AddChartModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveChart}
      />
    </ContainerDiv>
  );
}

EasyChart.propTypes = {
  id: PropTypes.string.isRequired,
  editMode: PropTypes.bool,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  // Resizable props
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,
  // DragDroppable props
  handleComponentDrop: PropTypes.func,
};

EasyChart.defaultProps = {
  editMode: false,
  availableColumnCount: 12,
  columnWidth: 100,
  onResizeStart: () => {},
  onResize: () => {},
  onResizeStop: () => {},
  handleComponentDrop: () => {},
};
