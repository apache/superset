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
import { styled, t, logging } from '@superset-ui/core';
import { isEqual } from 'lodash';

import { exportChart, mountExploreUrl } from 'src/explore/exploreUtils';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
} from 'src/logger/LogUtils';
import { areObjectsEqual } from 'src/reduxUtils';
import { FILTER_BOX_MIGRATION_STATES } from 'src/explore/constants';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { URL_PARAMS } from 'src/constants';

import SliceHeader from '../SliceHeader';
import MissingChart from '../MissingChart';
import { slicePropShape, chartPropShape } from '../../util/propShapes';

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
  labelColors: PropTypes.object,
  datasource: PropTypes.object,
  slice: slicePropShape.isRequired,
  sliceName: PropTypes.string.isRequired,
  timeout: PropTypes.number.isRequired,
  maxRows: PropTypes.number.isRequired,
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES,
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
  supersetCanShare: PropTypes.bool.isRequired,
  supersetCanCSV: PropTypes.bool.isRequired,
  sliceCanEdit: PropTypes.bool.isRequired,
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  ownState: PropTypes.object,
  filterState: PropTypes.object,
};

const defaultProps = {
  isCached: false,
  isComponentVisible: true,
};

// we use state + shouldComponentUpdate() logic to prevent perf-wrecking
// resizing across all slices on a dashboard on every update
const RESIZE_TIMEOUT = 350;
const SHOULD_UPDATE_ON_PROP_CHANGES = Object.keys(propTypes).filter(
  prop =>
    prop !== 'width' && prop !== 'height' && prop !== 'isComponentVisible',
);
const OVERFLOWABLE_VIZ_TYPES = new Set(['filter_box']);
const DEFAULT_HEADER_HEIGHT = 22;

const ChartOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;

  &.is-deactivated {
    opacity: 0.5;
    background-color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

export default class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      width: props.width,
      height: props.height,
      descriptionHeight: 0,
    };

    this.changeFilter = this.changeFilter.bind(this);
    this.handleFilterMenuOpen = this.handleFilterMenuOpen.bind(this);
    this.handleFilterMenuClose = this.handleFilterMenuClose.bind(this);
    this.exportCSV = this.exportCSV.bind(this);
    this.exportFullCSV = this.exportFullCSV.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.resize = this.resize.bind(this);
    this.setDescriptionRef = this.setDescriptionRef.bind(this);
    this.setHeaderRef = this.setHeaderRef.bind(this);
    this.getChartHeight = this.getChartHeight.bind(this);
    this.getDescriptionHeight = this.getDescriptionHeight.bind(this);
  }

  shouldComponentUpdate(nextProps, nextState) {
    // this logic mostly pertains to chart resizing. we keep a copy of the dimensions in
    // state so that we can buffer component size updates and only update on the final call
    // which improves performance significantly
    if (
      nextState.width !== this.state.width ||
      nextState.height !== this.state.height ||
      nextState.descriptionHeight !== this.state.descriptionHeight ||
      !isEqual(nextProps.datasource, this.props.datasource)
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

      if (
        nextProps.width !== this.props.width ||
        nextProps.height !== this.props.height
      ) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(this.resize, RESIZE_TIMEOUT);
      }

      for (let i = 0; i < SHOULD_UPDATE_ON_PROP_CHANGES.length; i += 1) {
        const prop = SHOULD_UPDATE_ON_PROP_CHANGES[i];
        // use deep objects equality comparison to prevent
        // unneccessary updates when objects references change
        if (!areObjectsEqual(nextProps[prop], this.props[prop])) {
          return true;
        }
      }
    }

    // `cacheBusterProp` is jected by react-hot-loader
    return this.props.cacheBusterProp !== nextProps.cacheBusterProp;
  }

  componentDidMount() {
    if (this.props.isExpanded) {
      const descriptionHeight = this.getDescriptionHeight();
      this.setState({ descriptionHeight });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.resizeTimeout);
  }

  componentDidUpdate(prevProps) {
    if (this.props.isExpanded !== prevProps.isExpanded) {
      const descriptionHeight = this.getDescriptionHeight();
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ descriptionHeight });
    }
  }

  getDescriptionHeight() {
    return this.props.isExpanded && this.descriptionRef
      ? this.descriptionRef.offsetHeight
      : 0;
  }

  getChartHeight() {
    const headerHeight = this.getHeaderHeight();
    return this.state.height - headerHeight - this.state.descriptionHeight;
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

  logExploreChart = () => {
    this.props.logEvent(LOG_ACTIONS_EXPLORE_DASHBOARD_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
  };

  onExploreChart = async () => {
    try {
      const lastTabId = window.localStorage.getItem('last_tab_id');
      const nextTabId = lastTabId
        ? String(Number.parseInt(lastTabId, 10) + 1)
        : undefined;
      const key = await postFormData(
        this.props.datasource.id,
        this.props.formData,
        this.props.slice.slice_id,
        nextTabId,
      );
      const url = mountExploreUrl(null, {
        [URL_PARAMS.formDataKey.name]: key,
        [URL_PARAMS.sliceId.name]: this.props.slice.slice_id,
      });
      window.open(url, '_blank', 'noreferrer');
    } catch (error) {
      logging.error(error);
      this.props.addDangerToast(t('An error occurred while opening Explore'));
    }
  };

  exportCSV(isFullCSV = false) {
    this.props.logEvent(LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    exportChart({
      formData: isFullCSV
        ? { ...this.props.formData, row_limit: this.props.maxRows }
        : this.props.formData,
      resultType: 'full',
      resultFormat: 'csv',
      force: true,
    });
  }

  exportFullCSV() {
    this.exportCSV(true);
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
      labelColors,
      updateSliceName,
      sliceName,
      toggleExpandSlice,
      timeout,
      supersetCanExplore,
      supersetCanShare,
      supersetCanCSV,
      sliceCanEdit,
      addSuccessToast,
      addDangerToast,
      ownState,
      filterState,
      handleToggleFullSize,
      isFullSize,
      filterboxMigrationState,
    } = this.props;

    const { width } = this.state;
    // this prevents throwing in the case that a gridComponent
    // references a chart that is not associated with the dashboard
    if (!chart || !slice) {
      return <MissingChart height={this.getChartHeight()} />;
    }

    const { queriesResponse, chartUpdateEndTime, chartStatus } = chart;
    const isLoading = chartStatus === 'loading';
    const isDeactivatedViz =
      slice.viz_type === 'filter_box' &&
      [
        FILTER_BOX_MIGRATION_STATES.REVIEWING,
        FILTER_BOX_MIGRATION_STATES.CONVERTED,
      ].includes(filterboxMigrationState);
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
      <div
        className="chart-slice"
        data-test="chart-grid-component"
        data-test-chart-id={id}
        data-test-viz-type={slice.viz_type}
        data-test-chart-name={slice.slice_name}
      >
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
          logExploreChart={this.logExploreChart}
          onExploreChart={this.onExploreChart}
          exportCSV={this.exportCSV}
          exportFullCSV={this.exportFullCSV}
          updateSliceName={updateSliceName}
          sliceName={sliceName}
          supersetCanExplore={supersetCanExplore}
          supersetCanShare={supersetCanShare}
          supersetCanCSV={supersetCanCSV}
          sliceCanEdit={sliceCanEdit}
          componentId={componentId}
          dashboardId={dashboardId}
          filters={filters}
          addSuccessToast={addSuccessToast}
          addDangerToast={addDangerToast}
          handleToggleFullSize={handleToggleFullSize}
          isFullSize={isFullSize}
          chartStatus={chart.chartStatus}
          formData={formData}
        />

        {/*
          This usage of dangerouslySetInnerHTML is safe since it is being used to render
          markdown that is sanitized with bleach. See:
             https://github.com/apache/superset/pull/4390
          and
             https://github.com/apache/superset/commit/b6fcc22d5a2cb7a5e92599ed5795a0169385a825
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
          {(isLoading || isDeactivatedViz) && (
            <ChartOverlay
              className={cx(isDeactivatedViz && 'is-deactivated')}
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
            labelColors={labelColors}
            ownState={ownState}
            filterState={filterState}
            queriesResponse={chart.queriesResponse}
            timeout={timeout}
            triggerQuery={chart.triggerQuery}
            vizType={slice.viz_type}
            isDeactivatedViz={isDeactivatedViz}
            filterboxMigrationState={filterboxMigrationState}
          />
        </div>
      </div>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;
