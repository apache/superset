import dompurify from 'dompurify';
import { snakeCase } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import { Tooltip } from 'react-bootstrap';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger';
import Loading from '../components/Loading';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import StackTraceMessage from '../components/StackTraceMessage';
import ChartProps from '../visualizations/core/models/ChartProps';
import SuperChart from '../visualizations/core/components/SuperChart';
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
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  refreshOverlayVisible: PropTypes.bool,
  errorMessage: PropTypes.node,
  // dashboard callbacks
  addFilter: PropTypes.func,
  onQuery: PropTypes.func,
  onDismissRefreshOverlay: PropTypes.func,
};

const BLANK = {};

const defaultProps = {
  addFilter: () => BLANK,
  filters: BLANK,
  setControlValue() {},
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {};

    this.createChartProps = ChartProps.createSelector();
    this.handleAddFilter = this.handleAddFilter.bind(this);
    this.handleRenderSuccess = this.handleRenderSuccess.bind(this);
    this.handleRenderFailure = this.handleRenderFailure.bind(this);
    this.setTooltip = this.setTooltip.bind(this);
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

  setTooltip(tooltip) {
    this.setState({ tooltip });
  }

  handleAddFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  handleRenderSuccess() {
    const { actions, chartStatus, chartId, vizType } = this.props;
    if (chartStatus !== 'rendered') {
      actions.chartRenderingSucceeded(chartId);
    }

    Logger.append(LOG_ACTIONS_RENDER_CHART, {
      slice_id: chartId,
      viz_type: vizType,
      start_offset: this.renderStartTime,
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  handleRenderFailure(e) {
    const { actions, chartId } = this.props;
    console.warn(e); // eslint-disable-line
    actions.chartRenderingFailed(e, chartId);
  }

  prepareChartProps() {
    const {
      width,
      height,
      annotationData,
      datasource,
      filters,
      formData,
      queryResponse,
      setControlValue,
    } = this.props;

    return this.createChartProps({
      width,
      height,
      annotationData,
      datasource,
      filters,
      formData,
      onAddFilter: this.handleAddFilter,
      onError: this.handleRenderFailure,
      payload: queryResponse,
      setControlValue,
      setTooltip: this.setTooltip,
    });
  }

  renderTooltip() {
    const { tooltip } = this.state;

    if (tooltip) {
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
      width,
      height,
      chartAlert,
      chartStatus,
      errorMessage,
      onDismissRefreshOverlay,
      onQuery,
      queryResponse,
      refreshOverlayVisible,
      vizType,
    } = this.props;

    const isLoading = chartStatus === 'loading';

    // this allows <Loading /> to be positioned in the middle of the chart
    const containerStyles = isLoading ? { height, width } : null;
    const isFaded = refreshOverlayVisible && !errorMessage;
    const skipChartRendering = isLoading || !!chartAlert;
    this.renderStartTime = Logger.getTimestamp();

    return (
      <div
        className={`chart-container ${isLoading ? 'is-loading' : ''}`}
        style={containerStyles}
      >
        {this.renderTooltip()}

        {chartStatus !== 'rendered' && <Loading size={50} />}

        {chartAlert && (
          <StackTraceMessage
            message={chartAlert}
            queryResponse={queryResponse}
          />
        )}

        {!isLoading && !chartAlert && isFaded && (
          <RefreshChartOverlay
            width={width}
            height={height}
            onQuery={onQuery}
            onDismiss={onDismissRefreshOverlay}
          />
        )}

        <SuperChart
          className={`slice_container ${snakeCase(vizType)} ${isFaded ? ' faded' : ''}`}
          chartType={vizType}
          chartProps={skipChartRendering ? null : this.prepareChartProps()}
          onRenderSuccess={this.handleRenderSuccess}
          onRenderFailure={this.handleRenderFailure}
          skipRendering={skipChartRendering}
        />
      </div>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
