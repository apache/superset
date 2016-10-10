import React, { PropTypes } from 'react';
import { Panel } from 'react-bootstrap';
import TimeSeriesLineChart from './charts/TimeSeriesLineChart';
import moment from 'moment';

const propTypes = {
  viz: PropTypes.shape({
    data: PropTypes.array.isRequired,
    form_data: PropTypes.shape({
      viz_type: PropTypes.string.isRequired,
      slice_name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  height: PropTypes.string.isRequired,
};

export default class ChartContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      params: this.getParamsFromUrl(),
      data: props.viz.data,
      label1: 'Label 1',
    };
  }

  getParamsFromUrl() {
    const hash = window.location.search;
    const params = hash.split('?')[1].split('&');
    const newParams = {};
    params.forEach((p) => {
      const value = p.split('=')[1].replace(/\+/g, ' ');
      const key = p.split('=')[0];
      newParams[key] = value;
    });
    return newParams;
  }

  formatDates(values) {
    const newValues = values.map(function (val) {
      return {
        x: moment(new Date(val.x)).format('MMM D'),
        y: val.y,
      };
    });
    return newValues;
  }

  isLineViz() {
    // todo(alanna) generalize this check and map to charts
    const vizType = this.props.viz.form_data.viz_type;
    return vizType === 'line';
  }

  render() {
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={
            <div className="panel-title">{this.props.viz.form_data.slice_name}</div>
          }
        >
          {this.isLineViz() &&
            <TimeSeriesLineChart
              data={this.state.data}
              label1="Label 1"
            />
          }
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;
