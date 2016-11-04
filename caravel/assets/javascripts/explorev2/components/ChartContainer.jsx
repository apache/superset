import $ from 'jquery';
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import visMap from '../../../visualizations/main';
import { d3format } from '../../modules/utils';

const propTypes = {
  sliceName: PropTypes.string.isRequired,
  vizType: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  containerId: PropTypes.string.isRequired,
  jsonEndpoint: PropTypes.string.isRequired,
  columnFormats: PropTypes.object,
};

class ChartContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selector: `#${this.props.containerId}`,
    };
  }

  componentDidMount() {
    this.renderVis();
  }

  componentDidUpdate() {
    this.renderVis();
  }

  getMockedSliceObject() {
    return {
      containerId: this.props.containerId,

      jsonEndpoint: () => this.props.jsonEndpoint,

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
        const format = this.props.columnFormats[col];
        return d3format(format, number);
      },
    };
  }

  renderVis() {
    const slice = this.getMockedSliceObject();
    visMap[this.props.vizType](slice).render();
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
              {this.props.sliceName}
            </div>
          }
        >
          <div
            id={this.props.containerId}
            ref={(ref) => { this.chartContainerRef = ref; }}
            className={this.props.vizType}
          />
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    sliceName: state.sliceName,
    vizType: state.viz.formData.vizType,
    containerId: `slice-container-${state.viz.formData.sliceId}`,
    jsonEndpoint: state.viz.jsonEndPoint,
    columnFormats: state.viz.columnFormats,
  };
}

function mapDispatchToProps() {
  return {};
}

export default connect(mapStateToProps, mapDispatchToProps)(ChartContainer);
