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
import cx from 'classnames';
import { useTheme } from '@superset-ui/core';
import { useSelector, connect } from 'react-redux';

import { getChartIdsInFilterScope } from 'src/dashboard/util/activeDashboardFilters';
import Chart from '../../containers/Chart';
import AnchorLink from '../../../components/AnchorLink';
import DeleteComponentButton from '../DeleteComponentButton';
import DragDroppable from '../dnd/DragDroppable';
import HoverMenu from '../menu/HoverMenu';
import ResizableContainer from '../resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from '../../util/getChartAndLabelComponentIdFromPath';
import { componentShape } from '../../util/propShapes';
import { COLUMN_TYPE, ROW_TYPE } from '../../util/componentTypes';

import {
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
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
  focusedFilterScope: PropTypes.object,
  fullSizeChartId: PropTypes.oneOf([PropTypes.number, null]),

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
  setFullSizeChartId: PropTypes.func.isRequired,
};

const defaultProps = {
  directPathToChild: [],
  directPathLastUpdated: 0,
};

/**
 * Selects the chart scope of the filter input that has focus.
 *
 * @returns {{chartId: number, scope: { scope: string[], immune: string[] }} | null }
 * the scope of the currently focused filter, if any
 */
function selectFocusedFilterScope(dashboardState, dashboardFilters) {
  if (!dashboardState.focusedFilterField) return null;
  const { chartId, column } = dashboardState.focusedFilterField;
  return {
    chartId,
    scope: dashboardFilters[chartId].scopes[column],
  };
}

/**
 * Renders any styles necessary to highlight the chart's relationship to the focused filter.
 *
 * If there is no focused filter scope (i.e. most of the time), this will be just a pass-through.
 *
 * If the chart is outside the scope of the focused filter, dims the chart.
 *
 * If the chart is in the scope of the focused filter,
 * renders a highlight around the chart.
 *
 * If ChartHolder were a function component, this could be implemented as a hook instead.
 */
const FilterFocusHighlight = React.forwardRef(
  ({ chartId, ...otherProps }, ref) => {
    const theme = useTheme();

    const nativeFilters = useSelector(state => state.nativeFilters);
    const dashboardState = useSelector(state => state.dashboardState);
    const dashboardFilters = useSelector(state => state.dashboardFilters);
    const focusedFilterScope = selectFocusedFilterScope(
      dashboardState,
      dashboardFilters,
    );
    const focusedNativeFilterId = nativeFilters.focusedFilterId;
    if (!(focusedFilterScope || focusedNativeFilterId))
      return <div ref={ref} {...otherProps} />;

    // we use local styles here instead of a conditionally-applied class,
    // because adding any conditional class to this container
    // causes performance issues in Chrome.

    // default to the "de-emphasized" state
    const unfocusedChartStyles = { opacity: 0.3, pointerEvents: 'none' };
    const focusedChartStyles = {
      borderColor: theme.colors.primary.light2,
      opacity: 1,
      boxShadow: `0px 0px ${theme.gridUnit * 2}px ${theme.colors.primary.base}`,
      pointerEvents: 'auto',
    };

    if (focusedNativeFilterId) {
      if (
        nativeFilters.filters[focusedNativeFilterId]?.chartsInScope?.includes(
          chartId,
        )
      ) {
        return <div ref={ref} style={focusedChartStyles} {...otherProps} />;
      }
    } else if (
      chartId === focusedFilterScope.chartId ||
      getChartIdsInFilterScope({
        filterScope: focusedFilterScope.scope,
      }).includes(chartId)
    ) {
      return <div ref={ref} style={focusedChartStyles} {...otherProps} />;
    }

    // inline styles are used here due to a performance issue when adding/changing a class, which causes a reflow
    return <div ref={ref} style={unfocusedChartStyles} {...otherProps} />;
  },
);

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
          sliceNameOverride: nextName,
        },
      },
    });
  }

  handleToggleFullSize() {
    const { component, fullSizeChartId, setFullSizeChartId } = this.props;
    const { chartId } = component.meta;
    const isFullSize = fullSizeChartId === chartId;
    setFullSizeChartId(isFullSize ? null : chartId);
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
      fullSizeChartId,
    } = this.props;

    const { chartId } = component.meta;
    const isFullSize = fullSizeChartId === chartId;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    let chartWidth = 0;
    let chartHeight = 0;

    if (isFullSize) {
      chartWidth = window.innerWidth - CHART_MARGIN;
      chartHeight = window.innerHeight - CHART_MARGIN;
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
            <FilterFocusHighlight
              chartId={chartId}
              ref={dragSourceRef}
              data-test="dashboard-component-chart-holder"
              className={cx(
                'dashboard-component',
                'dashboard-component-chart-holder',
                this.state.outlinedComponentId ? 'fade-in' : 'fade-out',
                isFullSize && 'full-size',
              )}
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
                sliceName={
                  component.meta.sliceNameOverride ||
                  component.meta.sliceName ||
                  ''
                }
                updateSliceName={this.handleUpdateSliceName}
                isComponentVisible={isComponentVisible}
                handleToggleFullSize={this.handleToggleFullSize}
                isFullSize={isFullSize}
              />
              {editMode && (
                <HoverMenu position="top">
                  <div data-test="dashboard-delete-component-button">
                    <DeleteComponentButton
                      onDelete={this.handleDeleteComponent}
                    />
                  </div>
                </HoverMenu>
              )}
            </FilterFocusHighlight>

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </ResizableContainer>
        )}
      </DragDroppable>
    );
  }
}

ChartHolder.propTypes = propTypes;
ChartHolder.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    directPathToChild: state.dashboardState.directPathToChild,
    directPathLastUpdated: state.dashboardState.directPathLastUpdated,
  };
}
export default connect(mapStateToProps)(ChartHolder);
