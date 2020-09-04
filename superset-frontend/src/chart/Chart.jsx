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
import PropTypes from 'prop-types';
import React from 'react';
import { Alert } from 'react-bootstrap';
import { styled, logging } from '@superset-ui/core';

import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger/LogUtils';
import Loading from '../components/Loading';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import ErrorMessageWithStackTrace from '../components/ErrorMessage/ErrorMessageWithStackTrace';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartRenderer from './ChartRenderer';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object.isRequired,
  // current chart is included by dashboard
  dashboardId: PropTypes.number,
  // original selected values for FilterBox viz
  // so that FilterBox can pre-populate selected values
  // only affect UI control
  initialValues: PropTypes.object,
  // formData contains chart's own filter parameter
  // and merged with extra filter that current dashboard applying
  formData: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  timeout: PropTypes.number,
  vizType: PropTypes.string.isRequired,
  triggerRender: PropTypes.bool,
  owners: PropTypes.arrayOf(PropTypes.string),
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartStackTrace: PropTypes.string,
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  refreshOverlayVisible: PropTypes.bool,
  errorMessage: PropTypes.node,
  // dashboard callbacks
  addFilter: PropTypes.func,
  onQuery: PropTypes.func,
  onFilterMenuOpen: PropTypes.func,
  onFilterMenuClose: PropTypes.func,
  // id of the last mounted parent tab
  mountedParent: PropTypes.string,
};

const BLANK = {};

const defaultProps = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue() {},
  triggerRender: false,
  dashboardId: null,
  chartStackTrace: null,
};

const Styles = styled.div`
  .chart-tooltip {
    opacity: 0.75;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
  }
`;

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleRenderContainerFailure = this.handleRenderContainerFailure.bind(
      this,
    );
  }

  componentDidMount() {
    if (this.props.triggerQuery) {
      this.runQuery();
    }
  }

  componentDidUpdate() {
    if (this.props.triggerQuery) {
      this.runQuery();
    }
  }

  runQuery() {
    if (this.props.chartId > 0 && isFeatureEnabled(FeatureFlag.CLIENT_CACHE)) {
      // Load saved chart with a GET request
      this.props.actions.getSavedChart(
        this.props.formData,
        false,
        this.props.timeout,
        this.props.chartId,
        this.props.dashboardId,
      );
    } else {
      // Create chart with POST request
      this.props.actions.postChartFormData(
        this.props.formData,
        false,
        this.props.timeout,
        this.props.chartId,
        this.props.dashboardId,
      );
    }
  }

  handleRenderContainerFailure(error, info) {
    const { actions, chartId } = this.props;
    logging.warn(error);
    actions.chartRenderingFailed(
      error.toString(),
      chartId,
      info ? info.componentStack : null,
    );

    actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
      slice_id: chartId,
      has_err: true,
      error_details: error.toString(),
      start_offset: this.renderStartTime,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  renderErrorMessage() {
    const {
      chartAlert,
      chartStackTrace,
      dashboardId,
      owners,
      queryResponse,
    } = this.props;

    const error = queryResponse?.errors?.[0];
    if (error) {
      const extra = error.extra || {};
      extra.owners = owners;
      error.extra = extra;
    }
    return (
      <ErrorMessageWithStackTrace
        error={error}
        message={chartAlert || queryResponse?.message}
        link={queryResponse ? queryResponse.link : null}
        source={dashboardId ? 'dashboard' : 'explore'}
        stackTrace={chartStackTrace}
      />
    );
  }

  render() {
    const {
      width,
      height,
      chartAlert,
      chartStatus,
      errorMessage,
      onQuery,
      refreshOverlayVisible,
    } = this.props;

    const isLoading = chartStatus === 'loading';

    const isFaded = refreshOverlayVisible && !errorMessage;
    this.renderContainerStartTime = Logger.getTimestamp();
    if (chartStatus === 'failed') {
      return this.renderErrorMessage();
    }
    if (errorMessage) {
      return <Alert bsStyle="warning">{errorMessage}</Alert>;
    }
    return (
      <ErrorBoundary
        onError={this.handleRenderContainerFailure}
        showMessage={false}
      >
        <Styles className="chart-container">
          <div className={`slice_container ${isFaded ? ' faded' : ''}`}>
            <ChartRenderer {...this.props} data-test={this.props.vizType} />
          </div>

          {!isLoading && !chartAlert && isFaded && (
            <RefreshChartOverlay
              width={width}
              height={height}
              onQuery={onQuery}
            />
          )}

          {isLoading && <Loading />}
        </Styles>
      </ErrorBoundary>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
