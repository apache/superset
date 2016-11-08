import $ from 'jquery';
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import visMap from '../../../visualizations/main';
import { d3format } from '../../modules/utils';
import ExploreActionButtons from '../../explore/components/ExploreActionButtons';

const propTypes = {
  can_download: PropTypes.bool.isRequired,
  slice_name: PropTypes.string.isRequired,
  viz_type: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  containerId: PropTypes.string.isRequired,
  json_endpoint: PropTypes.string.isRequired,
  csv_endpoint: PropTypes.string.isRequired,
  standalone_endpoint: PropTypes.string.isRequired,
  query: PropTypes.string.isRequired,
  column_formats: PropTypes.object,
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
    this.setState({ mockSlice: this.getMockedSliceObject() });
  }

  componentDidMount() {
    this.renderVis();
  }

  componentDidUpdate() {
    this.renderVis();
  }

  getMockedSliceObject() {
    return {
      viewSqlQuery: this.props.query,

      data: {
        csv_endpoint: this.props.csv_endpoint,
        json_endpoint: this.props.json_endpoint,
        standalone_endpoint: this.props.standalone_endpoint,
      },

      containerId: this.props.containerId,

      jsonEndpoint: () => this.props.json_endpoint,

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
        height: () => parseInt(this.props.height, 10) - 100,

        show: () => { this.render(); },

        get: (n) => ($(this.state.selector).get(n)),

        find: (classname) => ($(this.state.selector).find(classname)),

      },

      width: () => this.chartContainerRef.getBoundingClientRect().width,

      height: () => parseInt(this.props.height, 10) - 100,

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

      error(msg, xhr) {
        let errorMsg = msg;
        let errHtml = '';
        try {
          const o = JSON.parse(msg);
          if (o.error) {
            errorMsg = o.error;
          }
        } catch (e) {
          // pass
        }
        errHtml = `<div class="alert alert-danger">${errorMsg}</div>`;
        if (xhr) {
          const extendedMsg = this.getErrorMsg(xhr);
          if (extendedMsg) {
            errHtml += `<div class="alert alert-danger">${extendedMsg}</div>`;
          }
        }
        $(this.state.selector).html(errHtml);
        this.render();
        $('span.query').removeClass('disabled');
        $('.query-and-save button').removeAttr('disabled');
      },

      d3format: (col, number) => {
        // mock d3format function in Slice object in caravel.js
        const format = this.props.column_formats[col];
        return d3format(format, number);
      },
    };
  }

  renderVis() {
    visMap[this.props.viz_type](this.state.mockSlice).render();
  }

  render() {
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={
            <div
              id="slice-header"
              className="panel-title"
            >
              {this.props.slice_name}
              <div className="pull-right">
                <ExploreActionButtons
                  slice={this.state.mockSlice}
                  canDownload={this.props.can_download}
                />
              </div>
            </div>
          }
        >
          <div
            id={this.props.containerId}
            ref={(ref) => { this.chartContainerRef = ref; }}
            className={this.props.viz_type}
          />
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    containerId: `slice-container-${state.viz.form_data.slice_id}`,
    slice_name: state.viz.form_data.slice_name,
    viz_type: state.viz.form_data.viz_type,
    can_download: state.can_download,
    csv_endpoint: state.viz.csv_endpoint,
    json_endpoint: state.viz.json_endpoint,
    standalone_endpoint: state.viz.standalone_endpoint,
    query: state.viz.query,
    column_formats: state.viz.column_formats,
  };
}

function mapDispatchToProps() {
  return {};
}

export default connect(mapStateToProps, mapDispatchToProps)(ChartContainer);
