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
import Alert from 'src/components/Alert';
import { styled, logging, t } from '@superset-ui/core';

import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import Button from 'src/components/Button';
import Loading from 'src/components/Loading';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartRenderer from './ChartRenderer';
import { ChartErrorMessage } from './ChartErrorMessage';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger/LogUtils';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object,
  // current chart is included by dashboard
  dashboardId: PropTypes.number,
  // original selected values for FilterBox viz
  // so that FilterBox can pre-populate selected values
  // only affect UI control
  initialValues: PropTypes.object,
  // formData contains chart's own filter parameter
  // and merged with extra filter that current dashboard applying
  formData: PropTypes.object.isRequired,
  labelColors: PropTypes.object,
  width: PropTypes.number,
  height: PropTypes.number,
  setControlValue: PropTypes.func,
  timeout: PropTypes.number,
  vizType: PropTypes.string.isRequired,
  triggerRender: PropTypes.bool,
  isFiltersInitialized: PropTypes.bool,
  isDeactivatedViz: PropTypes.bool,
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartStackTrace: PropTypes.string,
  queriesResponse: PropTypes.arrayOf(PropTypes.object),
  triggerQuery: PropTypes.bool,
  refreshOverlayVisible: PropTypes.bool,
  errorMessage: PropTypes.node,
  // dashboard callbacks
  addFilter: PropTypes.func,
  onQuery: PropTypes.func,
  onFilterMenuOpen: PropTypes.func,
  onFilterMenuClose: PropTypes.func,
  ownState: PropTypes.object,
};

const BLANK = {};
const NONEXISTENT_DATASET = t(
  'The dataset associated with this chart no longer exists',
);

const defaultProps = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue() {},
  triggerRender: false,
  dashboardId: null,
  chartStackTrace: null,
  isDeactivatedViz: false,
};

const Styles = styled.div`
  min-height: ${p => p.height}px;
  position: relative;

  .chart-tooltip {
    opacity: 0.75;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
  }
`;

const RefreshOverlayWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleRenderContainerFailure =
      this.handleRenderContainerFailure.bind(this);
  }

  componentDidMount() {
    // during migration, hold chart queries before user choose review or cancel
    if (
      this.props.triggerQuery &&
      this.props.filterboxMigrationState !== 'UNDECIDED'
    ) {
      this.runQuery();
    }
  }

  componentDidUpdate() {
    // during migration, hold chart queries before user choose review or cancel
    if (
      this.props.triggerQuery &&
      this.props.filterboxMigrationState !== 'UNDECIDED'
    ) {
      // if the chart is deactivated (filter_box), only load once
      if (this.props.isDeactivatedViz && this.props.queriesResponse) {
        return;
      }
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
        this.props.ownState,
      );
    } else {
      // Create chart with POST request
      this.props.actions.postChartFormData(
        this.props.formData,
        false,
        this.props.timeout,
        this.props.chartId,
        this.props.dashboardId,
        this.props.ownState,
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

  renderErrorMessage(queryResponse) {
    const {
      chartId,
      chartAlert,
      chartStackTrace,
      datasource,
      dashboardId,
      height,
    } = this.props;

    const error = queryResponse?.errors?.[0];
    const message = chartAlert || queryResponse?.message;

    // if datasource is still loading, don't render JS errors
    if (
      chartAlert !== undefined &&
      chartAlert !== NONEXISTENT_DATASET &&
      datasource === PLACEHOLDER_DATASOURCE
    ) {
      return (
        <Styles
          data-ui-anchor="chart"
          className="chart-container"
          data-test="chart-container"
          height={height}
        >
          <Loading />
        </Styles>
      );
    }

    return (
      <ChartErrorMessage
        chartId={chartId}
        error={error}
        subtitle={message}
        copyText={message}
        link={queryResponse ? queryResponse.link : null}
        source={dashboardId ? 'dashboard' : 'explore'}
        stackTrace={chartStackTrace}
      />
    );
  }

  render() {
    const {
      height,
      chartAlert,
      chartStatus,
      errorMessage,
      onQuery,
      refreshOverlayVisible,
      queriesResponse = [],
      isDeactivatedViz = false,
      width,
    } = this.props;

    const isLoading = chartStatus === 'loading';
    const isFaded = refreshOverlayVisible && !errorMessage;
    this.renderContainerStartTime = Logger.getTimestamp();
    if (chartStatus === 'failed') {
      return queriesResponse.map(item => this.renderErrorMessage(item));
    }

    if (errorMessage) {
      return (
        <Alert
          data-test="alert-warning"
          message={errorMessage}
          type="warning"
        />
      );
    }

    return (
      <ErrorBoundary
        onError={this.handleRenderContainerFailure}
        showMessage={false}
      >
        <Styles
          data-ui-anchor="chart"
          className="chart-container"
          data-test="chart-container"
          height={height}
          width={width}
        >
          <div
            className={`slice_container ${isFaded ? ' faded' : ''}`}
            data-test="slice-container"
          >
            <ChartRenderer {...this.props} data-test={this.props.vizType} />
          </div>

          {!isLoading && !chartAlert && isFaded && (
            <RefreshOverlayWrapper>
              <Button onClick={onQuery} buttonStyle="primary">
                {t('Run query')}
              </Button>
            </RefreshOverlayWrapper>
          )}

          {isLoading && !isDeactivatedViz && <Loading />}
        </Styles>
      </ErrorBoundary>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
