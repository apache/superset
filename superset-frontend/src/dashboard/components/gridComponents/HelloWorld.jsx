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
import { DragDroppable } from 'src/dashboard/components/dnd/DragDroppable';
import { componentShape } from 'src/dashboard/util/propShapes';
import AddChartModal from 'src/dashboard/components/AddChartModal/AddChartModal';
import { useDispatch } from 'react-redux';
import { updateEasyChartMeta } from 'src/dashboard/actions/dashboardLayout';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import { fetchSlices } from 'src/dashboard/actions/sliceEntities';
import { addSliceToDashboard } from 'src/dashboard/actions/dashboardState';

const ContainerDiv = styled.div`
  .dragdroppable {
    width: 499px;
    height: 508px;
  }
`;

const HelloWorldStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-helloworld {
      overflow: hidden;
      color: ${theme.colorText};
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
        background: ${theme.colors.grayscale.light4};
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
            color: ${theme.colorText};
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
          background: ${theme.colors.primary.light4};
          border: 2px dashed ${theme.colors.primary.base};
          border-radius: ${theme.borderRadius}px;
          color: ${theme.colors.primary.base};
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
            background: ${theme.colors.primary.light5};
            border-color: ${theme.colors.primary.dark1};
            color: ${theme.colors.primary.dark1};
          }

          .plus-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${theme.colors.primary.base};
            color: ${theme.colorWhite};
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

export default function HelloWorld({
  id,
  editMode,
  component,
  parentComponent,
  index,
  depth,
  // handleComponentDrop,
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

    // Add resize observer to track dimension changes
    // const resizeObserver = new ResizeObserver(updateDimensions);
    // if (containerRef.current) {
    //   resizeObserver.observe(containerRef.current);
    // }

    // return () => {
    //   resizeObserver.disconnect();
    // };
  }, []);

  const handleAddChart = () => {
    setIsModalOpen(true);
    console.log('Add Chart clicked - opening modal');
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
    console.log('Saving chart with data:', id);
    handleUpdateMeta(id);
    setIsModalOpen(false);
    // TODO: Implement chart creation logic
  };

  const handleClose = () => {
    console.log('Close clicked');
  };

  console.log(component);

  const renderContent = ({ dragSourceRef }) => (
    <HelloWorldStyles
      className={cx('dashboard-helloworld')}
      id={id}
      data-test="dashboard-helloworld"
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
    </HelloWorldStyles>
  );

  return (
    <ContainerDiv ref={containerRef}>
      <DragDroppable
        onDrop={dropProps => {
          console.log('drop props', dropProps);
        }}
        onHover={hoverProps => {
          console.log('hovered', hoverProps);
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

HelloWorld.propTypes = {
  id: PropTypes.string.isRequired,
  editMode: PropTypes.bool,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
};
