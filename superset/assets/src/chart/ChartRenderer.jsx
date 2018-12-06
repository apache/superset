import dompurify from 'dompurify';
import { snakeCase } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import { ChartProps } from '@superset-ui/chart';
import { Tooltip } from 'react-bootstrap';
import { Logger, LOG_ACTIONS_RENDER_CHART } from '../logger';
import SuperChart from '../visualizations/core/components/SuperChart';

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
};

const BLANK = {};

const defaultProps = {
  addFilter: () => BLANK,
  filters: BLANK,
  setControlValue() {},
  triggerRender: false,
};

class ChartRenderer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {};

    this.createChartProps = ChartProps.createSelector();

    this.setTooltip = this.setTooltip.bind(this);
    this.handleAddFilter = this.handleAddFilter.bind(this);
    this.handleRenderSuccess = this.handleRenderSuccess.bind(this);
    this.handleRenderFailure = this.handleRenderFailure.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    if (
      nextProps.queryResponse &&
      ['success', 'rendered'].indexOf(nextProps.chartStatus) > -1 &&
      !nextProps.queryResponse.error &&
      !nextProps.refreshOverlayVisible &&
      (nextProps.annotationData !== this.props.annotationData ||
        nextProps.queryResponse !== this.props.queryResponse ||
        nextProps.height !== this.props.height ||
        nextProps.width !== this.props.width ||
        nextProps.triggerRender)
    ) {
      return true;
    }
    return false;
  }

  setTooltip(tooltip) {
    this.setState({ tooltip });
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

  handleAddFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  handleRenderSuccess() {
    const { actions, chartStatus, chartId, vizType } = this.props;
    if (['loading', 'rendered'].indexOf(chartStatus) < 0) {
      actions.chartRenderingSucceeded(chartId);
    }

    Logger.append(LOG_ACTIONS_RENDER_CHART, {
      slice_id: chartId,
      viz_type: vizType,
      start_offset: this.renderStartTime,
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  handleRenderFailure(error, info) {
    const { actions, chartId } = this.props;
    console.warn(error); // eslint-disable-line
    actions.chartRenderingFailed(error.toString(), chartId, info ? info.componentStack : null);

    Logger.append(LOG_ACTIONS_RENDER_CHART, {
      slice_id: chartId,
      has_err: true,
      error_details: error.toString(),
      start_offset: this.renderStartTime,
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
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
    } = this.props;

    const isLoading = chartStatus === 'loading';

    const skipChartRendering = isLoading || !!chartAlert;
    this.renderStartTime = Logger.getTimestamp();

    return (
      <React.Fragment>
        {this.renderTooltip()}
        <SuperChart
          className={`${snakeCase(vizType)}`}
          chartType={vizType}
          chartProps={skipChartRendering ? null : this.prepareChartProps()}
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
