/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import Mustache from 'mustache';
import { Tooltip } from 'react-bootstrap';

import { d3format } from '../modules/utils';
import ChartBody from './ChartBody';
import Loading from '../components/Loading';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger';
import StackTraceMessage from '../components/StackTraceMessage';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import visMap from '../visualizations';
import sandboxedEval from '../modules/sandbox';
import './chart.css';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  containerId: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  headerHeight: PropTypes.number,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  timeout: PropTypes.number,
  vizType: PropTypes.string.isRequired,
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number,
  latestQueryFormData: PropTypes.object,
  queryRequest: PropTypes.object,
  queryResponse: PropTypes.object,
  lastRendered: PropTypes.number,
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
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
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
  }

  componentDidMount() {
    if (this.props.triggerQuery) {
      const { formData } = this.props;
      this.props.actions.runQuery(formData, false, this.props.timeout, this.props.chartId);
    } else {
      // when drag/dropping in a dashboard, a chart may be unmounted/remounted but still have data
      this.renderViz();
    }
  }

  componentWillReceiveProps(nextProps) {
    this.annotationData = nextProps.annotationData;
    this.containerId = nextProps.containerId;
    this.selector = `#${this.containerId}`;
    this.formData = nextProps.formData;
    this.datasource = nextProps.datasource;
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
      this.renderViz();
    }
  }

  getFilters() {
    return this.props.getFilters();
  }

  setTooltip(tooltip) {
    this.setState({ tooltip });
  }

  addFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
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
    return null;
  }

  renderViz() {
    const { vizType, formData, queryResponse, setControlValue, chartId, chartStatus } = this.props;
    const visRenderer = visMap[vizType];
    const renderStart = Logger.getTimestamp();
    try {
      // Executing user-defined data mutator function
      if (formData.js_data) {
        queryResponse.data = sandboxedEval(formData.js_data)(queryResponse.data);
      }
      visRenderer(this, queryResponse, setControlValue);
      if (chartStatus !== 'rendered') {
        this.props.actions.chartRenderingSucceeded(chartId);
      }
      Logger.append(LOG_ACTIONS_RENDER_CHART, {
        slice_id: 'slice_' + chartId,
        viz_type: vizType,
        start_offset: renderStart,
        duration: Logger.getTimestamp() - renderStart,
      });
      this.props.actions.chartRenderingSucceeded(chartId);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.props.actions.chartRenderingFailed(e, chartId);
    }
  }

  render() {
    const isLoading = this.props.chartStatus === 'loading';

    // this allows <Loading /> to be positioned in the middle of the chart
    const containerStyles = isLoading ? { height: this.height(), width: this.width() } : null;
    return (
      <div className={`chart-container ${isLoading ? 'is-loading' : ''}`} style={containerStyles}>
        {this.renderTooltip()}
        {isLoading && <Loading size={75} />}
        {this.props.chartAlert && (
          <StackTraceMessage
            message={this.props.chartAlert}
            queryResponse={this.props.queryResponse}
          />
        )}

        {!isLoading &&
          !this.props.chartAlert &&
          this.props.refreshOverlayVisible &&
          !this.props.errorMessage &&
          this.container && (
            <RefreshChartOverlay
              height={this.height()}
              width={this.width()}
              onQuery={this.props.onQuery}
              onDismiss={this.props.onDismissRefreshOverlay}
            />
          )}

        {!isLoading &&
          !this.props.chartAlert && (
            <ChartBody
              containerId={this.containerId}
              vizType={this.props.vizType}
              height={this.height}
              width={this.width}
              faded={
                this.props.refreshOverlayVisible && !this.props.errorMessage
              }
              ref={(inner) => {
                this.container = inner;
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
