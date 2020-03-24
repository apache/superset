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
import { setConfig } from 'react-hot-loader';
import dompurify from 'dompurify';
import { snakeCase } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger/LogUtils';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object.isRequired,
  initialValues: PropTypes.object,
  formData: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  vizType: PropTypes.string.isRequired,
  triggerRender: PropTypes.bool,
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  refreshOverlayVisible: PropTypes.bool,
  // dashboard callbacks
  addFilter: PropTypes.func,
  onFilterMenuOpen: PropTypes.func,
  onFilterMenuClose: PropTypes.func,
};

const BLANK = {};

const defaultProps = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue() {},
  triggerRender: false,
};

const isDevMode = process.env.WEBPACK_MODE === 'development';
if (isDevMode) {
  setConfig({ logLevel: 'debug', trackTailUpdates: false });
}

/**
 * Compare two objects with DFS (till a maxDepth)
 */
function deepEqual(obj1, obj2, maxDepth = Infinity, depth = 0) {
  if (
    // don't go too deep
    depth > maxDepth ||
    // nulls
    obj1 === null ||
    obj2 === null ||
    // primatives
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object'
  ) {
    return obj1 === obj2;
  }

  // arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    return (
      obj1.length === obj2.length &&
      obj1.every((val, i) => deepEqual(val, obj2[i], maxDepth, depth + 1))
    );
  }

  // objects
  for (const [key, val] of Object.entries(obj1)) {
    if (!deepEqual(obj2[key], val, maxDepth, depth + 1)) {
      // console.log('>> Diff "%s":', key, depth, val, obj2[key]);
      return false;
    }
  }
  return true;
}

class ChartRenderer extends React.Component {
  constructor(props) {
    super(props);
    this.hasQueryResponseChange = false;

    this.handleAddFilter = this.handleAddFilter.bind(this);
    this.handleRenderSuccess = this.handleRenderSuccess.bind(this);
    this.handleRenderFailure = this.handleRenderFailure.bind(this);
    this.handleSetControlValue = this.handleSetControlValue.bind(this);

    this.hooks = {
      onAddFilter: this.handleAddFilter,
      onError: this.handleRenderFailure,
      setControlValue: this.handleSetControlValue,
      onFilterMenuOpen: this.props.onFilterMenuOpen,
      onFilterMenuClose: this.props.onFilterMenuClose,
    };
  }

  shouldComponentUpdate(nextProps) {
    // if no results loaded, don't render
    if (
      !nextProps.queryResponse ||
      nextProps.queryResponse.error ||
      nextProps.refreshOverlayVisible
    )
      return false;

    this.hasQueryResponseChange =
      this.props.queryResponse !== nextProps.queryResponse;

    // current chart status
    const chartStatus = this.props.chartStatus;
    // `rendered` status is set right after `success` or `loading`,
    // don't trigger rerender here (see `actions.chartRenderingSucceeded`).
    // note that even though render is not triggered, the props will still be
    // updated.
    if (
      (chartStatus === 'success' || chartStatus === 'loading') &&
      nextProps.chartStatus === 'rendered'
    )
      return false;

    // already successfully rendered, only rerender when some prop is updated
    if (chartStatus === 'rendered' || chartStatus === 'success') {
      return !deepEqual(this.props, nextProps, 2);
    }

    return true;
  }

  handleAddFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  handleRenderSuccess() {
    const { actions, chartStatus, chartId, vizType } = this.props;
    if (chartStatus !== 'loading' && chartStatus !== 'rendered') {
      actions.chartRenderingSucceeded(chartId);
    }
    // only log chart render time which is triggered by query results change
    // currently we don't log chart re-render time, like window resize etc
    if (this.hasQueryResponseChange) {
      actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
        slice_id: chartId,
        viz_type: vizType,
        start_offset: this.renderStartTime,
        ts: new Date().getTime(),
        duration: Logger.getTimestamp() - this.renderStartTime,
      });
    }
  }

  handleRenderFailure(error, info) {
    const { actions, chartId } = this.props;
    console.warn(error); // eslint-disable-line
    actions.chartRenderingFailed(
      error.toString(),
      chartId,
      info ? info.componentStack : null,
    );

    // only trigger render log when query is changed
    if (this.hasQueryResponseChange) {
      actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
        slice_id: chartId,
        has_err: true,
        error_details: error.toString(),
        start_offset: this.renderStartTime,
        ts: new Date().getTime(),
        duration: Logger.getTimestamp() - this.renderStartTime,
      });
    }
  }

  handleSetControlValue(...args) {
    const { setControlValue } = this.props;
    if (setControlValue) {
      setControlValue(...args);
    }
  }

  render() {
    const {
      chartAlert,
      chartStatus,
      vizType,
      chartId,
      refreshOverlayVisible,
    } = this.props;

    // Skip chart rendering
    if (
      refreshOverlayVisible ||
      chartStatus === 'loading' ||
      !!chartAlert ||
      chartStatus === null
    ) {
      return null;
    }

    this.renderStartTime = Logger.getTimestamp();

    const {
      width,
      height,
      annotationData,
      datasource,
      initialValues,
      formData,
      queryResponse,
    } = this.props;

    // It's bad practice to use unprefixed `vizType` as classnames for chart
    // container. It may cause css conflicts as in the case of legacy table chart.
    // When migrating charts, we should gradually add a `superset-chart-` prefix
    // to each one of them.
    const snakeCaseVizType = snakeCase(vizType);
    const chartClassName =
      vizType === 'table'
        ? `superset-chart-${snakeCaseVizType}`
        : snakeCaseVizType;

    // Use this line to make sure charts do not render unnecessarily.
    // console.log('>>> %s rendered', this.props.chartId);

    return (
      <SuperChart
        key={`${chartId}-${isDevMode ? Date.now() : ''}`}
        disableErrorBoundary
        id={`chart-id-${chartId}`}
        className={chartClassName}
        chartType={vizType}
        width={width}
        height={height}
        annotationData={annotationData}
        datasource={datasource}
        initialValues={initialValues}
        formData={formData}
        hooks={this.hooks}
        queryData={queryResponse}
        onRenderSuccess={this.handleRenderSuccess}
        onRenderFailure={this.handleRenderFailure}
      />
    );
  }
}

ChartRenderer.propTypes = propTypes;
ChartRenderer.defaultProps = defaultProps;

export default ChartRenderer;
