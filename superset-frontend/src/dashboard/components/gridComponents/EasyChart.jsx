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
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { styled, css, t } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { DragDroppable } from 'src/dashboard/components/dnd/DragDroppable';
import { componentShape } from 'src/dashboard/util/propShapes';
import { updateEasyChartMeta } from 'src/dashboard/actions/dashboardLayout';
import { fetchSlices } from 'src/dashboard/actions/sliceEntities';
import { addSliceToDashboard } from 'src/dashboard/actions/dashboardState';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import AddChartModal from 'src/dashboard/components/AddChartModal/AddChartModal';

const ContainerDiv = styled.div`
  .dragdroppable {
    width: 499px;
    height: 508px;
  }
`;

const EasyChartStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-EasyChart {
      overflow: hidden;
      color: ${theme.colorTextHeading};
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 300px;
      min-width: 400px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorderSecondary};

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
        background: ${theme.colorBgLayoutHeader};
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
}) {
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chartDimensions, setChartDimensions] = useState({
    width: 499,
    height: 508,
  });
  const containerRef = useRef(null);

  // Update chart dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setChartDimensions({
          width: rect.width || 499,
          height: rect.height || 508,
        });
      }
    };

    // Initial measurement
    updateDimensions();

    // TODO: Add resize observer to track dimension changes when needed
    // const resizeObserver = new ResizeObserver(updateDimensions);
    // if (containerRef.current) {
    //   resizeObserver.observe(containerRef.current);
    // }
    // return () => resizeObserver.disconnect();
  }, []);

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
    <EasyChartStyles
      className={cx('dashboard-EasyChart')}
      id={id}
      data-test="dashboard-EasyChart"
      ref={dragSourceRef}
    >
      {component.meta.chartId ? (
        <Chart
          {...{
            componentId: component.id,
            id: component.meta.chartId,
            width: chartDimensions.width,
            height: chartDimensions.height,
            isComponentVisible: true,
            isFullSize: false,
            extraControls: {},
            isInView: true,
            handleToggleFullSize: () => {},
            updateSliceName: () => {},
            setControlValue: () => {},
          }}
          sliceName="School Degree Chart"
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
  );

  return (
    <ContainerDiv ref={containerRef}>
      <DragDroppable
        onDrop={() => {
          // Handle drop logic
        }}
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
};
