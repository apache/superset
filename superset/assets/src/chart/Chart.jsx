import dompurify from 'dompurify';
import PropTypes from 'prop-types';
import React from 'react';
import { Tooltip } from 'react-bootstrap';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger';
import Loading from '../components/Loading';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import StackTraceMessage from '../components/StackTraceMessage';
import convertKeysToCamelCase from '../utils/convertKeysToCamelCase';
import SuperChart from '../visualizations/core/components/SuperChart';
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

    // // these properties are used by visualizations
    // this.annotationData = props.annotationData;
    // this.containerId = props.containerId;
    // this.selector = `#${this.containerId}`;
    // this.formData = props.formData;
    // this.datasource = props.datasource;
    this.addFilter = this.addFilter.bind(this);
    this.headerHeight = this.headerHeight.bind(this);
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
    // else {
    //   // when drag/dropping in a dashboard, a chart may be unmounted/remounted but still have data
    //   this.renderVis();
    // }
  }

  // componentWillReceiveProps(nextProps) {
  //   this.annotationData = nextProps.annotationData;
  //   this.containerId = nextProps.containerId;
  //   this.selector = `#${this.containerId}`;
  //   this.formData = nextProps.formData;
  //   this.datasource = nextProps.datasource;
  // }

  // componentDidUpdate(prevProps) {
  //   if (
  //     this.props.queryResponse &&
  //     ['success', 'rendered'].indexOf(this.props.chartStatus) > -1 &&
  //     !this.props.queryResponse.error &&
  //     (prevProps.annotationData !== this.props.annotationData ||
  //       prevProps.queryResponse !== this.props.queryResponse ||
  //       prevProps.height !== this.props.height ||
  //       prevProps.width !== this.props.width ||
  //       prevProps.lastRendered !== this.props.lastRendered)
  //   ) {
  //     this.renderVis();
  //   }
  // }

  setTooltip(tooltip) {
    this.setState({ tooltip });
  }

  addFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  clearError() {
    this.setState({ errorMsg: null });
  }

  headerHeight() {
    return this.props.headerHeight || 0;
  }

  error(e) {
    this.props.actions.chartRenderingFailed(e, this.props.chartId);
  }

  prepareChartProps() {
    const {
      annotationData,
      datasource,
      formData,
      getFilters,
      queryResponse,
      setControlValue,
    } = this.props;

    // const payload = {
    //   data: formData.js_data
    //     ? sandboxedEval(formData.js_data)(queryResponse.data)
    //     : queryResponse.data,
    // };

    return {
      annotationData,
      datasource: convertKeysToCamelCase(datasource),
      rawDatasource: datasource,
      filters: getFilters(),
      formData: convertKeysToCamelCase(formData),
      onAddFilter: (...args) => {
        this.addFilter(...args);
      },
      onError: (...args) => {
        this.error(...args);
      },
      payload: queryResponse,
      setControlValue,
    };
  }

  renderTooltip() {
    if (this.state.tooltip) {
      return (
        <Tooltip
          className="chart-tooltip"
          id="chart-tooltip"
          placement="right"
          positionTop={this.state.tooltip.y + 30}
          positionLeft={this.state.tooltip.x + 30}
          arrowOffsetTop={10}
        >
          {typeof (this.state.tooltip.content) === 'string' ?
            <div // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: dompurify.sanitize(this.state.tooltip.content) }}
            />
            :
            this.state.tooltip.content
          }
        </Tooltip>
      );
    }
    return null;
  }

  // renderVis() {
  //   // const { chartStatus } = this.props;
  //   // const hasVisPromise = !!this.state.renderVis;
  //   // // check that we have the render function and data
  //   // if (hasVisPromise && ['success', 'rendered'].indexOf(chartStatus) > -1) {
  //   //   const { vizType, formData, queryResponse, setControlValue, chartId } = this.props;
  //   //   const renderStart = Logger.getTimestamp();

  //   //   try {
  //   //     // Executing user-defined data mutator function
  //   //     if (formData.js_data) {
  //   //       queryResponse.data = sandboxedEval(formData.js_data)(queryResponse.data);
  //   //     }
  //   //     // [re]rendering the visualization
  //   //     this.state.renderVis(this, queryResponse, setControlValue);

  //   //     if (chartStatus !== 'rendered') {
  //   //       this.props.actions.chartRenderingSucceeded(chartId);
  //   //     }

  //   //     Logger.append(LOG_ACTIONS_RENDER_CHART, {
  //   //       slice_id: chartId,
  //   //       viz_type: vizType,
  //   //       start_offset: renderStart,
  //   //       duration: Logger.getTimestamp() - renderStart,
  //   //     });
  //   //   } catch (e) {
  //   //     console.warn(e); // eslint-disable-line
  //   //     this.props.actions.chartRenderingFailed(e, chartId);
  //   //   }
  //   // }
  // }

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

        {this.props.chartAlert && (
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
            className={`slice_container ${isFaded ? ' faded' : ''}`}
            width={width}
            height={height}
            chartProps={this.prepareChartProps()}
            vizType={vizType}
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
