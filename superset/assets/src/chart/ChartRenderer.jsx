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
import dompurify from 'dompurify';
import { snakeCase } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { Tooltip } from 'react-bootstrap';
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

class ChartRenderer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};

    this.hasQueryResponseChange = false;

    this.setTooltip = this.setTooltip.bind(this);
    this.handleAddFilter = this.handleAddFilter.bind(this);
    this.handleRenderSuccess = this.handleRenderSuccess.bind(this);
    this.handleRenderFailure = this.handleRenderFailure.bind(this);
    this.handleSetControlValue = this.handleSetControlValue.bind(this);

    this.hooks = {
      onAddFilter: this.handleAddFilter,
      onError: this.handleRenderFailure,
      setControlValue: this.handleSetControlValue,
      setTooltip: this.setTooltip,
      onFilterMenuOpen: this.props.onFilterMenuOpen,
      onFilterMenuClose: this.props.onFilterMenuClose,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    const resultsReady =
      nextProps.queryResponse &&
      ['success', 'rendered'].indexOf(nextProps.chartStatus) > -1 &&
      !nextProps.queryResponse.error &&
      !nextProps.refreshOverlayVisible;

    if (resultsReady) {
      this.hasQueryResponseChange =
        nextProps.queryResponse !== this.props.queryResponse;

      if (this.hasQueryResponseChange ||
        nextProps.annotationData !== this.props.annotationData ||
        nextProps.height !== this.props.height ||
        nextProps.width !== this.props.width ||
        nextState.tooltip !== this.state.tooltip ||
        nextProps.triggerRender ||
        nextProps.formData.color_scheme !== this.props.formData.color_scheme) {
        return true;
      }
    }
    return false;
  }

  setTooltip(tooltip) {
    this.setState({ tooltip });
  }

  handleAddFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  handleRenderSuccess() {
    const { actions, chartStatus, chartId, vizType } = this.props;
    if (['loading', 'rendered'].indexOf(chartStatus) < 0) {
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
    actions.chartRenderingFailed(error.toString(), chartId, info ? info.componentStack : null);

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

  renderTooltip() {
    const { tooltip } = this.state;
    if (tooltip && tooltip.content) {
      return (
        <Tooltip
          className="chart-tooltip"
          id="chart-tooltip"
          placement="right"
          positionTop={tooltip.y + 30}
          positionLeft={tooltip.x + 30}
          arrowOffsetTop={10}
        >
          {typeof (tooltip.content) === 'string' ?
            <div // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: dompurify.sanitize(tooltip.content) }}
            />
            : tooltip.content
          }
        </Tooltip>
      );
    }
    return null;
  }

  render() {
    const {
      chartAlert,
      chartStatus,
      vizType,
      chartId,
    } = this.props;

    // Skip chart rendering
    if (chartStatus === 'loading' || !!chartAlert || chartStatus === null) {
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

    return (
      <React.Fragment>
        {this.renderTooltip()}
        <SuperChart
          disableErrorBoundary
          id={`chart-id-${chartId}`}
          className={`${snakeCase(vizType)}`}
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
      </React.Fragment>
    );
  }
}

ChartRenderer.propTypes = propTypes;
ChartRenderer.defaultProps = defaultProps;

export default ChartRenderer;
