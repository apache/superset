import dompurify from 'dompurify';
import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-bootstrap';
import Loading from '../components/Loading';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger';
import StackTraceMessage from '../components/StackTraceMessage';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import ChartProps from '../visualizations/core/models/ChartProps';
import SuperChart from '../visualizations/core/components/SuperChart';
import './chart.css';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object.isRequired,
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
  getFilters: PropTypes.func,
  onQuery: PropTypes.func,
  onDismissRefreshOverlay: PropTypes.func,
};

const defaultProps = {
  addFilter: () => ({}),
  getFilters: () => ({}),
  setControlValue() {},
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
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

  prepareChartProps() {
    const {
      width,
      height,
      actions,
      addFilter,
      annotationData,
      chartId,
      datasource,
      formData,
      getFilters,
      queryResponse,
      setControlValue,
    } = this.props;

    return new ChartProps({
      width,
      height,
      annotationData,
      datasource,
      filters: getFilters(),
      formData,
      onAddFilter: (col, vals, merge = true, refresh = true) => {
        addFilter(col, vals, merge, refresh);
      },
      onError: (e) => {
        actions.chartRenderingFailed(e, chartId);
      },
      payload: queryResponse,
      setControlValue,
      setTooltip: (tooltip) => {
        this.setState({ tooltip });
      },
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
      actions,
      chartAlert,
      chartId,
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
    const renderStart = Logger.getTimestamp();

    return (
      <div
        className={`chart-container ${isLoading ? 'is-loading' : ''}`}
        style={containerStyles}
      >
        {this.renderTooltip()}

        {isLoading && <Loading size={50} />}

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

        {!isLoading && !chartAlert && (
          <SuperChart
            className={`slice_container ${vizType} ${isFaded ? ' faded' : ''}`}
            chartType={vizType}
            chartProps={this.prepareChartProps()}
            onRenderSuccess={() => {
              if (chartStatus !== 'rendered') {
                actions.chartRenderingSucceeded(chartId);
              }

              Logger.append(LOG_ACTIONS_RENDER_CHART, {
                slice_id: chartId,
                viz_type: vizType,
                start_offset: renderStart,
                duration: Logger.getTimestamp() - renderStart,
              });
            }}
            onRenderFailure={(e) => {
              console.warn(e); // eslint-disable-line
              actions.chartRenderingFailed(e, chartId);
            }}
          />
        )}
      </div>
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
