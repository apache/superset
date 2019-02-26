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
import { Logger, LOG_ACTIONS_RENDER_CHART_CONTAINER } from '../logger/LogUtils';
import Loading from '../components/Loading';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import StackTraceMessage from '../components/StackTraceMessage';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartRenderer from './ChartRenderer';
import './chart.css';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object.isRequired,
  filters: PropTypes.object,
  formData: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  timeout: PropTypes.number,
  vizType: PropTypes.string.isRequired,
  triggerRender: PropTypes.bool,
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
};

const BLANK = {};

const defaultProps = {
  addFilter: () => BLANK,
  filters: BLANK,
  setControlValue() {},
  triggerRender: false,
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleRenderContainerFailure = this.handleRenderContainerFailure.bind(this);
  }
  componentDidMount() {
    if (this.props.triggerQuery) {
      this.props.actions.runQuery(
        this.props.formData,
        false,
        this.props.timeout,
        this.props.chartId,
      );
    }
  }

  handleRenderContainerFailure(error, info) {
    const { actions, chartId } = this.props;
    console.warn(error); // eslint-disable-line
    actions.chartRenderingFailed(error.toString(), chartId, info ? info.componentStack : null);

    actions.logEvent(LOG_ACTIONS_RENDER_CHART_CONTAINER, {
      slice_id: chartId,
      has_err: true,
      error_details: error.toString(),
      start_offset: this.renderStartTime,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  renderStackTraceMessage() {
    const { chartAlert, chartStackTrace, queryResponse } = this.props;
    return (
      <StackTraceMessage
        message={chartAlert}
        link={queryResponse ? queryResponse.link : null}
        stackTrace={chartStackTrace}
      />);
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

    // this allows <Loading /> to be positioned in the middle of the chart
    const containerStyles = isLoading ? { height, width } : null;
    const isFaded = refreshOverlayVisible && !errorMessage;
    this.renderContainerStartTime = Logger.getTimestamp();
    if (chartStatus === 'failed') {
      return this.renderStackTraceMessage();
    }

    return (
      <ErrorBoundary onError={this.handleRenderContainerFailure} showMessage={false}>
        <div
          className={`chart-container ${isLoading ? 'is-loading' : ''}`}
          style={containerStyles}
        >

          {isLoading && <Loading size={50} />}

          {!isLoading && !chartAlert && isFaded && (
            <RefreshChartOverlay
              width={width}
              height={height}
              onQuery={onQuery}
            />
          )}
          <div className={`slice_container ${isFaded ? ' faded' : ''}`}>
            <ChartRenderer
              {...this.props}
            />
          </div>
        </div>
      </ErrorBoundary>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
