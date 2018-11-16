import PropTypes from 'prop-types';
import React from 'react';
import { Logger, LOG_ACTIONS_RENDER_CHART_CONTAINER } from '../logger';
import Loading from '../components/Loading';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import StackTraceMessage from '../components/StackTraceMessage';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartRenderer from './ChartRenderer';
import visPromiseLookup from '../visualizations';
import sandboxedEval from '../modules/sandbox';

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
  onDismissRefreshOverlay: PropTypes.func,
  // chart events
  itemClick:PropTypes.func,
};

const BLANK = {};

const defaultProps = {
  addFilter: () => BLANK,
  getFilters: () => BLANK,
  filters: BLANK,
  setControlValue() {},
  triggerRender: false,
  itemClick: () => BLANK,
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    // visualizations are lazy-loaded with promises that resolve to a renderVis function
    this.state = {
      renderVis: null,
    };

    // these properties are used by visualizations
    this.annotationData = props.annotationData;
    this.containerId = props.containerId;
    this.selector = `#${this.containerId}`;
    this.formData = props.formData;
    this.datasource = props.datasource;
    this.addFilter = this.addFilter.bind(this);
    this.getFilters = this.getFilters.bind(this);
    this.headerHeight = this.headerHeight.bind(this);
    this.height = this.height.bind(this);
    this.width = this.width.bind(this);
    this.visPromise = null;
    this.itemClick = this.itemClick.bind(this);
  }

  componentDidMount() {
    if (this.props.triggerQuery) {
      this.props.actions.runQuery(
        this.props.formData,
        false,
        this.props.timeout,
        this.props.chartId,
      );
    } else {
      // when drag/dropping in a dashboard, a chart may be unmounted/remounted but still have data
      this.renderVis();
    }

    this.loadAsyncVis(this.props.vizType);
  }

  componentWillReceiveProps(nextProps) {
    this.annotationData = nextProps.annotationData;
    this.containerId = nextProps.containerId;
    this.selector = `#${this.containerId}`;
    this.formData = nextProps.formData;
    this.datasource = nextProps.datasource;
    if (nextProps.vizType !== this.props.vizType) {
      this.setState(() => ({ renderVis: null }));
      this.loadAsyncVis(nextProps.vizType);
    }
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.queryResponse &&
      ['success', 'rendered'].indexOf(this.props.chartStatus) > -1 &&
      !this.props.queryResponse.error &&
      (prevProps.annotationData !== this.props.annotationData ||
        prevProps.queryResponse !== this.props.queryResponse ||
        prevProps.height !== this.props.height ||
        prevProps.width !== this.props.width ||
        prevProps.lastRendered !== this.props.lastRendered)
    ) {
      this.renderVis();
    }
  }

  componentWillUnmount() {
    this.visPromise = null;
  }

  getFilters() {
    return this.props.getFilters();
  }

  setTooltip(tooltip) {
    this.setState({ tooltip });
  }

  loadAsyncVis(visType) {
    this.visPromise = visPromiseLookup[visType];

    this.visPromise()
      .then((renderVis) => {
        // ensure Component is still mounted
        if (this.visPromise) {
          this.setState({ renderVis }, this.renderVis);
        }
      })
      .catch((error) => {
        console.warn(error); // eslint-disable-line
        this.props.actions.chartRenderingFailed(error, this.props.chartId);
      });
  }

  addFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  itemClick(data){
    this.props.itemClick(data);
  }

  clearError() {
    this.setState({ errorMsg: null });
  }

  width() {
    return (
      this.props.width || (this.container && this.container.el && this.container.el.offsetWidth)
    );
  }

  headerHeight() {
    return this.props.headerHeight || 0;
  }

  height() {
    return (
      this.props.height || (this.container && this.container.el && this.container.el.offsetHeight)
    );
  }

  d3format(col, number) {
    const { datasource } = this.props;
    const format = (datasource.column_formats && datasource.column_formats[col]) || '0.3s';

    return d3format(format, number);
  }

  error(e) {
    this.props.actions.chartRenderingFailed(e, this.props.chartId);
  }

  verboseMetricName(metric) {
    return this.props.datasource.verbose_map[metric] || metric;
  }

  // eslint-disable-next-line camelcase
  render_template(s) {
    const context = {
      width: this.width(),
      height: this.height(),
    };
    return Mustache.render(s, context);
  }

  renderTooltip() {
    if (this.state.tooltip) {
      return (
        <Tooltip
          className="chart-tooltip"
          id="chart-tooltip"
          placement="right"
          positionTop={this.state.tooltip.y - 10}
          positionLeft={this.state.tooltip.x + 30}
          arrowOffsetTop={10}
        >
          <div // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: this.state.tooltip.content }}
          />
        </Tooltip>
      );
    }
  }

  handleRenderFailure(error, info) {
    const { actions, chartId } = this.props;
    console.warn(error); // eslint-disable-line
    actions.chartRenderingFailed(error.toString(), chartId, info ? info.componentStack : null);

    Logger.append(LOG_ACTIONS_RENDER_CHART_CONTAINER, {
      slice_id: chartId,
      has_err: true,
      error_details: error.toString(),
      start_offset: this.renderStartTime,
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  render() {
    const {
      width,
      height,
      chartAlert,
      chartStackTrace,
      chartStatus,
      errorMessage,
      onQuery,
      queryResponse,
      refreshOverlayVisible,
    } = this.props;

    const isLoading = chartStatus === 'loading';

    // this allows <Loading /> to be positioned in the middle of the chart
    const containerStyles = isLoading ? { height, width } : null;
    const isFaded = refreshOverlayVisible && !errorMessage;
    this.renderContainerStartTime = Logger.getTimestamp();

    return (
      <ErrorBoundary onError={this.handleRenderContainerFailure} showMessage={false}>
        <div
          className={`chart-container ${isLoading ? 'is-loading' : ''}`}
          style={containerStyles}
        >

          {isLoading && <Loading size={50} />}

          {chartAlert && (
            <StackTraceMessage
              message={chartAlert}
              link={queryResponse ? queryResponse.link : null}
              stackTrace={chartStackTrace}
            />
          )}

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
