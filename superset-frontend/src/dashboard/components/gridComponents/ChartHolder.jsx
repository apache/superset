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

import FilterIndicators from '../../containers/FilterIndicators';
import Chart from '../../containers/Chart';
import AnchorLink from '../../../components/AnchorLink';
import DeleteComponentButton from '../DeleteComponentButton';
import DragDroppable from '../dnd/DragDroppable';
import HoverMenu from '../menu/HoverMenu';
import ResizableContainer from '../resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from '../../util/getChartAndLabelComponentIdFromPath';
import { componentShape } from '../../util/propShapes';
import { ROW_TYPE, COLUMN_TYPE } from '../../util/componentTypes';

import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
} from '../../util/constants';

const CHART_MARGIN = 32;

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  dashboardId: PropTypes.number.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  directPathToChild: PropTypes.arrayOf(PropTypes.string),
  directPathLastUpdated: PropTypes.number,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
};

const defaultProps = {
  directPathToChild: [],
  directPathLastUpdated: 0,
};

class ChartHolder extends React.Component {
  static renderInFocusCSS(columnName) {
    return (
      <style>
        {`label[for=${columnName}] + .Select .Select__control {
                    border-color: #00736a;
                    transition: border-color 1s ease-in-out;
           }`}
      </style>
    );
  }

  static getDerivedStateFromProps(props, state) {
    const { component, directPathToChild, directPathLastUpdated } = props;
    const {
      label: columnName,
      chart: chartComponentId,
    } = getChartAndLabelComponentIdFromPath(directPathToChild);

    if (
      directPathLastUpdated !== state.directPathLastUpdated &&
      component.id === chartComponentId
    ) {
      return {
        outlinedComponentId: component.id,
        outlinedColumnName: columnName,
        directPathLastUpdated,
      };
    }
    return null;
  }

  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      outlinedComponentId: null,
      outlinedColumnName: null,
      directPathLastUpdated: 0,
      isFullSize: false,
    };

    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleUpdateSliceName = this.handleUpdateSliceName.bind(this);
    this.handleToggleFullSize = this.handleToggleFullSize.bind(this);
  }

  componentDidMount() {
    this.hideOutline({}, this.state);
  }

  componentDidUpdate(prevProps, prevState) {
    this.hideOutline(prevState, this.state);
  }

  hideOutline(prevState, state) {
    const { outlinedComponentId: timerKey } = state;
    const { outlinedComponentId: prevTimerKey } = prevState;

    // because of timeout, there might be multiple charts showing outline
    if (!!timerKey && !prevTimerKey) {
      setTimeout(() => {
        this.setState(() => ({
          outlinedComponentId: null,
          outlinedColumnName: null,
        }));
      }, 2000);
    }
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: nextFocus }));
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleUpdateSliceName(nextName) {
    const { component, updateComponents } = this.props;
    updateComponents({
      [component.id]: {
        ...component,
        meta: {
          ...component.meta,
          sliceName: nextName,
        },
      },
    });
  }

  handleToggleFullSize() {
    this.setState(() => ({ isFullSize: !this.state.isFullSize }));
  }

  render() {
    const { isFocused } = this.state;
    const {
      component,
      parentComponent,
      index,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
      editMode,
      isComponentVisible,
      dashboardId,
    } = this.props;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    let chartWidth = 0;
    let chartHeight = 0;

    if (this.state.isFullSize) {
      chartWidth = document.body.clientWidth - CHART_MARGIN;
      chartHeight = document.body.clientHeight - CHART_MARGIN;
    } else {
      chartWidth = Math.floor(
        widthMultiple * columnWidth +
          (widthMultiple - 1) * GRID_GUTTER_SIZE -
          CHART_MARGIN,
      );
      chartHeight = Math.floor(
        component.meta.height * GRID_BASE_UNIT - CHART_MARGIN,
      );
    }

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
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
              className={`dashboard-component dashboard-component-chart-holder ${
                this.state.outlinedComponentId ? 'fade-in' : 'fade-out'
              } ${this.state.isFullSize ? 'full-size' : ''}`}
            >
              {!editMode && (
                <AnchorLink
                  anchorLinkId={component.id}
                  inFocus={!!this.state.outlinedComponentId}
                />
              )}
              {!!this.state.outlinedComponentId &&
                ChartHolder.renderInFocusCSS(this.state.outlinedColumnName)}
              <Chart
                componentId={component.id}
                id={component.meta.chartId}
                dashboardId={dashboardId}
                width={chartWidth}
                height={chartHeight}
                sliceName={component.meta.sliceName || ''}
                updateSliceName={this.handleUpdateSliceName}
                isComponentVisible={isComponentVisible}
                handleToggleFullSize={this.handleToggleFullSize}
                isFullSize={this.state.isFullSize}
              />
              {!editMode && (
                <FilterIndicators chartId={component.meta.chartId} />
              )}
              {editMode && (
                <HoverMenu position="top">
                  <DeleteComponentButton
                    onDelete={this.handleDeleteComponent}
                  />
                </HoverMenu>
              )}
            </div>

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </ResizableContainer>
        )}
      </DragDroppable>
    );
  }
}

ChartHolder.propTypes = propTypes;
ChartHolder.defaultProps = defaultProps;

export default ChartHolder;
