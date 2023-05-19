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
import {
  ensureIsArray,
  FeatureFlag,
  logging,
  styled,
  t,
} from '@superset-ui/core';
import { isFeatureEnabled } from 'src/featureFlags';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import Loading from 'src/components/Loading';
import { EmptyStateBig } from 'src/components/EmptyState';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { isCurrentUserBot } from 'src/utils/isBot';
import { ChartSource } from 'src/types/ChartSource';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import ChartRenderer from './ChartRenderer';
import { ChartErrorMessage } from './ChartErrorMessage';
import { getChartRequiredFieldsMissingMessage } from '../../utils/getChartRequiredFieldsMissingMessage';

// Type definitions for PropTypes

interface AnnotationDataProps {
  [key: string]: any;
}

interface ActionsProps {
  getSavedChart: (
    formData: any,
    force?: boolean,
    timeout?: number,
    chartId: number,
    dashboardId?: number,
    ownState?: any,
  ) => Promise<any>;
  postChartFormData: (
    formData: any,
    force?: boolean,
    timeout?: number,
    chartId: number,
    dashboardId?: number,
    ownState?: any,
  ) => Promise<any>;
  chartRenderingFailed: (
    error: string,
    chartId: number,
    componentStack?: string,
  ) => void;
  logEvent: (eventName: string, eventData: any) => void;
}

interface ChartProps {
  annotationData: AnnotationDataProps;
  actions: ActionsProps;
  chartId: number;
  datasource: any;
  dashboardId?: number;
  initialValues: any;
  formData: any;
  labelColors: any;
  sharedLabelColors: any;
  width: number;
  height: number;
  setControlValue: (key: string, value: any) => void;
  timeout: number;
  vizType: string;
  triggerRender: boolean;
  force: boolean;
  isFiltersInitialized: boolean;
  chartAlert?: string;
  chartStatus?: string;
  chartStackTrace?: string;
  queriesResponse?: any[];
  triggerQuery: boolean;
  chartIsStale: boolean;
  errorMessage?: React.Node;
  addFilter: () => any;
  onQuery: () => any;
  onFilterMenuOpen: () => any;
  onFilterMenuClose: () => any;
  ownState: any;
  postTransformProps: () => any;
  datasetsStatus: 'loading' | 'error' | 'complete';
  isInView: boolean;
  emitCrossFilters: boolean;
}

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
  force: false,
  isInView: true,
};

const Styles = styled.div`
  min-height: ${p => p.height}px;
  position: relative;

  .chart-tooltip {
    opacity: 0.75;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
  }

  .slice_container {
    display: flex;
    flex-direction: column;
    justify-content: center;

    height: ${p => p.height}px;

    .pivot_table tbody tr {
      font-feature-settings: 'tnum' 1;
    }

    .alert {
      margin: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
`;
const MonospaceDiv = styled.div`
  font-family: ${({ theme }) => theme.typography.families.monospace};
  word-break: break-word;
  overflow-x: auto;
  white-space: pre-wrap;
`;
class Chart extends React.PureComponent<ChartProps> {
  constructor(props) {
    super(props);
    this.handleRenderContainerFailure =
      this.handleRenderContainerFailure.bind(this);
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
        this.props.force || getUrlParam(URL_PARAMS.force), // allow override via url params force=true
        this.props.timeout,
        this.props.chartId,
        this.props.dashboardId,
        this.props.ownState,
      );
    } else {
      // Create chart with POST request
      this.props.actions.postChartFormData(
        this.props.formData,
        this.props.force || getUrlParam(URL_PARAMS.force), // allow override via url params force=true
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
      datasetsStatus,
    } = this.props;
    const error = queryResponse?.errors?.[0];
    const message = chartAlert || queryResponse?.message;

    // if datasource is still loading, don't render JS errors
    if (
      chartAlert !== undefined &&
      chartAlert !== NONEXISTENT_DATASET &&
      datasource === PLACEHOLDER_DATASOURCE &&
      datasetsStatus !== ResourceStatus.ERROR
    ) {
      return (
        <Styles
          key={chartId}
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
        key={chartId}
        chartId={chartId}
        error={error}
        subtitle={<MonospaceDiv>{message}</MonospaceDiv>}
        copyText={message}
        link={queryResponse ? queryResponse.link : null}
        source={dashboardId ? ChartSource.Dashboard : ChartSource.Explore}
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
      chartIsStale,
      queriesResponse = [],
      width,
    } = this.props;

    const isLoading = chartStatus === 'loading';
    this.renderContainerStartTime = Logger.getTimestamp();
    if (chartStatus === 'failed') {
      return queriesResponse.map(item => this.renderErrorMessage(item));
    }

    if (errorMessage && ensureIsArray(queriesResponse).length === 0) {
      return (
        <EmptyStateBig
          title={t('Add required control values to preview chart')}
          description={getChartRequiredFieldsMissingMessage(true)}
          image="chart.svg"
        />
      );
    }

    if (
      !isLoading &&
      !chartAlert &&
      !errorMessage &&
      chartIsStale &&
      ensureIsArray(queriesResponse).length === 0
    ) {
      return (
        <EmptyStateBig
          title={t('Your chart is ready to go!')}
          description={
            <span>
              {t(
                'Click on "Create chart" button in the control panel on the left to preview a visualization or',
              )}{' '}
              <span role="button" tabIndex={0} onClick={this.props.onQuery}>
                {t('click here')}
              </span>
              .
            </span>
          }
          image="chart.svg"
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
          <div className="slice_container" data-test="slice-container">
            {this.props.isInView ||
            !isFeatureEnabled(FeatureFlag.DASHBOARD_VIRTUALIZATION) ||
            isCurrentUserBot() ? (
              <ChartRenderer
                {...this.props}
                source={this.props.dashboardId ? 'dashboard' : 'explore'}
                data-test={this.props.vizType}
              />
            ) : (
              <Loading />
            )}
          </div>
          {isLoading && <Loading />}
        </Styles>
      </ErrorBoundary>
    );
  }
}

Chart.defaultProps = defaultProps;

export default Chart;
