import $ from 'jquery';
import React, { PropTypes } from 'react';
import { Alert, Collapse } from 'react-bootstrap';
import visMap from '../../../visualizations/main';
import { d3format } from '../../modules/utils';
import { getExploreUrl } from '../exploreUtils';
import shortid from 'shortid';

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  chartStatus: PropTypes.string,
  datasource: PropTypes.object.isRequired,
  height: PropTypes.string.isRequired,
  formData: PropTypes.object,
  triggerRender: PropTypes.bool,
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);
    const containerId = shortid.generate();
    this.state = {
      containerId,
      selector: `#${containerId}`,
      showStackTrace: false,
    };
  }
  componentDidUpdate(prevProps) {
    if (
        (
          prevProps.queryResponse !== this.props.queryResponse ||
          prevProps.height !== this.props.height || (
              !prevProps.triggerRender &&
              this.props.triggerRender
          )
        ) && !this.props.queryResponse.error
        && this.props.chartStatus !== 'failed'
        && this.props.chartStatus !== 'stopped'
      ) {
      this.renderViz();
    }
  }

  renderViz() {
    this.props.actions.renderTriggered();
    const mockSlice = this.getMockedSliceObject();

    this.setState({ mockSlice });
    try {
      visMap[this.props.formData.viz_type](mockSlice, this.props.queryResponse);
    } catch (e) {
      this.props.actions.chartRenderingFailed(e);
    }
  }

  getMockedSliceObject() {
    const props = this.props;
    const getHeight = () => {
      const headerHeight = this.props.standalone ? 0 : 100;
      return parseInt(props.height, 10) - headerHeight;
    };
    return {
      viewSqlQuery: this.props.queryResponse.query,
      containerId: this.state.containerId,
      selector: this.state.selector,
      formData: this.props.formData,
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
        height: getHeight,
        show: () => { },
        get: (n) => ($(this.state.selector).get(n)),
        find: (classname) => ($(this.state.selector).find(classname)),
      },

      width: () => this.chartContainerRef.getBoundingClientRect().width,

      height: getHeight,

      setFilter: () => {
        // set filter according to data in store
        // used in FilterBox.onChange()
      },

      getFilters: () => (
        // return filter objects from viz.formData
        {}
      ),

      done: () => {},
      clearError: () => {
        // no need to do anything here since Alert is closable
        // query button will also remove Alert
      },
      error() {},

      d3format: (col, number) => {
        // mock d3format function in Slice object in superset.js
        const format = props.column_formats[col];
        return d3format(format, number);
      },

      data: {
        csv_endpoint: getExploreUrl(this.props.formData, 'csv'),
        json_endpoint: getExploreUrl(this.props.formData, 'json'),
        standalone_endpoint: getExploreUrl(this.props.formData, 'standalone'),
      },

    };
  }

  renderAlert() {
    const msg = (
      <div>
        {this.props.alert}
        <i
          className="fa fa-close pull-right"
          style={{ cursor: 'pointer' }}
        />
      </div>);
    return (
      <div>
        <Alert
          bsStyle="warning"
          onClick={() => this.setState({ showStackTrace: !this.state.showStackTrace })}
        >
          {msg}
        </Alert>
        {this.props.queryResponse && this.props.queryResponse.stacktrace &&
          <Collapse in={this.state.showStackTrace}>
            <pre>
              {this.props.queryResponse.stacktrace}
            </pre>
          </Collapse>
        }
      </div>);
  }

  render() {
    if (this.props.alert) {
      return this.renderAlert();
    }
    const loading = this.props.chartStatus === 'loading';
    return (
      <div>
        {loading &&
          <img
            alt="loading"
            width="25"
            src="/static/assets/images/loading.gif"
            style={{ position: 'absolute' }}
          />
        }
        <div
          id={this.state.containerId}
          ref={ref => { this.chartContainerRef = ref; }}
          className={this.props.formData.viz_type}
          style={{
            opacity: loading ? '0.25' : '1',
          }}
        />
      </div>
    );
  }
}

Chart.propTypes = propTypes;
export default Chart;
