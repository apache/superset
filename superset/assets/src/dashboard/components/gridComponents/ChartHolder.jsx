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
import { componentShape } from '../../util/propShapes';
import { ROW_TYPE, COLUMN_TYPE } from '../../util/componentTypes';

import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  IN_COMPONENT_ELEMENT_TYPES,
} from '../../util/constants';

const CHART_MARGIN = 32;

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  directPathToChild: PropTypes.arrayOf(PropTypes.string),

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
};

class ChartHolder extends React.Component {
  static renderInFocusCSS(labelName) {
    return (
      <style>
        {`.inFocus label[for=${labelName}] + .Select .Select-control {
                    border: 2px solid #00736a;
           }`}
      </style>
    );
  }

  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };

    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleUpdateSliceName = this.handleUpdateSliceName.bind(this);
  }

  getChartAndLabelComponentIdFromPath() {
    const { directPathToChild = [] } = this.props;
    const result = {};

    if (directPathToChild.length > 0) {
      const currentPath = directPathToChild.slice();

      while (currentPath.length) {
        const componentId = currentPath.pop();
        const componentType = componentId.split('-')[0];

        result[componentType.toLowerCase()] = componentId;
        if (!IN_COMPONENT_ELEMENT_TYPES.includes(componentType)) {
          break;
        }
      }
    }

    return result;
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
    } = this.props;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    const {
      label: labelName,
      chart: chartComponentId,
    } = this.getChartAndLabelComponentIdFromPath();
    const inFocus = chartComponentId === component.id;

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
                inFocus ? 'inFocus' : ''
              }`}
            >
              {!editMode && (
                <AnchorLink anchorLinkId={component.id} inFocus={inFocus} />
              )}
              {inFocus && ChartHolder.renderInFocusCSS(labelName)}
              <Chart
                componentId={component.id}
                id={component.meta.chartId}
                width={Math.floor(
                  widthMultiple * columnWidth +
                    (widthMultiple - 1) * GRID_GUTTER_SIZE -
                    CHART_MARGIN,
                )}
                height={Math.floor(
                  component.meta.height * GRID_BASE_UNIT - CHART_MARGIN,
                )}
                sliceName={component.meta.sliceName || ''}
                updateSliceName={this.handleUpdateSliceName}
                isComponentVisible={isComponentVisible}
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
