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
import cx from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { styled } from '@superset-ui/core';

import { exploreChart, exportChart } from '../../../explore/exploreUtils';
import SliceHeader from '../SliceHeader';
import ChartContainer from '../../../chart/ChartContainer';
import MissingChart from '../MissingChart';
import { slicePropShape, chartPropShape } from '../../util/propShapes';
import {
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
} from '../../../logger/LogUtils';
import { isFilterBox } from '../../util/activeDashboardFilters';
import getFilterValuesByFilterId from '../../util/getFilterValuesByFilterId';

const propTypes = {
  id: PropTypes.number.isRequired,
  componentId: PropTypes.string.isRequired,
  dashboardId: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  updateSliceName: PropTypes.func.isRequired,
  isComponentVisible: PropTypes.bool,
  handleToggleFullSize: PropTypes.func.isRequired,

  // from redux
  chart: chartPropShape.isRequired,
  formData: PropTypes.object.isRequired,
  datasource: PropTypes.object.isRequired,
  slice: slicePropShape.isRequired,
  sliceName: PropTypes.string.isRequired,
  timeout: PropTypes.number.isRequired,
  // all active filter fields in dashboard
  filters: PropTypes.object.isRequired,
  refreshChart: PropTypes.func.isRequired,
  logEvent: PropTypes.func.isRequired,
  toggleExpandSlice: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,
  setFocusedFilterField: PropTypes.func.isRequired,
  unsetFocusedFilterField: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  isCached: PropTypes.bool,
  supersetCanExplore: PropTypes.bool.isRequired,
  supersetCanCSV: PropTypes.bool.isRequired,
  sliceCanEdit: PropTypes.bool.isRequired,
  addDangerToast: PropTypes.func.isRequired,
};

const defaultProps = {
  isCached: false,
  isComponentVisible: true,
};

// we use state + shouldComponentUpdate() logic to prevent perf-wrecking
// resizing across all slices on a dashboard on every update
const RESIZE_TIMEOUT = 350;
const SHOULD_UPDATE_ON_PROP_CHANGES = Object.keys(propTypes).filter(
  prop => prop !== 'width' && prop !== 'height',
);
const OVERFLOWABLE_VIZ_TYPES = new Set(['filter_box']);
const DEFAULT_HEADER_HEIGHT = 22;

const ChartOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
`;

export default class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      width: props.width,
      height: props.height,
    };

    this.changeFilter = this.changeFilter.bind(this);
    this.handleFilterMenuOpen = this.handleFilterMenuOpen.bind(this);
    this.handleFilterMenuClose = this.handleFilterMenuClose.bind(this);
    this.exploreChart = this.exploreChart.bind(this);
    this.exportCSV = this.exportCSV.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.resize = this.resize.bind(this);
    this.setDescriptionRef = this.setDescriptionRef.bind(this);
    this.setHeaderRef = this.setHeaderRef.bind(this);
  }

  shouldComponentUpdate(nextProps, nextState) {
    // this logic mostly pertains to chart resizing. we keep a copy of the dimensions in
    // state so that we can buffer component size updates and only update on the final call
    // which improves performance significantly
    if (
      nextState.width !== this.state.width ||
      nextState.height !== this.state.height
    ) {
      return true;
    }

    // allow chart update/re-render only if visible:
    // under selected tab or no tab layout
    if (nextProps.isComponentVisible) {
      if (nextProps.chart.triggerQuery) {
        return true;
      }

      if (nextProps.isFullSize !== this.props.isFullSize) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(this.resize, RESIZE_TIMEOUT);
        return false;
      }

      for (let i = 0; i < SHOULD_UPDATE_ON_PROP_CHANGES.length; i += 1) {
        const prop = SHOULD_UPDATE_ON_PROP_CHANGES[i];
        if (nextProps[prop] !== this.props[prop]) {
          return true;
        }
      }

      if (
        nextProps.width !== this.props.width ||
        nextProps.height !== this.props.height
      ) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(this.resize, RESIZE_TIMEOUT);
      }
    }

    // `cacheBusterProp` is jected by react-hot-loader
    return this.props.cacheBusterProp !== nextProps.cacheBusterProp;
  }

  componentWillUnmount() {
    clearTimeout(this.resizeTimeout);
  }

  getChartHeight() {
    const headerHeight = this.getHeaderHeight();
    const descriptionHeight =
      this.props.isExpanded && this.descriptionRef
        ? this.descriptionRef.offsetHeight
        : 0;

    return this.state.height - headerHeight - descriptionHeight;
  }

  getHeaderHeight() {
    return (
      (this.headerRef && this.headerRef.offsetHeight) || DEFAULT_HEADER_HEIGHT
    );
  }

  setDescriptionRef(ref) {
    this.descriptionRef = ref;
  }

  setHeaderRef(ref) {
    this.headerRef = ref;
  }

  resize() {
    const { width, height } = this.props;
    this.setState(() => ({ width, height }));
  }

  changeFilter(newSelectedValues = {}) {
    this.props.logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {
      id: this.props.chart.id,
      columns: Object.keys(newSelectedValues),
    });
    this.props.changeFilter(this.props.chart.id, newSelectedValues);
  }

  handleFilterMenuOpen(chartId, column) {
    this.props.setFocusedFilterField(chartId, column);
  }

  handleFilterMenuClose(chartId, column) {
    this.props.unsetFocusedFilterField(chartId, column);
  }

  exploreChart() {
    this.props.logEvent(LOG_ACTIONS_EXPLORE_DASHBOARD_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    exploreChart(this.props.formData);
  }

  exportCSV() {
    this.props.logEvent(LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    exportChart({
      formData: this.props.formData,
      resultType: 'results',
      resultFormat: 'csv',
    });
  }

  forceRefresh() {
    this.props.logEvent(LOG_ACTIONS_FORCE_REFRESH_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    return this.props.refreshChart(
      this.props.chart.id,
      true,
      this.props.dashboardId,
    );
  }

  render() {
    const {
      id,
      componentId,
      dashboardId,
      chart,
      slice,
      datasource,
      isExpanded,
      editMode,
      filters,
      formData,
      updateSliceName,
      sliceName,
      toggleExpandSlice,
      timeout,
      supersetCanExplore,
      supersetCanCSV,
      sliceCanEdit,
      addDangerToast,
      handleToggleFullSize,
      isFullSize,
    } = this.props;

    const { width } = this.state;

    // this prevents throwing in the case that a gridComponent
    // references a chart that is not associated with the dashboard
    if (!chart || !slice) {
      return <MissingChart height={this.getChartHeight()} />;
    }

    const { queriesResponse, chartUpdateEndTime, chartStatus } = chart;
    const isLoading = chartStatus === 'loading';
    // eslint-disable-next-line camelcase
    const isCached = queriesResponse?.map(({ is_cached }) => is_cached) || [];
    const cachedDttm =
      // eslint-disable-next-line camelcase
      queriesResponse?.map(({ cached_dttm }) => cached_dttm) || [];
    const isOverflowable = OVERFLOWABLE_VIZ_TYPES.has(slice.viz_type);
    const initialValues = isFilterBox(id)
      ? getFilterValuesByFilterId({
          activeFilters: filters,
          filterId: id,
        })
      : {};
    return (
      <div className="chart-slice">
        <SliceHeader
          innerRef={this.setHeaderRef}
          slice={slice}
          isExpanded={!!isExpanded}
          isCached={isCached}
          cachedDttm={cachedDttm}
          updatedDttm={chartUpdateEndTime}
          toggleExpandSlice={toggleExpandSlice}
          forceRefresh={this.forceRefresh}
          editMode={editMode}
          annotationQuery={chart.annotationQuery}
          exploreChart={this.exploreChart}
          exportCSV={this.exportCSV}
          updateSliceName={updateSliceName}
          sliceName={sliceName}
          supersetCanExplore={supersetCanExplore}
          supersetCanCSV={supersetCanCSV}
          sliceCanEdit={sliceCanEdit}
          componentId={componentId}
          dashboardId={dashboardId}
          filters={filters}
          addDangerToast={addDangerToast}
          handleToggleFullSize={handleToggleFullSize}
          isFullSize={isFullSize}
          chartStatus={chart.chartStatus}
        />

        {/*
          This usage of dangerouslySetInnerHTML is safe since it is being used to render
          markdown that is sanitized with bleach. See:
             https://github.com/apache/incubator-superset/pull/4390
          and
             https://github.com/apache/incubator-superset/commit/b6fcc22d5a2cb7a5e92599ed5795a0169385a825
        */}
        {isExpanded && slice.description_markeddown && (
          <div
            className="slice_description bs-callout bs-callout-default"
            ref={this.setDescriptionRef}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: slice.description_markeddown }}
          />
        )}

        <div
          className={cx(
            'dashboard-chart',
            isOverflowable && 'dashboard-chart--overflowable',
          )}
        >
          {isLoading && (
            <ChartOverlay
              style={{
                width,
                height: this.getChartHeight(),
              }}
            />
          )}

          <ChartContainer
            width={width}
            height={this.getChartHeight()}
            addFilter={this.changeFilter}
            onFilterMenuOpen={this.handleFilterMenuOpen}
            onFilterMenuClose={this.handleFilterMenuClose}
            annotationData={chart.annotationData}
            chartAlert={chart.chartAlert}
            chartId={id}
            chartStatus={chartStatus}
            datasource={datasource}
            dashboardId={dashboardId}
            initialValues={initialValues}
            formData={formData}
            queriesResponse={chart.queriesResponse}
            timeout={timeout}
            triggerQuery={chart.triggerQuery}
            vizType={slice.viz_type}
            owners={slice.owners}
          />
        </div>
      </div>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;
