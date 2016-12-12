import $ from 'jquery';
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { Panel, Alert } from 'react-bootstrap';
import visMap from '../../../visualizations/main';
import { d3format } from '../../modules/utils';
import ExploreActionButtons from '../../explore/components/ExploreActionButtons';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  can_download: PropTypes.bool.isRequired,
  slice_id: PropTypes.string.isRequired,
  slice_name: PropTypes.string.isRequired,
  viz_type: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  containerId: PropTypes.string.isRequired,
  json_endpoint: PropTypes.string.isRequired,
  csv_endpoint: PropTypes.string.isRequired,
  standalone_endpoint: PropTypes.string.isRequired,
  query: PropTypes.string.isRequired,
  column_formats: PropTypes.object,
  data: PropTypes.any,
  chartStatus: PropTypes.bool,
  isStarred: PropTypes.bool.isRequired,
  chartUpdateStartTime: PropTypes.string.isRequired,
  chartUpdateEndTime: PropTypes.string.isRequired,
  alert: PropTypes.string,
  table_name: PropTypes.string,
};

class ChartContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selector: `#${props.containerId}`,
      mockSlice: {},
    };
  }

  componentWillMount() {
    this.setState({ mockSlice: this.getMockedSliceObject(this.props) });
  }

  componentDidMount() {
    this.renderVis();
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ mockSlice: this.getMockedSliceObject(nextProps) });
  }

  componentDidUpdate() {
    this.renderVis();
  }

  getMockedSliceObject(props) {
    return {
      viewSqlQuery: props.query,

      data: {
        csv_endpoint: props.csv_endpoint,
        json_endpoint: props.json_endpoint,
        standalone_endpoint: props.standalone_endpoint,
      },

      containerId: props.containerId,

      jsonEndpoint: () => props.json_endpoint,

      container: {
        html: (data) => {
          // this should be a callback to clear the contents of the slice container
          $(this.state.selector).html(data);
        },

        css: (dim, size) => {
          // dimension can be 'height'
          // pixel string can be '300px'
          // should call callback to adjust height of chart
          $(this.state.selector).css(dim, size);
        },
        height: () => parseInt(props.height, 10) - 100,

        show: () => { this.render(); },

        get: (n) => ($(this.state.selector).get(n)),

        find: (classname) => ($(this.state.selector).find(classname)),

      },

      width: () => this.chartContainerRef.getBoundingClientRect().width,

      height: () => parseInt(props.height, 10) - 100,

      selector: this.state.selector,

      setFilter: () => {
        // set filter according to data in store
        // used in FilterBox.onChange()
      },

      getFilters: () => (
        // return filter objects from viz.formData
        {}
      ),

      done: () => {
        // finished rendering callback
      },

      clearError: () => {
        // no need to do anything here since Alert is closable
        // query button will also remove Alert
      },

      error(msg) {
        props.actions.chartUpdateFailed(msg);
      },

      d3format: (col, number) => {
        // mock d3format function in Slice object in superset.js
        const format = props.column_formats[col];
        return d3format(format, number);
      },
    };
  }

  removeAlert() {
    this.props.actions.removeChartAlert();
  }

  renderVis() {
    visMap[this.props.viz_type](this.state.mockSlice).render();
  }

  renderChartTitle() {
    let title;
    if (this.props.slice_name) {
      title = this.props.slice_name;
    } else {
      title = `[${this.props.table_name}] - untitled`;
    }
    return title;
  }

  renderChart() {
    if (this.props.alert) {
      return (
        <Alert bsStyle="warning">
          {this.props.alert}
          <i
            className="fa fa-close pull-right"
            onClick={this.removeAlert.bind(this)}
            style={{ cursor: 'pointer' }}
          />
        </Alert>
      );
    }
    if (this.props.chartStatus === 'loading') {
      return (<img alt="loading" width="25" src="/static/assets/images/loading.gif" />);
    }
    return (
      <div
        id={this.props.containerId}
        ref={(ref) => { this.chartContainerRef = ref; }}
        className={this.props.viz_type}
        style={{ overflowX: 'scroll' }}
      />
    );
  }

  render() {
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={
            <div
              id="slice-header"
              className="clearfix panel-title-large"
            >
              {this.renderChartTitle()}

              {this.props.slice_id &&
                <span>
                  <FaveStar
                    sliceId={this.props.slice_id}
                    actions={this.props.actions}
                    isStarred={this.props.isStarred}
                  />

                  <TooltipWrapper
                    label="edit-desc"
                    tooltip="Edit Description"
                  >
                    <a
                      className="edit-desc-icon"
                      href={`/slicemodelview/edit/${this.props.slice_id}`}
                    >
                      <i className="fa fa-edit" />
                    </a>
                  </TooltipWrapper>
                </span>
              }

              <div className="pull-right">
                <Timer
                  startTime={this.props.chartUpdateStartTime}
                  endTime={this.props.chartUpdateEndTime}
                  isRunning={this.props.chartStatus === 'loading'}
                  state={CHART_STATUS_MAP[this.props.chartStatus]}
                  style={{ 'font-size': '10px', 'margin-right': '5px' }}
                />
                <ExploreActionButtons
                  slice={this.state.mockSlice}
                  canDownload={this.props.can_download}
                />
              </div>
            </div>
          }
        >
          {this.renderChart()}
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    containerId: `slice-container-${state.viz.form_data.slice_id}`,
    slice_id: state.viz.form_data.slice_id,
    slice_name: state.viz.form_data.slice_name,
    viz_type: state.viz.form_data.viz_type,
    can_download: state.can_download,
    csv_endpoint: state.viz.csv_endpoint,
    json_endpoint: state.viz.json_endpoint,
    standalone_endpoint: state.viz.standalone_endpoint,
    chartUpdateStartTime: state.chartUpdateStartTime,
    chartUpdateEndTime: state.chartUpdateEndTime,
    query: state.viz.query,
    column_formats: state.viz.column_formats,
    data: state.viz.data,
    chartStatus: state.chartStatus,
    isStarred: state.isStarred,
    alert: state.chartAlert,
    table_name: state.viz.form_data.datasource_name,
  };
}

export default connect(mapStateToProps, () => ({}))(ChartContainer);
