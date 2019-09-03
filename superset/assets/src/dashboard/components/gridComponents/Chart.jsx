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
import { exportChart } from '../../../explore/exploreUtils';
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

const propTypes = {
  id: PropTypes.number.isRequired,
  componentId: PropTypes.string.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  updateSliceName: PropTypes.func.isRequired,
  isComponentVisible: PropTypes.bool,

  // from redux
  chart: chartPropShape.isRequired,
  formData: PropTypes.object.isRequired,
  datasource: PropTypes.object.isRequired,
  slice: slicePropShape.isRequired,
  sliceName: PropTypes.string.isRequired,
  timeout: PropTypes.number.isRequired,
  filters: PropTypes.object.isRequired,
  refreshChart: PropTypes.func.isRequired,
  logEvent: PropTypes.func.isRequired,
  toggleExpandSlice: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,
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

class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      width: props.width,
      height: props.height,
    };

    this.changeFilter = this.changeFilter.bind(this);
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

    return false;
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

  exploreChart() {
    this.props.logEvent(LOG_ACTIONS_EXPLORE_DASHBOARD_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    exportChart(this.props.formData);
  }

  exportCSV() {
    this.props.logEvent(LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    exportChart(this.props.formData, 'csv');
  }

  forceRefresh() {
    this.props.logEvent(LOG_ACTIONS_FORCE_REFRESH_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
    return this.props.refreshChart(this.props.chart, true, this.props.timeout);
  }

  render() {
    const {
      id,
      componentId,
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
    } = this.props;

    const { width } = this.state;

    // this prevents throwing in the case that a gridComponent
    // references a chart that is not associated with the dashboard
    if (!chart || !slice) {
      return <MissingChart height={this.getChartHeight()} />;
    }

    const { queryResponse, chartUpdateEndTime } = chart;
    const isCached = queryResponse && queryResponse.is_cached;
    const cachedDttm = queryResponse && queryResponse.cached_dttm;
    const isOverflowable = OVERFLOWABLE_VIZ_TYPES.has(slice.viz_type);

    return (
      <div>
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
          filters={filters}
          addDangerToast={addDangerToast}
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
          <ChartContainer
            width={width}
            height={this.getChartHeight()}
            addFilter={this.changeFilter}
            annotationData={chart.annotationData}
            chartAlert={chart.chartAlert}
            chartId={id}
            chartStatus={chart.chartStatus}
            datasource={datasource}
            initialValues={filters[id]}
            formData={formData}
            queryResponse={chart.queryResponse}
            timeout={timeout}
            triggerQuery={chart.triggerQuery}
            vizType={slice.viz_type}
          />
        </div>
      </div>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
