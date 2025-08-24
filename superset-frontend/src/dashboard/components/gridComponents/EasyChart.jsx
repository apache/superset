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
import { useDispatch, useSelector } from 'react-redux';
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
export const DEFAULT_EASY_CHART_HEIGHT_UNITS = 60; // ~450px default height

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
      border-radius: ${theme.borderRadiusLG}px;
      background: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorderSecondary};
      box-shadow: ${theme.boxShadowSecondary};
      position: relative;

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 5}px;
        background: linear-gradient(
          135deg,
          ${theme.colorBgContainer} 0%,
          ${theme.colorBgLayout} 100%
        );
        border-bottom: 1px solid ${theme.colorBorderSecondary};
        font-weight: ${theme.fontWeightMedium};
        font-size: ${theme.fontSizeLG}px;
        position: relative;

        &:before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(
            180deg,
            ${theme.colorPrimary} 0%,
            ${theme.colorPrimaryActive} 100%
          );
          border-radius: 0 2px 2px 0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: ${theme.sizeUnit * 2}px;

          .chart-icon {
            width: 24px;
            height: 24px;
            background: ${theme.colorPrimaryBg};
            border-radius: ${theme.borderRadius}px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${theme.colorPrimary};
            font-size: 14px;
          }

          .title {
            color: ${theme.colorTextHeading};
            font-weight: ${theme.fontWeightStrong};
          }
        }

        .close-button {
          background: ${theme.colorBgTextHover};
          border: none;
          color: ${theme.colorTextSecondary};
          cursor: pointer;
          font-size: 16px;
          padding: ${theme.sizeUnit}px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: ${theme.borderRadius}px;
          transition: all 0.2s ease;

          &:hover {
            color: ${theme.colorTextHeading};
            background: ${theme.colorError};
            transform: scale(1.05);
          }
        }
      }

      .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${theme.sizeUnit * 10}px ${theme.sizeUnit * 6}px;
        background: linear-gradient(
          145deg,
          ${theme.colorBgContainer} 0%,
          ${theme.colorBgContainerDisabled} 100%
        );
        position: relative;

        &:before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          background: radial-gradient(
            circle,
            ${theme.colorPrimaryBg} 0%,
            transparent 70%
          );
          border-radius: 50%;
          z-index: 1;
        }

        .welcome-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          z-index: 2;
          position: relative;
          max-width: 280px;

          .welcome-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(
              135deg,
              ${theme.colorPrimary} 0%,
              ${theme.colorPrimaryActive} 100%
            );
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${theme.colorTextInverse};
            font-size: 24px;
            margin-bottom: ${theme.sizeUnit * 4}px;
            box-shadow: 0 4px 16px ${theme.colorPrimaryBgHover};
            animation: pulse 2s infinite;

            @keyframes pulse {
              0% {
                box-shadow: 0 4px 16px ${theme.colorPrimaryBgHover};
              }
              50% {
                box-shadow: 0 4px 20px ${theme.colorPrimaryBg};
              }
              100% {
                box-shadow: 0 4px 16px ${theme.colorPrimaryBgHover};
              }
            }
          }

          .welcome-title {
            font-size: ${theme.fontSizeXL}px;
            font-weight: ${theme.fontWeightStrong};
            color: ${theme.colorTextHeading};
            margin-bottom: ${theme.sizeUnit * 2}px;
            letter-spacing: -0.02em;
          }

          .welcome-subtitle {
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorTextSecondary};
            margin-bottom: ${theme.sizeUnit * 6}px;
            line-height: 1.5;
          }
        }

        .add-chart-button {
          background: linear-gradient(
            135deg,
            ${theme.colorPrimary} 0%,
            ${theme.colorPrimaryActive} 100%
          );
          border: none;
          border-radius: ${theme.borderRadiusLG}px;
          color: ${theme.colorTextInverse};
          cursor: pointer;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 6}px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: ${theme.fontSize}px;
          font-weight: ${theme.fontWeightMedium};
          box-shadow: 0 4px 12px ${theme.colorPrimaryBgHover};
          position: relative;
          overflow: hidden;
          z-index: 2;
          gap: ${theme.sizeUnit * 2}px;
          min-width: 160px;

          &.disabled {
            background: ${theme.colorBgContainerDisabled};
            color: ${theme.colorTextDisabled};
            cursor: not-allowed;
            box-shadow: none;

            .plus-icon {
              background: ${theme.colorBgTextDisabled};
            }

            &:hover {
              transform: none;
              box-shadow: none;
            }

            &:before {
              display: none;
            }
          }

          &:before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              ${theme.colorBgTextHover},
              transparent
            );
            transition: left 0.6s;
          }

          &:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 8px 24px ${theme.colorPrimaryBg};

            &:before {
              left: 100%;
            }
          }

          &:active {
            transform: translateY(0) scale(0.98);
            box-shadow: 0 2px 8px ${theme.colorPrimaryBgHover};
          }

          .plus-icon {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
            border-radius: 50%;
            background: ${theme.colorBgTextHover};
          }

          .button-text {
            font-size: ${theme.fontSize}px;
            font-weight: ${theme.fontWeightMedium};
            letter-spacing: 0.02em;
          }
        }

        .edit-mode-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          z-index: 2;
          position: relative;
          max-width: 320px;
          gap: ${theme.sizeUnit * 3}px;

          .lock-icon {
            width: 48px;
            height: 48px;
            background: ${theme.colorTextSecondary};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${theme.colorBgContainer};
            font-size: 20px;
            opacity: 0.7;
          }

          .edit-message-title {
            font-size: ${theme.fontSizeLG}px;
            font-weight: ${theme.fontWeightMedium};
            color: ${theme.colorTextHeading};
            margin-bottom: ${theme.sizeUnit}px;
          }

          .edit-message-subtitle {
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorTextSecondary};
            line-height: 1.4;
          }

          .edit-instruction {
            font-size: ${theme.fontSizeXS}px;
            color: ${theme.colorTextTertiary};
            padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
            background: ${theme.colorBgLayoutHeader};
            border-radius: ${theme.borderRadius}px;
            border-left: 3px solid ${theme.colorWarning};
            margin-top: ${theme.sizeUnit * 2}px;
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

  // Get dashboard edit mode from Redux store
  const dashboardEditMode = useSelector(state => state.dashboardState.editMode);

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
      (component.meta.height || DEFAULT_EASY_CHART_HEIGHT_UNITS) *
        GRID_BASE_UNIT -
        CHART_MARGIN,
    );

    return {
      chartWidth: Math.max(width, 300), // Minimum width
      chartHeight: Math.max(height, 200), // Minimum height
    };
  }, [columnWidth, component.meta.height, widthMultiple]);

  // Component updates are handled by parent via onResizeStop callback

  const handleAddChart = () => {
    // Only allow adding charts in edit mode
    if (dashboardEditMode) {
      setIsModalOpen(true);
    }
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
      heightMultiple={component.meta.height || DEFAULT_EASY_CHART_HEIGHT_UNITS}
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
              <div className="header-content">
                <div className="chart-icon">📊</div>
                <span className="title">{t('Chart Placeholder')}</span>
              </div>
              <button
                className="close-button"
                onClick={handleClose}
                type="button"
                title={t('Remove placeholder')}
              >
                ×
              </button>
            </div>

            <div className="content">
              {dashboardEditMode ? (
                // Edit mode - show full welcome experience
                <>
                  <div className="welcome-content">
                    <div className="welcome-icon">📈</div>
                    <div className="welcome-title">
                      {t('Create Your Chart')}
                    </div>
                    <div className="welcome-subtitle">
                      {t(
                        'Start building beautiful visualizations by adding a chart to this container',
                      )}
                    </div>
                  </div>
                  <button
                    className="add-chart-button"
                    onClick={handleAddChart}
                    type="button"
                  >
                    <div className="plus-icon">+</div>
                    <span className="button-text">{t('Add Chart')}</span>
                  </button>
                </>
              ) : (
                // View mode - show instructions to enter edit mode
                <div className="edit-mode-message">
                  <div className="lock-icon">🔒</div>
                  <div className="edit-message-title">
                    {t('Chart Placeholder')}
                  </div>
                  <div className="edit-message-subtitle">
                    {t('This space is reserved for a chart visualization')}
                  </div>
                  <div className="edit-instruction">
                    {t('Enter edit mode to add or modify chart here')}
                  </div>
                </div>
              )}
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
